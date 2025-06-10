/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.INTERFACE({
  package: 'foam.dao.store',
  name: 'Store',

  properties: [
    {
      name: 'root',
      class: 'FObjectProperty',
      of: 'foam.dao.store.Stored'
    }
  ],

  methods: [
    {
      name: 'storeRoot',
      args: 'Context x, foam.lang.FObject obj',
      type: 'Stored'
    },
    {
      name: 'store',
      args: 'Context x, foam.lang.FObject obj',
      type: 'Stored'
    }
  ]
});
