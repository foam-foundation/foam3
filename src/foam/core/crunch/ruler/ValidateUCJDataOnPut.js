/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.crunch.ruler',
  name: 'ValidateUCJDataOnPut',

  implements: [
    'foam.core.ruler.RuleAction'
  ],

  javaImports: [
    'foam.lang.ContextAgent',
    'foam.lang.FObject',
    'foam.lang.X',
    'foam.core.auth.Subject',
    'foam.core.auth.User',
    'foam.core.crunch.AgentCapabilityJunction',
    'foam.core.crunch.Capability',
    'foam.core.crunch.CapabilityGrantMode',
    'foam.core.crunch.CapabilityJunctionStatus',
    'foam.core.crunch.UserCapabilityJunction',
    'foam.core.logger.Logger'
  ],

  methods: [
    {
      name: 'applyAction',
      javaCode: `
        agency.submit(x, new ContextAgent() {
          X systemX = ruler.getX();
          @Override
          public void execute(X x) {
            UserCapabilityJunction ucj = (UserCapabilityJunction) obj;

            Logger logger = (Logger) x.get("logger");
            logger.debug("ValidateUCJDataOnPut", "start", ucj);

            try {
              boolean isRenewable = ucj.getIsRenewable(); // ucj either expired, in grace period, or in renewal period
              // When requesting reset, just set the status to ACTION_REQUIRED and return
              if ( ucj.getRequestingReset() ) {
                ucj.setStatus(CapabilityJunctionStatus.ACTION_REQUIRED);
                ucj.setData(null);
                ucj.setRequestingReset(false);
                return;
              }
              // this should never happen since ucj data should be frozen on pending or approved
              // and data change is a predicate of this rule
              if ( ucj.getStatus() == CapabilityJunctionStatus.PENDING || ucj.getStatus() == CapabilityJunctionStatus.APPROVED )
                return;
  
              Capability capability = (Capability) ucj.findTargetId(systemX);
  
              if ( capability.getGrantMode() != CapabilityGrantMode.AUTOMATIC ) {
                return;
              }
              if ( ! isRenewable ) {
                ucj.setStatus(CapabilityJunctionStatus.ACTION_REQUIRED);
              }
  
              if ( capability.getOf() == null ) {
                ucj.setStatus(CapabilityJunctionStatus.PENDING);
                return;
              }
  
              FObject data = ucj.getData();
  
              if ( data == null ) data = capability.getImpliedData(x, ucj);
  
              if ( data != null ) {
                try {
                  Subject subject = ucj.getSubject(x);
                  X sourceX = (X) x.put("subject", subject);
  
                  data.validate(sourceX);
                  ucj.setStatus(CapabilityJunctionStatus.PENDING);
                } catch (Throwable e) {
                  logger.warning("Validation failed", e.getMessage(), ucj.toString());
                }
              }
            } finally {
              logger.debug("ValidateUCJDataOnPut", "end", ucj);
            }
          }
        }, "validate ucj data on put");
      `
    },
  ]
});
