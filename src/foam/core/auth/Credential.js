/**
 * @license
 * Copyright 2023 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.auth',
  name: 'Credential',
  documentation: 'Model to represent a credential.',

  implements: [
    'foam.core.auth.CreatedAware',
    'foam.core.auth.CreatedByAware',
    'foam.core.auth.EnabledAware',
    'foam.core.auth.LastModifiedAware',
    'foam.core.auth.LastModifiedByAware',
    'foam.core.auth.ServiceProviderAware',
    'foam.core.security.KeyStoreAware'
  ],

  searchColumns: [
    'id',
    'type',
    'spid',
    'serviceName'
  ],

  tableColumns: [
    'id',
    'type',
    'spid',
    'serviceName',
    'useMock',
    'created'
  ],

  properties: [
    {
      class: 'String',
      name: 'id',
      order: 1,
      createVisibility: 'RW',
      readVisibility: 'RO',
      updateVisibility: 'RO',
    },
    {
      class: 'String',
      name: 'type',
      order: 2,
      visibility: 'RO',
      storageTransient: true,
      clusterTransient: true,
      getter: function() {
        return this.cls_.name;
      },
      javaGetter: `
        return getClass().getSimpleName();
      `
    },
    {
      class: 'Boolean',
      name: 'enabled',
      order: 3,
      value: true
    },
    {
      class: 'String',
      name: 'serviceName'
    },
    {
      class: 'String',
      name: 'url'
    },
    {
      class: 'String',
      name: 'username',
      includeInDigest: true
    },
    {
      class: 'String',
      name: 'password',
      includeInDigest: true
    },
    {
      class: 'Boolean',
      name: 'useMock'
    }
  ],

  methods: [
    {
      name: 'getPasswordSecret',
      type: 'String',
      args: 'Context x',
      javaCode: 'return resolveSecret(x, getPassword());'
    }
  ]
});
