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
    'foam.dao.AbstractSink',
    'foam.dao.ArraySink',
    'foam.dao.DAO',
    'foam.lang.Detachable',
    'foam.lang.PropertyInfo',
    'foam.mlang.MLang',
    'foam.mlang.predicate.Predicate',
    'foam.util.SafetyUtil',
    'java.util.Arrays',
    'java.util.HashMap',
    'java.util.HashSet',
    'java.util.Map',
    'java.util.Set'
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

    The index holds the rows of one vector length, the length of the last
    query: a store can mix models (384-number MiniLM rows beside 1536-number
    OpenAI rows), and a cosine score needs both vectors the same length.

    Access
    ------
    A row with a daoKey is a piece of a record in that DAO (a chunk of a
    Knowledge Base flow in flowDAO), so it is only scored when the caller can
    read that record: before scoring, one select as the caller lists the
    readable records of each daoKey, and rows of other records are skipped.
    A user who cannot open a doc never gets one of its chunks, and the rows
    they may not read take no part in the ranking. A row with no daoKey
    has no record to check and is scored as before.
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
      // parallel to flatIndex: indexIds[i] is the VectorEmbedding id for row i
      class: 'StringArray',
      name: 'indexIds',
      networkTransient: true
    },
    {
      // parallel to flatIndex: the daoKey of row i, empty for a row with no source record
      class: 'StringArray',
      name: 'indexDaoKeys',
      networkTransient: true
    },
    {
      // parallel to flatIndex: the sourceId of row i
      class: 'StringArray',
      name: 'indexSourceIds',
      networkTransient: true
    }
  ],

  methods: [
    {
      name: 'buildIndex_',
      documentation: 'Packs the vectors of every row that has length d; rows of another length are left out.',
      args: 'X x, int d',
      javaCode: `
        // full scan of the delegate DAO to collect all embeddings
        var list = ((ArraySink) getDelegate().select(new ArraySink())).getArray();
        int n    = list.size();

        // pack the vectors of length d into one contiguous float[n*d] in row-major order.
        // row i occupies flatIndex[i*d .. i*d+d-1], parallel to indexIds[i].
        float[]  flat    = new float[n * d];
        String[] ids     = new String[n];
        String[] daoKeys = new String[n];
        String[] sources = new String[n];
        int row = 0;
        for ( int i = 0 ; i < n ; i++ ) {
          var e = (VectorEmbedding) list.get(i);
          if ( e.getVector().length != d ) continue;
          System.arraycopy(e.getVector(), 0, flat, row * d, d);
          ids[row]     = e.getId();
          daoKeys[row] = e.getDaoKey();
          sources[row] = e.getSourceId();
          row++;
        }
        setDim(d);
        setFlatIndex(Arrays.copyOf(flat, row * d));
        setIndexIds(Arrays.copyOf(ids, row));
        setIndexDaoKeys(Arrays.copyOf(daoKeys, row));
        setIndexSourceIds(Arrays.copyOf(sources, row));
        setDirty(false);
      `
    },
    {
      name: 'readableSources_',
      documentation: `
        The sourceIds the caller in x can read, per daoKey of the indexed rows,
        e.g. { flowDAO: [ "Getting Started", "API Integration" ] }. One
        select per daoKey, as the caller, limited to the sources the index holds.
        A daoKey the context does not have reads as nothing readable. daoKeys and
        sources are the arrays of the index snapshot the search scores.
      `,
      javaType: 'Map<String, Set<String>>',
      args: 'X x, String[] daoKeys, String[] sources',
      javaCode: `
        Map<String, Set<String>> wanted = new HashMap<>();
        for ( int i = 0 ; i < daoKeys.length ; i++ ) {
          if ( SafetyUtil.isEmpty(daoKeys[i]) ) continue;
          wanted.computeIfAbsent(daoKeys[i], k -> new HashSet<>()).add(sources[i]);
        }

        Map<String, Set<String>> readable = new HashMap<>();
        for ( Map.Entry<String, Set<String>> e : wanted.entrySet() ) {
          Set<String> ids = new HashSet<>();
          readable.put(e.getKey(), ids);
          DAO dao = (DAO) x.get(e.getKey());
          if ( dao == null || dao.getOf() == null ) continue;
          PropertyInfo pk = (PropertyInfo) dao.getOf().getAxiomByName("id");
          dao.inX(x)
            .where(MLang.IN(pk, e.getValue().toArray()))
            .select(new AbstractSink() {
              @Override
              public void put(Object obj, Detachable sub) {
                ids.add(String.valueOf(pk.get(obj)));
              }
            });
        }
        return readable;
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
        float[]  flat;
        String[] ids, daoKeys, sources;
        synchronized ( this ) {
          if ( getDirty() || getDim() != d ) buildIndex_(x, d);
          flat    = getFlatIndex();
          ids     = getIndexIds();
          daoKeys = getIndexDaoKeys();
          sources = getIndexSourceIds();
        }

        // rows of records the caller cannot read are never scored
        Map<String, Set<String>> readable = readableSources_(x, daoKeys, sources);
        int[] rows = new int[ids.length];
        int   n    = 0;
        for ( int i = 0 ; i < ids.length ; i++ ) {
          if ( SafetyUtil.isEmpty(daoKeys[i]) || readable.get(daoKeys[i]).contains(sources[i]) ) rows[n++] = i;
        }

        // score each row via CosineComparator.score(flat, offset, dim) — the formula
        // lives in CosineComparator; the offset overload avoids a float[] copy per row.
        float[] scores = new float[n];
        for ( int i = 0; i < n; i++ ) {
          scores[i] = cc.score(flat, rows[i] * d, d);
        }

        // sort by descending score to get ranking; ranked[] holds positions in rows[]
        Integer[] ranked = new Integer[n];
        for ( int i = 0; i < n; i++ ) ranked[i] = i;
        Arrays.sort(ranked, (a, b) -> Float.compare(scores[b], scores[a]));

        // stream top results into the sink, honouring skip/limit/predicate
        long skipped = 0;
        long emitted = 0;
        long maxEmit = (limit > 0 && limit < AbstractDAO.MAX_SAFE_INTEGER) ? limit : Long.MAX_VALUE;
        for ( int i = 0; i < n && emitted < maxEmit; i++ ) {
          var obj = (VectorEmbedding) getDelegate().find(ids[rows[ranked[i]]]);
          if ( obj == null ) continue;
          if ( predicate != null && !predicate.f(obj) ) continue;
          if ( skipped < skip ) { skipped++; continue; }
          var scored = (VectorEmbedding) obj.fclone();
          scored.setScore(scores[ranked[i]]);
          sink.put(scored, null);
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
