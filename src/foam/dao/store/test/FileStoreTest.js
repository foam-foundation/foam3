/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.store.test',
  name: 'FileStoreTest',
  extends: 'foam.core.test.Test',

  javaImports: [
    'foam.core.auth.User',
    'foam.dao.DAO',
    'foam.dao.store.*',
    'foam.lang.X',
    'foam.test.TestUtils'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
      x = TestUtils.createTestContext(x, "test");
      FileStore fs = new FileStore.Builder(x)
        .setFilename("testfilestore")
        .setOf(User.getOwnClassInfo())
         // set chunk size small so Root marker split between buffers.
        .setChunkBufferSize(40)
        .build();

      test ( fs.getRoot() == null, "Initial root null");

      User user1 = TestUtils.createTestUser("test");
      user1 = (User) ((DAO) x.get("userDAO")).put(user1);
      Stored root = fs.storeRoot(x, user1);
      test ( fs.getRoot() != null, "Memory Root found");
      if ( fs.getRoot() != null ) {
        User u = (User) fs.getRoot().get();
        test ( u.getId() == user1.getId(), "Memory User match");
      }
      try {
        fs.findRoot(x);
        test ( true, "findRoot passed");
      } catch (Throwable t) {
        test ( false, "findRoot failed. "+t.getMessage());
      }
      root = fs.load(x, fs.getRoot());
      test ( root != null, "File Root found");
      if ( root != null ) {
        User u = (User) root.get();
        test ( u.getId() == user1.getId(), "File User match");
      }
      `
    }
  ]
});
