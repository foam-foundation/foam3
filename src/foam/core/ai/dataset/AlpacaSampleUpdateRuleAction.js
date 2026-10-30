/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ai.dataset',
  name: 'AlpacaSampleUpdateRuleAction',
  implements: ['foam.core.ruler.RuleAction'],

  javaImports: [
    'foam.core.logger.Loggers'
  ],

  methods: [
    {
      name: 'applyAction',
      args: 'Context x, foam.lang.FObject obj, foam.lang.FObject oldObj, foam.core.ruler.RuleEngine engine, foam.core.ruler.Rule rule, foam.lang.Agency agency',
      javaCode: `
        AlpacaSample sample = (AlpacaSample) obj;
        AlpacaSample old    = (AlpacaSample) oldObj;
        var          logger = Loggers.logger(x, this);

        if ( old == null ) return;
        if ( sample.getStatus() == AlpacaSampleStatus.DISCARDED ) return;

        boolean contentChanged =
          ! sample.getInstruction().equals(old.getInstruction()) ||
          ! sample.getInput()      .equals(old.getInput())       ||
          ! sample.getOutput()     .equals(old.getOutput());

        if ( contentChanged ) {
          sample.setStatus(AlpacaSampleStatus.DIRTY);
          sample.setReviewed(false);
          logger.info("marked DIRTY", "id", sample.getId());
        }
      `
    }
  ]
});
