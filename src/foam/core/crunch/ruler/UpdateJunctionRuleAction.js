/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.crunch.ruler',
  name: 'UpdateJunctionRuleAction',

  documentation: 'Uses systemX to update an arbritary capability to the requested status, uses subject from current ucj in "new" obj',

  implements: [
    'foam.core.ruler.RuleAction'
  ],

  javaImports: [
    'foam.lang.ContextAgent',
    'foam.lang.X',
    'foam.dao.DAO',
    'foam.core.auth.User',
    'foam.core.auth.Subject',
    'foam.core.crunch.UserCapabilityJunction',
    'foam.core.crunch.CapabilityJunctionStatus',
    'foam.core.crunch.CrunchService',
    'foam.core.logger.Logger'
  ],

  properties: [
    {
      class: 'String',
      name: 'capability'
    },
    {
      class: 'Enum',
      of: 'foam.core.crunch.CapabilityJunctionStatus',
      name: 'status',
      javaFactory: `
        return foam.core.crunch.CapabilityJunctionStatus.GRANTED;
      `
    }
  ],

  methods: [
    {
      name: 'applyAction',
      javaCode: `
        agency.submit(x, new ContextAgent() {
          @Override
          public void execute(X x) {
            Logger logger = (Logger) x.get("logger");
            UserCapabilityJunction ucj = (UserCapabilityJunction) obj;
            CrunchService crunchService = (CrunchService) x.get("crunchService");
            User user = ucj.findSourceId(x);
            if ( foam.util.SafetyUtil.isEmpty(getCapability()) ) {
              logger.error("Capability is not provided");
              return;
            }
            crunchService.updateUserJunction(ruler.getX(), new Subject(user), getCapability(), null, getStatus());

          }
        }, "Update Capability Status");
      `
    }
  ]
})