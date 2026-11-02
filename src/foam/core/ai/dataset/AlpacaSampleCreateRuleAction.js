/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ai.dataset',
  name: 'AlpacaSampleCreateRuleAction',
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
        AlpacaSample sample  = (AlpacaSample) obj;
        var          logger  = Loggers.logger(x, this);

        sample.setStatus(AlpacaSampleStatus.NEW);

        EmbeddingService embedder  = (EmbeddingService) getX().get("embeddingService");
        DAO              vectorDAO = (DAO)              getX().get("vectorStoreDAO");
        DAO              datasetDAO = (DAO)             getX().get("datasetDAO");

        if ( embedder == null || vectorDAO == null ) {
          logger.warning("embeddingService or vectorStoreDAO not in context — sample stays NEW");
          return;
        }

        VectorEmbedding candidate;
        try {
          candidate = embedder.embed(x, sample.getInstruction());
          logger.debug("embedded", "dims", candidate.getVector().length);
        } catch ( Exception e ) {
          logger.warning("embedding failed, sample stays NEW", e);
          return;
        }

        List results = ((ArraySink) vectorDAO
          .orderBy(new foam.ai.vector.CosineComparator.Builder(x).setQueryVector(candidate.getVector()).build())
          .limit(1)
          .select(new ArraySink())).getArray();

        if ( ! results.isEmpty() ) {
          VectorEmbedding nearest = (VectorEmbedding) results.get(0);
          logger.debug("nearest-neighbour", "sourceId", nearest.getSourceId(), "score", nearest.getScore());

          if ( nearest.getScore() >= SIMILARITY_THRESHOLD ) {
            if ( datasetDAO != null ) {
              AlpacaSample original = (AlpacaSample) datasetDAO.find(nearest.getSourceId());
              if ( original != null ) {
                AlpacaSample updated = (AlpacaSample) original.fclone();
                updated.setRelevance(original.getRelevance() + 1);
                datasetDAO.put(updated);
                logger.debug("incremented relevance", "id", original.getId(), "relevance", updated.getRelevance());
              }
            }
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
        // Synchronous put — status=CREATED must only be set after the embedding is durably stored.
        // Using agency.submit would make the vectorStore write asynchronous, so the sample would
        // be persisted as CREATED before the embedding exists, breaking the NEW→CREATED invariant.
        vectorDAO.put(candidate);

        sample.setStatus(AlpacaSampleStatus.CREATED);
        logger.debug("indexed and marked CREATED", "id", sample.getId());
      `
    }
  ]
});
