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
    'static foam.mlang.MLang.EQ',
    'static foam.mlang.MLang.COUNT',
    'foam.mlang.sink.Count',
    'foam.test.TestUtils'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
      x = TestUtils.createTestContext(x, "test");
      MDAO mdao = new MDAO(x, User.getOwnClassInfo(), "teststoreindex");
      mdao.addIndex(User.ID);
      mdao.addIndex(User.USER_NAME);
      DAO userDAO = new SequenceNumberDAO(mdao);
      x = x.put("userDAO", userDAO);

      User user1 = TestUtils.createTestUser("test");
      user1.setUserName("user1");
      user1 = (User) ((DAO) x.get("userDAO")).put(user1);
      user1 = (User) ((DAO) x.get("userDAO")).find(user1.getId());
      test ( user1 != null, "M User1 found by Id " + user1.getId());
      user1 = (User) mdao.find(EQ(User.USER_NAME, "user1"));
      test ( user1 != null, "M User1 found by UserName " + (user1 != null ? user1.getId() + ", " + user1.getUserName() : ""));

      User user2 = TestUtils.createTestUser("test2");
      user2.setUserName("user2");
      user2 = (User) ((DAO) x.get("userDAO")).put(user2).fclone();
      user2.setLastName("test2test");
      user2 = (User) ((DAO) x.get("userDAO")).put(user2);
      user2 = (User) ((DAO) x.get("userDAO")).find(user2.getId());
      test ( user2 != null, "M User2 found by Id " + user1.getId());

      user1 = (User) ((DAO) x.get("userDAO")).find(user1.getId());
      test ( user1 != null, "M User1 found by Id " + user1.getId());

      // recreate MDAO
      MDAO mdao2 = new MDAO(x, User.getOwnClassInfo(), "teststoreindex");
      mdao2.addIndex(User.ID);
      mdao2.addIndex(User.USER_NAME);
      User user = (User) mdao2.find(EQ(User.USER_NAME, "user1"));
      test ( user != null, "F User1 found by UserName " + (user != null ? user.getUserName() : ""));
      user = (User) mdao2.find(user1.getId());
      test ( user != null, "F User1 found by Id "+user.getId()); // + ", " + user.getUserName());
      if ( user != null ) {
        test ( user.getId() == user1.getId(), "F User1 id match "+ user.getId());
      }
      user = (User) mdao2.find(user2.getId());
      test ( user != null, "F User2 found by Id " + user2.getId());
      user = (User) mdao2.find(EQ(User.USER_NAME, user2.getUserName()));
      test ( user != null, "F User2 found by UserName " + (user2 != null ? user2.getUserName() : ""));
      if ( user != null ) {
        test ( user.getId() == user2.getId(), "F User2 id match");
        test ( user.getLastName().equals(user2.getLastName()), "F User2 lastName match");
      }
      `
    }
  ]
});
