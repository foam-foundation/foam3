/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.ai.vector',
  name: 'VectorStoreDAO',
  extends: 'foam.dao.ProxyDAO',

  javaImports: [
    'foam.ai.vector.CosineComparator',
    'foam.ai.vector.VectorEmbedding',
    'foam.dao.AbstractDAO',
    'foam.dao.ArraySink',
    'foam.mlang.predicate.Predicate',
    'java.util.Arrays'
  ],

  /*
    Index layout
    ------------
    flatIndex is a packed float[] that reformats all vector fields from every
    VectorEmbedding in the delegate DAO into a single contiguous allocation.

    Instead of n separate float[] arrays (one per object):
      VectorEmbedding[0].vector = [0.1, 0.2, 0.3, ...]
      VectorEmbedding[1].vector = [0.4, 0.5, 0.6, ...]
      VectorEmbedding[2].vector = [0.7, 0.8, 0.9, ...]

    We get one contiguous float[] in row-major order:
      flatIndex = [0.1, 0.2, 0.3,  0.4, 0.5, 0.6,  0.7, 0.8, 0.9, ...]
                   |--- row 0 ---|  |--- row 1 ---|  |--- row 2 ---|

    indexRows runs in parallel: indexRows[i] is the VectorEmbedding whose
    vector occupies flatIndex[i*dim .. i*dim+dim-1], so a search reads a
    ranked row without a find.

    A search scores every row, keeps the rows at or above the comparator's
    minScore, sorts only those, and walks them best first through the
    predicate until it has limit rows. With a minScore, a question close to
    nothing reads no row at all, however large the store.

    Why: the cosine search loop reads flatIndex sequentially end-to-end —
    one big contiguous array is CPU-cache friendly. Chasing n separate object
    references to read n separate float[] fields would be much slower for large n.

    The index holds the rows of one vector length, the length of the last
    query: a store can mix models (384-number MiniLM rows beside 1536-number
    OpenAI rows), and a cosine score needs both vectors the same length.
    Queries that alternate between two lengths rebuild the index each time,
    so a store meant for one model should hold that model's rows only.
  */
  properties: [
    {
      // the vector length of the rows the index holds, the length of the last query
      class: 'Int',
      name: 'dim'
    },
    {
      // true whenever the delegate DAO has changed and the flat index needs rebuilding
      class: 'Boolean',
      name: 'dirty',
      value: true,
      synchronized: true
    },
    {
      class: 'foam.lang.FloatArray',
      name: 'flatIndex',
      networkTransient: true
    },
    {
      // parallel to flatIndex: indexRows[i] is the VectorEmbedding of row i
      class: 'FObjectArray',
      of: 'foam.ai.vector.VectorEmbedding',
      name: 'indexRows',
      networkTransient: true
    }
  ],

  methods: [
    {
      name: 'buildIndex_',
      documentation: 'Packs the vectors of every row that has length d; rows of another length are left out.',
      args: 'int d',
      javaCode: `
        // full scan of the delegate DAO to collect all embeddings
        var list = ((ArraySink) getDelegate().select(new ArraySink())).getArray();
        int n    = list.size();

        // pack the vectors of length d into one contiguous float[n*d] in row-major order.
        // row i occupies flatIndex[i*d .. i*d+d-1], parallel to indexRows[i].
        float[]           flat = new float[n * d];
        VectorEmbedding[] rows = new VectorEmbedding[n];
        int row = 0;
        for ( int i = 0 ; i < n ; i++ ) {
          var e = (VectorEmbedding) list.get(i);
          if ( e.getVector().length != d ) continue;
          System.arraycopy(e.getVector(), 0, flat, row * d, d);
          rows[row] = e;
          row++;
        }
        setDim(d);
        setFlatIndex(Arrays.copyOf(flat, row * d));
        setIndexRows(Arrays.copyOf(rows, row));
        setDirty(false);
      `
    },
    {
      name: 'select_',
      type: 'foam.dao.Sink',
      args: [
        { name: 'x',         type: 'X'                              },
        { name: 'sink',      type: 'foam.dao.Sink'                  },
        { name: 'skip',      javaType: 'long'                       },
        { name: 'limit',     javaType: 'long'                       },
        { name: 'order',     type: 'foam.mlang.order.Comparator'    },
        { name: 'predicate', type: 'foam.mlang.predicate.Predicate' }
      ],
      javaCode: `
        // only intercept when the caller used orderBy(CosineComparator);
        // all other queries fall through to the delegate unchanged
        if ( !(order instanceof CosineComparator) ) {
          return super.select_(x, sink, skip, limit, order, predicate);
        }
        CosineComparator cc = (CosineComparator) order;
        int d = cc.getQueryVector().length;
        // synchronized: two searches must not rebuild the index under each other
        float[]           flat;
        VectorEmbedding[] rows;
        synchronized ( this ) {
          if ( getDirty() || getDim() != d ) buildIndex_(d);
          flat = getFlatIndex();
          rows = getIndexRows();
        }
        int   n   = rows.length;
        float min = cc.getMinScore();

        // Score each row via CosineComparator.score(flat, offset, dim); the offset overload
        // avoids a float[] copy per row. A row below minScore is dropped here, so it is never
        // sorted or checked by the predicate. A kept row is one long, its score's sort key
        // above its row number, so a primitive sort ranks them best first with no boxing.
        long[] ranked = new long[n];
        int    kept   = 0;
        for ( int i = 0 ; i < n ; i++ ) {
          float s = cc.score(flat, i * d, d);
          if ( s >= min ) ranked[kept++] = ( (long) descending_(s) << 32 ) | i;
        }
        Arrays.sort(ranked, 0, kept);

        // stream top results into the sink, honouring skip/limit/predicate
        long skipped = 0;
        long emitted = 0;
        long maxEmit = (limit > 0 && limit < AbstractDAO.MAX_SAFE_INTEGER) ? limit : Long.MAX_VALUE;
        for ( int k = 0 ; k < kept && emitted < maxEmit ; k++ ) {
          int             i   = (int) ranked[k];
          VectorEmbedding obj = rows[i];
          if ( predicate != null && ! predicate.f(obj) ) continue;
          if ( skipped < skip ) { skipped++; continue; }
          var scored = (VectorEmbedding) obj.fclone();
          scored.setScore(cc.score(flat, i * d, d));
          sink.put(scored, null);
          emitted++;
        }
        sink.eof();
        return sink;
      `
    },
    {
      name: 'descending_',
      documentation: 'An int that sorts ascending as s sorts descending, e.g. 0.9 before 0.2 before -0.5.',
      type: 'Integer',
      args: 'float s',
      javaCode: `
        int b = Float.floatToIntBits(-s);
        // flip the magnitude bits of a negative float, so the signed int order is the float order
        return b ^ ( ( b >> 31 ) & 0x7fffffff );
      `
    },
    {
      name: 'put_',
      type: 'FObject',
      args: [
        { name: 'x',   type: 'X'       },
        { name: 'obj', type: 'FObject' }
      ],
      javaCode: `
        var result = super.put_(x, obj);
        setDirty(true);
        return result;
      `
    },
    {
      name: 'remove_',
      type: 'FObject',
      args: [
        { name: 'x',   type: 'X'       },
        { name: 'obj', type: 'FObject' }
      ],
      javaCode: `
        var result = super.remove_(x, obj);
        setDirty(true);
        return result;
      `
    },
    {
      name: 'removeAll_',
      args: 'X x, long skip, long limit, foam.mlang.order.Comparator order, Predicate predicate',
      javaCode: `
        super.removeAll_(x, skip, limit, order, predicate);
        setDirty(true);
      `
    }
  ]
});
