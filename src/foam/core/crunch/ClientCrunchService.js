/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.crunch',
  name: 'ClientCrunchService',

  implements: [
    'foam.mlang.Expressions',
    'foam.core.crunch.CrunchService'
  ],

  requires: [
    'foam.core.crunch.CapabilityJunctionStatus'
  ],

  imports: [
    'crunchService',
    'subject',
    'userCapabilityJunctionDAO'
  ],


  properties: [
    {
      class: 'Stub',
      of: 'foam.core.crunch.CrunchService',
      name: 'delegate'
    }
  ],

  methods: [
    {
      name: 'updateJunction',
      code: async function(x, capabilityId, data, status) {
        let ucj = await this.crunchService.getJunction(x, capabilityId);


        if ( data != null ) {
          ucj.data = data;
        }
        if ( status != null ) {
          ucj.status = status;
        } else if ( ucj.status == 'EXPIRED' ) {
          // Assume that when the client submits a expired UCJ they are trying to update it
          ucj.status = 'ACTION_REQUIRED';
        }

        ucj.lastUpdatedRealUser = this.subject.realUser.id;
        return await this.userCapabilityJunctionDAO.put(ucj);
      }
    }
  ]
});
