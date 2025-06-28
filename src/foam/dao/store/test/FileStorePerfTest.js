/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.store.test',
  name: 'FileStorePerfTest',
  extends: 'foam.core.test.Test',

  javaImports: [
    'foam.core.auth.User',
    'foam.core.logger.Logger',
    'foam.core.logger.Loggers',
    'static foam.mlang.MLang.EQ',
    'static foam.mlang.MLang.COUNT',
    'foam.mlang.sink.Count',
    'foam.core.pm.PM',
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
      int numUsers = 2000;
      Logger logger = Loggers.logger(x, this);
      x = TestUtils.createTestContext(x, "test");
      MDAO mdao = new MDAO(x, User.getOwnClassInfo(), "teststoreperf");
      mdao.addIndex(User.ID);
      mdao.addIndex(User.USER_NAME);
      DAO userDAO = new SequenceNumberDAO(mdao);
      x = x.put("userDAO", userDAO);
      userDAO = (DAO) x.get("userDAO");

      PM pm = new PM("FileStorePerfTest-create");
      for ( int i = 1; i <= numUsers; i++ ) {
        User user = new User();
        String s = String.valueOf(i);
        user.setFirstName(s);
        user.setLastName(s);
        user.setUserName(s);
        user.setGroup("test");
        user.setEmail(s+"@foamdev.com");
        user.setLifecycleState(foam.core.auth.LifecycleState.ACTIVE);
        userDAO.put(user);
        if ( i % 1000 == 0 ) {
          logger.info("created", i, "users,of",numUsers);
        }
      }
      pm.log(x);
      logger.info("created", numUsers, java.time.Duration.ofMillis(pm.getTime()));
      User user999 = (User) userDAO.find(EQ(User.USER_NAME, "999"));
      test( user999 != null, "M User 999 found by UserName "+user999.getUserName());
      user999 = (User) userDAO.find(user999.getId());
      test( user999 != null, "M User 999 found by Id "+user999.getId());

      pm = new PM("FileStorePerfTest-load");
      MDAO mdao2 = new MDAO(x, User.getOwnClassInfo(), "teststoreperf");
      pm.log(x);
      logger.info("loaded", numUsers, java.time.Duration.ofMillis(pm.getTime()));
      pm = new PM("FileStorePerfTest-index");
      mdao2.addIndex(User.ID);
      mdao2.addIndex(User.USER_NAME);
      logger.info("indexed", numUsers, java.time.Duration.ofMillis(pm.getTime()));
      Count count = (Count) mdao2.select(COUNT());
      test ( count.getValue() == numUsers, "Count correct " +count.getValue() );

      User user = (User) mdao2.find(user999.getId());
      test ( user != null, "F User 999 found by Id "+user999.getId());
      user = (User) mdao2.find(EQ(User.USER_NAME, user999.getUserName()));
      test ( user != null, "F User 999 found by UserName "+user999.getUserName());
      if ( user != null ) {
        test ( user.getId() == user999.getId(), "Id match "+user.getId()+"="+user999.getId());
        test ( user.getUserName().equals(user999.getUserName()), "UserName match "+user.getUserName()+"="+user999.getUserName());
      }
      `
    }
  ]
});
