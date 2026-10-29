/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ai.dataset',
  name: 'AlpacaSampleDedupeRuleAction',
  implements: ['foam.core.ruler.RuleAction'],


  javaImports: [
    'foam.ai.vector.EmbeddingService',
    'foam.ai.vector.VectorEmbedding',
    'foam.core.logger.Loggers',
    'foam.dao.ArraySink',
    'foam.dao.DAO',
    'java.util.List'
  ],

  constants: [
    {
      name: 'SIMILARITY_THRESHOLD',
      type: 'Float',
      value: 0.92,
      javaValue: '0.92f'
    }
  ],

  methods: [
    {
      name: 'applyAction',
      args: 'Context x, foam.lang.FObject obj, foam.lang.FObject oldObj, foam.core.ruler.RuleEngine engine, foam.core.ruler.Rule rule, foam.lang.Agency agency',
      javaCode: `
        AlpacaSample sample = (AlpacaSample) obj;
        var logger = Loggers.logger(x, this);
        logger.debug("AlpacaSampleDedupeRuleAction: invoked", "id", sample.getId(), "instruction", sample.getInstruction());


        EmbeddingService embedder  = (EmbeddingService) getX().get("embeddingService");
        DAO              vectorDAO = (DAO)              getX().get("vectorStoreDAO");

        if ( embedder == null || vectorDAO == null ) {
          logger.warning("AlpacaSampleDedupeRuleAction: embeddingService or datasetVectorDAO not in context — skipping dedup");
          return;
        }

        VectorEmbedding candidate;
        try {
          candidate = embedder.embed(x, sample.getInstruction());
          logger.debug("AlpacaSampleDedupeRuleAction:embedded", "dims", candidate.getVector().length);
        } catch ( Exception e ) {
          logger.warning("embedding failed, skipping dedup", e);
          return;
        }

        List results = ((ArraySink) vectorDAO
          .orderBy(new foam.ai.vector.CosineComparator.Builder(x).setQueryVector(candidate.getVector()).build())
          .limit(1)
          .select(new ArraySink())).getArray();

        if ( ! results.isEmpty() ) {
          VectorEmbedding nearest = (VectorEmbedding) results.get(0);
          logger.debug("AlpacaSampleDedupeRuleAction: nearest-neighbour", "sourceId", nearest.getSourceId(), "score", nearest.getScore());
          if ( nearest.getScore() >= SIMILARITY_THRESHOLD ) {
            logger.info("vetoed-duplicate", "id", sample.getId(), "nearestId", nearest.getSourceId(), "score", nearest.getScore());
            throw new RuntimeException(
              "Duplicate sample: instruction is too similar to existing sample " + nearest.getSourceId() +
              " (similarity=" + String.format("%.3f", nearest.getScore()) + ", threshold=" + SIMILARITY_THRESHOLD + ")"
            );
          }
        }

        candidate.setId(sample.getId());
        candidate.setDaoKey("datasetDAO");
        candidate.setSourceId(sample.getId());
        candidate.setText(sample.getInstruction());
        candidate.setKind("alpaca");
        final VectorEmbedding toStore = candidate;
        agency.submit(x, agentX -> {
          ((DAO) agentX.get("vectorStoreDAO")).put(toStore);
          logger.debug("AlpacaSampleDedupeRuleAction: indexed", "id", sample.getId());
        }, "dedupe-index-" + sample.getId());
      `
    }
  ]
});
