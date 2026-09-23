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

    indexIds runs in parallel: indexIds[i] is the id of the VectorEmbedding
    whose vector occupies flatIndex[i*dim .. i*dim+dim-1].

    Why: the cosine search loop reads flatIndex sequentially end-to-end —
    one big contiguous array is CPU-cache friendly. Chasing n separate object
    references to read n separate float[] fields would be much slower for large n.
  */
  properties: [
    {
      // vector dimensionality — set on first index build
      class: 'Int',
      name: 'dim'
    },
    {
      // true whenever the delegate DAO has changed and the flat index needs rebuilding
      class: 'Boolean',
      name: 'dirty',
      value: true
    },
    {
      class: 'foam.lang.FloatArray',
      name: 'flatIndex',
      networkTransient: true
    },
    {
      // parallel to flatIndex: indexIds[i] is the VectorEmbedding id for row i
      class: 'StringArray',
      name: 'indexIds',
      networkTransient: true
    }
  ],

  methods: [
    {
      name: 'buildIndex_',
      args: [{ name: 'x', type: 'X' }],
      javaCode: `
        // full scan of the delegate DAO to collect all embeddings
        var sink = (ArraySink) getDelegate().select(new ArraySink());
        var list = sink.getArray();
        if ( list.isEmpty() ) {
          setFlatIndex(new float[0]);
          setIndexIds(new String[0]);
          setDirty(false);
          return;
        }
        int d = ((VectorEmbedding) list.get(0)).getVector().length;
        setDim(d);
        int n = list.size();

        // pack all vectors into one contiguous float[n*d] in row-major order.
        // row i occupies flatIndex[i*d .. i*d+d-1], parallel to indexIds[i].
        float[]  flat = new float[n * d];
        String[] ids  = new String[n];
        for ( int i = 0; i < n; i++ ) {
          var e = (VectorEmbedding) list.get(i);
          System.arraycopy(e.getVector(), 0, flat, i * d, d);
          ids[i] = e.getId();
        }
        setFlatIndex(flat);
        setIndexIds(ids);
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
        if ( getDirty() ) buildIndex_(x);

        CosineComparator cc   = (CosineComparator) order;
        float[]  flat = getFlatIndex();
        String[] ids  = getIndexIds();
        int n = ids.length;
        int d = getDim();

        // score each row via CosineComparator.score(flat, offset, dim) — the formula
        // lives in CosineComparator; the offset overload avoids a float[] copy per row.
        float[] scores = new float[n];
        for ( int i = 0; i < n; i++ ) {
          scores[i] = cc.score(flat, i * d, d);
        }

        // sort row indices by descending score to get ranking
        Integer[] ranked = new Integer[n];
        for ( int i = 0; i < n; i++ ) ranked[i] = i;
        Arrays.sort(ranked, (a, b) -> Float.compare(scores[b], scores[a]));

        // stream top results into the sink, honouring skip/limit/predicate
        long skipped = 0;
        long emitted = 0;
        long maxEmit = (limit > 0 && limit < AbstractDAO.MAX_SAFE_INTEGER) ? limit : Long.MAX_VALUE;
        for ( int i = 0; i < n && emitted < maxEmit; i++ ) {
          var obj = (foam.lang.FObject) getDelegate().find(ids[ranked[i]]);
          if ( obj == null ) continue;
          if ( predicate != null && !predicate.f(obj) ) continue;
          if ( skipped < skip ) { skipped++; continue; }
          sink.put(obj, null);
          emitted++;
        }
        sink.eof();
        return sink;
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
    }
  ]
});
