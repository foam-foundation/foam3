/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.store.test',
  name: 'FileStoreIndexTest',
  extends: 'foam.dao.store.test.StoreTestModelPerfTest',

  methods: [
    {
      name: 'setup',
      args: 'Context x',
      javaCode: `
      num = 10;
      `
    }
  ]
});
