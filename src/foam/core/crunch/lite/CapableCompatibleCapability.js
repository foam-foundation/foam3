/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.INTERFACE({
  package: 'foam.core.crunch.lite',
  name: 'CapableCompatibleCapability',

  javaImports: [
    'foam.dao.DAO',
    'foam.core.crunch.CapabilityJunctionStatus',
    'foam.core.crunch.CapabilityJunctionPayload'
  ],

  documentation: `
    This interface implements methods required the rules which apply to
    CapablePayload DAOs. For example, 'getPrereqsChainedStatus' as
    implemented by Capability or MinMaxCapability applies only to UCJ payloads,
    so a different method (getCapableChainedStatus) is needed.
  `,

  methods: [
    {
      name: 'getCapableChainedStatus',
      type: 'CapabilityJunctionStatus',
      args: 'Context x'
    }
  ]
});
