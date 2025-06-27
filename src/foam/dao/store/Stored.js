/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.INTERFACE({
  package: 'foam.dao.store',
  name: 'Stored',

  properties: [
    {
      name: 'object',
      class: 'FObjectProperty',
      storageTransient: true
    }
  ],

  methods: [
    {
      name: 'get',
      type: 'foam.lang.FObject',
      javaCode: `
        return getObject();
      `
    }
  ]
});
