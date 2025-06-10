/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.store',
  name: 'MemoryStore',
  implements: [ 'foam.dao.store.Store' ],

  documentation: '',

  methods: [
    {
      name: 'storeRoot',
      javaCode: `
        setRoot(store(x, obj));
        return getRoot();
      `
    },
    {
      name: 'store',
      javaCode: `
        return new MemoryStored(obj);
      `
    },
  ],

  classes: [
    {
      name: 'MemoryStored',
      implements: [ 'foam.dao.store.Stored' ]
    }
  ]
});
