/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.crunch.lite.ruler',
  name: 'ReputDependantPayloads',

  implements: [
    'foam.core.ruler.RuleAction',
  ],

  javaImports: [
    'foam.lang.ContextAwareAgent',
    'foam.lang.X',
    'foam.lang.XLocator',
    'foam.dao.DAO',
    'foam.core.crunch.CrunchService',
    'foam.core.crunch.CapabilityJunctionPayload'
  ],

  methods: [
    {
      name: 'applyAction',
      javaCode: `
        agency.submit(x, new ContextAwareAgent() {
          @Override
          public void execute(X x) {
            CapabilityJunctionPayload old = (CapabilityJunctionPayload) oldObj;
            CapabilityJunctionPayload payload = (CapabilityJunctionPayload) obj;

            // Do not reput unless payload status changes
            if ( old != null && old.getStatus() == payload.getStatus() ) return;

            var payloadDAO = (DAO) getX().get("capablePayloadDAO");

            var crunchService = (CrunchService) x.get("crunchService");
            var depIds = crunchService.getDependentIds(XLocator.get(), payload.getCapability());

            // Reput dependent payloads to refresh their statuses. See SetCapablePayloadStatusOnPut.
            for ( var capId : depIds ) {
              var dep = (CapabilityJunctionPayload) payloadDAO.find(capId);
              if ( dep != null ) {
                payloadDAO.put(dep);
              }
            }
          }
        }, "Reput dependent payloads");
      `,
    }
  ]
});
