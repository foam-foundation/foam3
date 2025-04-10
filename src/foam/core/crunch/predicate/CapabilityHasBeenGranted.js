/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.RULE_PREDICATE({
  package: 'foam.core.crunch.predicate',
  name: 'CapabilityHasBeenGranted',
  documentation: 'Checks if the capability has ever been granted',
  javaImports: [
    'foam.dao.DAO',
    'foam.core.crunch.Capability',
    'foam.core.crunch.CrunchService',
    'foam.core.crunch.UserCapabilityJunction',
    'static foam.core.crunch.CapabilityJunctionStatus.*',
  ],

  properties: [
    {
      name: 'capabilityId',
      class: 'String'
    },
    {
      name: 'subjectFromUCJ',
      class: 'Boolean',
      value: true,
      documentation: `
        When this property is true, CapabilityIsStatus expects a UCJ object in
        the context which it will use to determine the corresponding subject.
        Otherwise, the context is assumed to contain the appropriate subject.
      `
    }
  ],

  ruleF: `
    if ( getSubjectFromUCJ() ) {
      var newUCJ = (UserCapabilityJunction) n;
      if ( newUCJ != null ) {
        x = x.put("subject", newUCJ.getSubject(x));
      }
    }

    // Context requirements
    var crunchService = (CrunchService) x.get("crunchService");
    var capabilityDAO = (DAO)           x.get("capabilityDAO");

    // Verify that the capability exists
    Capability cap = (Capability) capabilityDAO.inX(x).find(getCapabilityId());
    if ( cap == null || cap.getLifecycleState() != foam.core.auth.LifecycleState.ACTIVE ) return false;

    var ucj = crunchService.getJunction(x, getCapabilityId());
    if ( ucj == null || ! ucj.getHasBeenGranted() ) return false;
    return true;
  `
});
