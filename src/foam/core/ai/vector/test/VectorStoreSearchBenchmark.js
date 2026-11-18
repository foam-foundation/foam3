/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ai.vector.test',
  name: 'VectorStoreSearchBenchmark',
  extends: 'foam.core.bench.Benchmark',

  documentation: `
    Times a search as ragService makes it: the 10 nearest chunks of one DAO,
    of one model, whose record the user can read. Each of chunkCount records
    has one chunk; relevantPercent of them point near the question and the
    rest point anywhere. readablePercent of the records exist in the record
    DAO, so the others fail the access check, e.g. 0 for a user who can read
    none of them. Logs the time of one search and how many records it looked up.
  `,

  javaImports: [
    'foam.ai.vector.CosineComparator',
    'foam.ai.vector.VectorEmbedding',
    'foam.ai.vector.VectorStoreDAO',
    'foam.core.ai.vector.ReadableSourcePredicate',
    'foam.core.bench.BenchmarkResult',
    'foam.core.logger.Loggers',
    'foam.dao.ArraySink',
    'foam.dao.DAO',
    'foam.dao.MDAO',
    'foam.dao.ProxyDAO',
    'foam.lang.X',
    'foam.mlang.MLang',
    'java.util.Random',
    'java.util.concurrent.atomic.AtomicLong'
  ],

  properties: [
    { class: 'Int',   name: 'chunkCount',      value: 100000 },
    { class: 'Int',   name: 'dim',             value: 384 },
    { class: 'Int',   name: 'relevantPercent', value: 1 },
    { class: 'Int',   name: 'readablePercent', value: 100 },
    { class: 'Double', name: 'minScore',       value: 0.25 },
    { class: 'Object', name: 'store',   javaType: 'foam.dao.DAO',  hidden: true, transient: true },
    { class: 'Object', name: 'records', javaType: 'foam.dao.DAO',  hidden: true, transient: true },
    { class: 'Object', name: 'finds',   javaType: 'java.util.concurrent.atomic.AtomicLong', hidden: true, transient: true },
    { class: 'Object', name: 'query',   javaType: 'float[]',       hidden: true, transient: true }
  ],

  methods: [
    {
      name: 'setup',
      args: 'X x, BenchmarkResult br',
      javaCode: `
        int    n    = getChunkCount();
        int    d    = getDim();
        Random rand = new Random(42);
        float[] q = new float[d];
        for ( int j = 0 ; j < d ; j++ ) q[j] = rand.nextFloat() - 0.5f;
        setQuery(unit_(q));

        MDAO chunks = new MDAO(VectorEmbedding.getOwnClassInfo());
        chunks.addIndex(VectorEmbedding.SOURCE_ID);
        setStore(new VectorStoreDAO.Builder(x).setDelegate(chunks).build());
        // stands in for the DAO of the indexed records: only the readable ones are in it
        MDAO held = new MDAO(VectorEmbedding.getOwnClassInfo());
        AtomicLong finds = new AtomicLong();
        setFinds(finds);
        setRecords(new ProxyDAO(x, held) {
          public foam.lang.FObject find_(X fx, Object id) { finds.incrementAndGet(); return super.find_(fx, id); }
        });

        for ( int i = 0 ; i < n ; i++ ) {
          boolean relevant = rand.nextInt(100) < getRelevantPercent();
          float[] v = new float[d];
          for ( int j = 0 ; j < d ; j++ ) v[j] = relevant ? q[j] + ( rand.nextFloat() - 0.5f ) / d : rand.nextFloat() - 0.5f;
          unit_(v);
          String id = String.valueOf(i);
          chunks.put(new VectorEmbedding.Builder(x).setId("noteDAO:" + id + ":0").setDaoKey("noteDAO").setSourceId(id)
            .setEmbeddingModel("bench").setText("chunk " + id).setVector(v).build());
          if ( rand.nextInt(100) < getReadablePercent() ) held.put(new VectorEmbedding.Builder(x).setId(id).build());
        }
        search_(x); // builds the packed index, so the timed searches measure the search alone
      `
    },
    {
      name: 'execute',
      args: 'X x',
      javaCode: `
        int  runs  = 5;
        getFinds().set(0);
        long start = System.nanoTime();
        int  found = 0;
        for ( int r = 0 ; r < runs ; r++ ) found = search_(x);
        long ms = ( System.nanoTime() - start ) / 1000000 / runs;
        Loggers.logger(x, this).warning("VectorStoreSearchBenchmark", "chunks", getChunkCount(), "dim", getDim(),
          "relevantPercent", getRelevantPercent(), "readablePercent", getReadablePercent(),
          "searchMs", ms, "recordLookups", getFinds().get() / runs, "found", found);
      `
    },
    {
      name: 'unit_',
      documentation: 'Scales v to length 1, as an embedding model returns it, so a dot product is a cosine.',
      type: 'float[]',
      args: 'float[] v',
      javaCode: `
        double len = 0;
        for ( float f : v ) len += f * f;
        len = Math.sqrt(len);
        for ( int j = 0 ; j < v.length ; j++ ) v[j] /= len;
        return v;
      `
    },
    {
      name: 'search_',
      type: 'Integer',
      documentation: 'The search ragService makes, as the user of x; returns how many chunks it found at or above minScore.',
      args: 'X x',
      javaCode: `
        X sx = x.put("noteDAO", getRecords());
        java.util.List found = ((ArraySink) getStore().inX(sx)
          .where(MLang.AND(
            MLang.IN(VectorEmbedding.DAO_KEY, new String[] { "noteDAO" }),
            MLang.EQ(VectorEmbedding.EMBEDDING_MODEL, "bench"),
            new ReadableSourcePredicate.Builder(sx).build()))
          .orderBy(new CosineComparator.Builder(sx).setQueryVector(getQuery()).setMinScore((float) getMinScore()).build())
          .limit(10)
          .select(new ArraySink())).getArray();
        int above = 0;
        for ( Object o : found ) if ( ((VectorEmbedding) o).getScore() >= getMinScore() ) above++;
        return above;
      `
    }
  ]
});
