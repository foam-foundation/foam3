/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.crunch.lite.ruler',
  name: 'SetCapablePayloadStatusOnPut',

  implements: [
    'foam.core.ruler.RuleAction',
  ],

  javaImports: [
    'foam.lang.ContextAwareAgent',
    'foam.lang.X',
    'foam.dao.DAO',
    'foam.core.crunch.Capability',
    'foam.core.crunch.CapabilityJunctionPayload',
    'foam.core.crunch.CapabilityJunctionStatus',

    'static foam.core.crunch.CapabilityJunctionStatus.*'
  ],

  methods: [
    {
      name: 'applyAction',
      javaCode: `
      agency.submit(x, new ContextAwareAgent() {
        @Override
        public void execute(X x) {
          CapabilityJunctionPayload payload = (CapabilityJunctionPayload) obj;

          CapabilityJunctionStatus defaultStatus = PENDING;

          try {
            payload.validate(x);
            payload.setStatus(defaultStatus);
          } catch ( Exception e ) {
            payload.setStatus(ACTION_REQUIRED);
            return;
          }

          DAO capabilityDAO = (DAO) x.get("capabilityDAO");
          Capability cap = (Capability) capabilityDAO.find(payload.getCapability());
          var oldStatus = payload.getStatus();
          var newStatus = cap.getCapableChainedStatus(getX());

          // if payload is validated, use the capableChainedStatus
          // otherwise, use ACTION_REQUIRED
          if ( oldStatus == PENDING ) {
            payload.setStatus(newStatus);
          }
        }
      }, "Set capable payload status on put");
      `,
    }
  ]
});
