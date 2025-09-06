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
    'foam.lang.FObject',
    'foam.lang.X',
    'foam.lang.XLocator',
    'foam.dao.ArraySink',
    'foam.dao.DAO',
    'foam.core.crunch.Capability',
    'foam.core.crunch.CapabilityJunctionPayload',
    'foam.core.crunch.CapabilityJunctionStatus',
    'foam.core.crunch.CrunchService',
    'foam.core.crunch.lite.Capable',
    'foam.core.crunch.lite.CapableAdapterDAO',
    'foam.core.session.Session',

    'java.util.List',
    'java.util.Arrays',

    'static foam.mlang.MLang.*',
    'static foam.core.crunch.CapabilityJunctionStatus.*'
  ],

  methods: [
    {
      name: 'applyAction',
      javaCode: `
      agency.submit(getX(), new ContextAwareAgent() {
        @Override
        public void execute(X x) {
          var payloadDAO = (DAO) getX().get("capablePayloadDAO");

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
          var newStatus = cap.getCapableChainedStatus(x, payloadDAO, payload);

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
