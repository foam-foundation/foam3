/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ai.dataset',
  name: 'AlpacaSampleDeleteRuleAction',
  implements: ['foam.core.ruler.RuleAction'],

  javaImports: [
    'foam.ai.vector.VectorEmbedding',
    'foam.core.logger.Loggers',
    'foam.dao.DAO'
  ],

  methods: [
    {
      name: 'applyAction',
      args: 'Context x, foam.lang.FObject obj, foam.lang.FObject oldObj, foam.core.ruler.RuleEngine engine, foam.core.ruler.Rule rule, foam.lang.Agency agency',
      javaCode: `
        AlpacaSample sample    = (AlpacaSample) obj;
        var          logger    = Loggers.logger(x, this);
        DAO          vectorDAO = (DAO) getX().get("vectorStoreDAO");
        DAO          datasetDAO = (DAO) getX().get("datasetDAO");

        boolean hasEmbedding = vectorDAO != null && vectorDAO.find(sample.getId()) != null;

        if ( ! hasEmbedding ) {
          if ( datasetDAO != null ) {
            AlpacaSample updated = (AlpacaSample) sample.fclone();
            updated.setStatus(AlpacaSampleStatus.DISCARDED);
            datasetDAO.put(updated);
            logger.info("marked DISCARDED", "id", sample.getId());
          }
          throw new RuntimeException(
            "Sample " + sample.getId() + " has no embedding and cannot be permanently deleted. It has been marked as DISCARDED instead."
          );
        }

        // The datasetDAO.put() above triggers the update rule, but since only status
        // changes (not instruction/input/output), the update rule is a no-op.
        logger.info("delete allowed — embedding exists", "id", sample.getId());
      `
    }
  ]
});
