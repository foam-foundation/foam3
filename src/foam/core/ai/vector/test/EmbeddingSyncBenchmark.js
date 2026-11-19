/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ai.vector.test',
  name: 'EmbeddingSyncBenchmark',
  extends: 'foam.core.bench.Benchmark',

  documentation: `
    Times one EmbeddingSync run over rowCount records of an EmbeddingAware DAO,
    in one of four states:
      idle:    every record is EMBEDDED, so there is nothing to do;
      restart: every record is NEW and its stored chunks hold its text, as
               after a server restart, so no AI call is needed;
      sweep:   as restart, and 1 record in 100 was removed while the server
               was down, so its chunks are left with no record;
      first:   every record is NEW with no chunks, so each needs embedding.
    The stand-in embedder takes callMillis per call, like a round trip to a
    gateway. Logs one warning line with the run's time, the AI calls, the
    records still waiting and the chunks left with no record.
  `,

  javaImports: [
    'foam.ai.vector.EmbeddingAwareDAO',
    'foam.ai.vector.EmbeddingStatus',
    'foam.ai.vector.EmbeddingSync',
    'foam.ai.vector.VectorEmbedding',
    'foam.ai.vector.VectorStoreDAO',
    'foam.core.ai.vector.RAGIndexer',
    'foam.core.bench.BenchmarkResult',
    'foam.core.logger.Loggers',
    'foam.dao.DAO',
    'foam.dao.EasyDAO',
    'foam.dao.MDAO',
    'foam.dao.ProxyDAO',
    'foam.lang.PropertyInfo',
    'foam.lang.X',
    'foam.mlang.MLang'
  ],

  properties: [
    { class: 'String',  name: 'scenario', value: 'restart' },
    { class: 'Int',     name: 'rowCount', value: 100000 },
    { class: 'Int',     name: 'callMillis', value: 2 },
    {
      class: 'Boolean',
      name: 'indexSourceId',
      documentation: 'Whether the chunk store has an index on sourceId, as vectorStoreDAO has in services.jrl.'
    }
  ],

  methods: [
    {
      name: 'setup',
      args: 'X x, BenchmarkResult br',
      javaCode: '// each execute builds its own records, so every run starts from the same state'
    },
    {
      name: 'execute',
      args: 'X x',
      javaCode: `
        final boolean[] slow = { false };
        final int       wait = getCallMillis();
        RAGTest.Embedder fake = new RAGTest.Embedder() {
          public VectorEmbedding[] embedAll(X x, String[] texts) {
            if ( slow[0] && wait > 0 ) {
              try { Thread.sleep(wait); } catch ( InterruptedException e ) { Thread.currentThread().interrupt(); }
            }
            return super.embedAll(x, texts);
          }
        };
        MDAO mdao = new MDAO(VectorEmbedding.getOwnClassInfo());
        if ( getIndexSourceId() ) mdao.addIndex(VectorEmbedding.SOURCE_ID);
        DAO           store = new VectorStoreDAO.Builder(x).setDelegate(mdao).build();
        // times one sync over every waiting record, so the saves below start none
        EmbeddingSync sync  = new EmbeddingSync.Builder(x).setEmbedOnSave(false).build();
        X             tx    = x.put("vectorStoreDAO", store).put("embeddingService", fake).put("embeddingSync", sync);
        DAO           notes = new EasyDAO.Builder(tx).setOf(RAGNote.getOwnClassInfo()).setName("noteDAO").setAuthorize(false).build().inX(tx);

        String  scenario = getScenario();
        int     n        = getRowCount();
        RAGIndexer indexer = new RAGIndexer();
        for ( int i = 0 ; i < n ; i++ ) {
          RAGNote d = RAGTest.note("n" + i, "alpha " + i + "\\n\\n## More\\n\\nbeta " + i);
          if ( ! "first".equals(scenario) ) indexer.index(tx, "noteDAO", d);
          notes.put(d);
        }
        if ( "idle".equals(scenario) ) sync.sync(tx);
        if ( "sweep".equals(scenario) ) {
          // removed below the decorator, as a record dropped from a journal while the server was down
          DAO dao = (DAO) ((ProxyDAO) notes).getDelegate();
          while ( ! ( dao instanceof EmbeddingAwareDAO ) ) dao = ((ProxyDAO) dao).getDelegate();
          DAO below = ((EmbeddingAwareDAO) dao).getDelegate();
          for ( int i = 0 ; i < n ; i += 100 ) below.remove(below.find("n" + i));
        }

        slow[0]    = true;
        fake.calls = 0;
        long start = System.nanoTime();
        sync.sync(tx);
        long ms    = ( System.nanoTime() - start ) / 1000000;

        long orphans = 0;
        if ( "sweep".equals(scenario) ) {
          for ( int i = 0 ; i < n ; i += 100 ) orphans += RAGTest.chunksOf(store, "n" + i);
        }
        PropertyInfo status = (PropertyInfo) RAGNote.getOwnClassInfo().getAxiomByName("embeddingStatus");
        long waiting = RAGTest.count(notes, MLang.OR(MLang.EQ(status, EmbeddingStatus.NEW), MLang.EQ(status, EmbeddingStatus.DIRTY)));
        Loggers.logger(x, this).warning("EmbeddingSyncBenchmark", scenario, "rows", n, "indexSourceId", getIndexSourceId(),
          "ms", ms, "calls", fake.calls, "waiting", waiting, "orphans", orphans);
      `
    }
  ]
});
