/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.store.test',
  name: 'FileStoreIndexTest',
  extends: 'foam.core.test.Test',

  javaImports: [
    'foam.core.auth.User',
    'foam.dao.DAO',
    'foam.dao.MDAO',
    'foam.dao.SequenceNumberDAO',
    'foam.dao.index.*',
    'foam.dao.store.*',
    'foam.lang.X',
    'foam.test.TestUtils'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
      x = TestUtils.createTestContext(x, "test");
      MDAO mdao = new MDAO(x, User.getOwnClassInfo(), "teststoreindex");
      mdao.addIndex(User.USER_NAME);
      DAO userDAO = new SequenceNumberDAO(mdao);
      x = x.put("userDAO", userDAO);

      User user1 = TestUtils.createTestUser("test");
      user1.setUserName("user1");
      user1 = (User) ((DAO) x.get("userDAO")).put(user1);
      test ( true, "validation");

      User user2 = TestUtils.createTestUser("test2");
      user2.setUserName("user2");
      user2 = (User) ((DAO) x.get("userDAO")).put(user2).fclone();
      user2.setLastName("test2test");
      user2 = (User) ((DAO) x.get("userDAO")).put(user2);
      user1 = (User) ((DAO) x.get("userDAO")).find(user1.getId());

      // recreate MDAO
      MDAO mdao2 = new MDAO(x, User.getOwnClassInfo(), "teststoreindex");
      User user = (User) mdao2.find(user1.getId());
      test ( user != null, "User1 found");
      if ( user != null ) {
        test ( user.getId() == user.getId(), "User1 id match");
      }
      user = (User) mdao2.find(user2.getId());
      test ( user != null, "User2 found");
      if ( user != null ) {
        test ( user.getId() == user2.getId(), "User2 id match");
        test ( user.getLastName().equals(user2.getLastName()), "User2 lastName match");
      }
      `
    }
  ]
});
