/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ai.vector.test',
  name: 'VectorStoreMemoryBenchmark',
  extends: 'foam.core.bench.Benchmark',

  documentation: `
    Measures what a VectorStoreDAO of chunkCount chunks costs: the heap its
    chunks take, the heap its packed search index adds, and how long a search
    takes. Each chunk holds a vector of dim floats and textChars characters of
    text, as a chunk of a markdown section does. The heap is read after a
    garbage collection, so the sizes are close, not exact. Logs one warning
    line with the numbers.
  `,

  javaImports: [
    'foam.ai.vector.CosineComparator',
    'foam.ai.vector.VectorEmbedding',
    'foam.ai.vector.VectorStoreDAO',
    'foam.core.bench.BenchmarkResult',
    'foam.core.logger.Loggers',
    'foam.dao.ArraySink',
    'foam.dao.DAO',
    'foam.dao.MDAO',
    'foam.lang.X',
    'java.util.Random'
  ],

  properties: [
    { class: 'Int', name: 'chunkCount', value: 100000 },
    { class: 'Int', name: 'dim',        value: 384 },
    { class: 'Int', name: 'textChars',  value: 800 }
  ],

  methods: [
    {
      name: 'setup',
      args: 'X x, BenchmarkResult br',
      javaCode: '// execute builds its own store, so the heap it reads holds nothing else of the run'
    },
    {
      name: 'execute',
      args: 'X x',
      javaCode: `
        int    n    = getChunkCount();
        int    d    = getDim();
        Random rand = new Random(42);
        StringBuilder sb = new StringBuilder();
        while ( sb.length() < getTextChars() ) sb.append("alpha beta gamma delta ");
        String text = sb.substring(0, getTextChars());

        long before = usedHeap_();
        MDAO mdao = new MDAO(VectorEmbedding.getOwnClassInfo());
        mdao.addIndex(VectorEmbedding.SOURCE_ID);
        DAO store = new VectorStoreDAO.Builder(x).setDelegate(mdao).build();
        for ( int i = 0 ; i < n ; i++ ) {
          float[] v = new float[d];
          for ( int j = 0 ; j < d ; j++ ) v[j] = rand.nextFloat() - 0.5f;
          // each chunk gets its own text, as real chunks do, so no String is shared
          store.put(new VectorEmbedding.Builder(x)
            .setId("noteDAO:" + i + ":0").setDaoKey("noteDAO").setSourceId(String.valueOf(i))
            .setEmbeddingModel("bench").setText(new String(text.toCharArray())).setVector(v).build());
        }
        long chunks = usedHeap_() - before;

        float[] q = new float[d];
        for ( int j = 0 ; j < d ; j++ ) q[j] = rand.nextFloat() - 0.5f;
        long start = System.nanoTime();
        search_(x, store, q);
        long firstMs = ( System.nanoTime() - start ) / 1000000;
        long packed  = usedHeap_() - before - chunks;

        int  runs = 5;
        start = System.nanoTime();
        for ( int r = 0 ; r < runs ; r++ ) search_(x, store, q);
        long searchMs = ( System.nanoTime() - start ) / 1000000 / runs;

        Loggers.logger(x, this).warning("VectorStoreMemoryBenchmark", "chunks", n, "dim", d, "textChars", getTextChars(),
          "chunksMB", chunks / 1048576, "packedIndexMB", packed / 1048576, "bytesPerChunk", ( chunks + packed ) / n,
          "firstSearchMs", firstMs, "searchMs", searchMs);
        store.removeAll();
      `
    },
    {
      name: 'search_',
      documentation: 'The 10 nearest chunks to q, as ragService asks for them.',
      args: 'X x, foam.dao.DAO store, float[] q',
      javaCode: `
        store.orderBy(new CosineComparator.Builder(x).setQueryVector(q).build()).limit(10).select(new ArraySink());
      `
    },
    {
      name: 'usedHeap_',
      type: 'Long',
      javaCode: `
        Runtime rt = Runtime.getRuntime();
        for ( int i = 0 ; i < 3 ; i++ ) {
          System.gc();
          try { Thread.sleep(200); } catch ( InterruptedException e ) { Thread.currentThread().interrupt(); }
        }
        return rt.totalMemory() - rt.freeMemory();
      `
    }
  ]
});
