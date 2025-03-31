/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.crunch.lite',
  name: 'CapableObjectDataProperties',

  properties: [
    {
      name: 'capablePayloads',
      class: 'FObjectArray',
      // javaType: 'java.util.List<foam.core.crunch.crunchlite.CapablePayload>',
      of: 'foam.core.crunch.CapabilityJunctionPayload',
      columnPermissionRequired: true,
      section: 'capabilityInformation',
      autoValidate: true,
      externalTransient: true,
      createVisibility: 'HIDDEN',
      readVisibility: 'RO',
      updateVisibility: 'RO'
    },
    {
      name: 'userCapabilityRequirements',
      class: 'StringArray',
      columnPermissionRequired: true,
      section: 'capabilityInformation',
      externalTransient: true,
      createVisibility: 'HIDDEN',
      readVisibility: 'RO',
      updateVisibility: 'RO'
    },
    {
      name: 'isWizardIncomplete',
      class: 'Boolean',
      section: 'systemInformation',
      columnPermissionRequired: true,
      transient: true,
      externalTransient: true,
      visibility: 'HIDDEN'
    },
    {
      class: 'StringArray',
      name: 'capabilityIds',
      columnPermissionRequired: true,
      section: 'capabilityInformation',
      externalTransient: true,
      createVisibility: 'HIDDEN',
      readVisibility: 'RO',
      updateVisibility: 'RO'
    },
    {
      class: 'String',
      name: 'DAOKey',
      columnPermissionRequired: true,
      section: 'capabilityInformation',
      externalTransient: true,
      visibility: 'HIDDEN'
    }
  ]
});


foam.CLASS({
  package: 'foam.core.crunch.lite',
  name: 'CapableObjectData',

  imports: [
    'auth?',
    'crunchController?'
  ],

  mixins: [ 'foam.core.crunch.lite.CapableObjectDataProperties' ],

  methods: [
    {
      // TODO: investigate why this default implementation doesn't
      //   work when put in the Capable interface itself; this
      //   behaviour works with mlang.Expressions so it's odd that
      //   it doesn't work for this case.
      name: 'setRequirements',
      flags: [ 'java' ],
      args: 'String[] capabilityIds',
      code: function(capabilityIds) {
        this.capabilityIds = capabilityIds;
      },
      javaCode: 'setCapabilityIds(capabilityIds);'
    },
    {
      name: 'getCapablePayloadDAO',
      flags: ['web'],
      code: function () {
        return this.CapableAdapterDAO.create({capable: this});
      }
    }
  ],

  actions: [
    {
      name: 'openCapableWizard',
      isAvailable: auth => {
        return auth?.check(null, 'developer.capableObjectData.openCapableWizard');
      },
      code: async function () {
        if ( ! this.crunchController ) return;
        for ( const capabilityId of this.capabilityIds ) {
          const seq = this.crunchController.createCapableWizardSequence(
            undefined, this, capabilityId
          );
          await seq.execute();
        }
      }
    }
  ]
});

foam.CLASS({
  package: 'foam.core.crunch.lite',
  name: 'BaseCapable',

  flags: [ 'java' ],

  implements: [
    'foam.core.crunch.lite.Capable'
  ],
  mixins: [
    'foam.core.crunch.lite.CapableObjectData'
  ]
});
