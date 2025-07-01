/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.store.test',
  name: 'StoreTestModel',

  implements: [
    'foam.core.auth.CreatedAware'
  ],

  properties: [
    {
      name: 'id',
      class: 'Long',
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO',
      readVisibility: 'RO'
    },
    {
      name: 'name',
      class: 'String',
      shortName: 'n'
    },
    {
      name: 'data',
      class: 'String',
      shortName: 'd'
    },
    {
      name: 'storageTransientData',
      class: 'String',
      storageTransient: true
    },
    {
      name: 'created',
      shortName: 'c',
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO',
      readVisibility: 'RO'
    }
  ]
});
