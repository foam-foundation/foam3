/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.crunch.lite',
  name: 'CapabilityRefinement',
  refines: 'foam.core.crunch.Capability',

  javaImports: [
    'foam.dao.DAO',
    'foam.core.crunch.CapabilityJunctionPayload',
    'foam.core.crunch.CrunchService',
    'static foam.core.crunch.CapabilityJunctionStatus.*'
  ],

  implements: [
    'foam.core.crunch.lite.CapableCompatibleCapability'
  ],

  methods: [
    {
      name: 'getCapableChainedStatus',
      javaCode: `
        CrunchService crunchService = (CrunchService) x.get("crunchService");
        List<String> prereqCapIds = crunchService.getPrereqs(x, getId(), null);

        if ( prereqCapIds == null || prereqCapIds.size() == 0 ) return GRANTED;

        boolean isPending = false;

        DAO capablePayloadDAO = (DAO) x.get("capablePayloadDAO");
        for ( String capId : prereqCapIds ) {
          CapabilityJunctionPayload prereqPayload = (CapabilityJunctionPayload)
            capablePayloadDAO.find(capId);

          if ( prereqPayload == null ) {
            return ACTION_REQUIRED;
          }

          switch ( prereqPayload.getStatus() ) {
            case PENDING:
              isPending = true;
              continue;
            case GRANTED:
              continue;
            case REJECTED:
              return REJECTED;
            default:
              return ACTION_REQUIRED;
          }
        }

        return isPending ? PENDING : GRANTED;
      `
    }
  ]
});
