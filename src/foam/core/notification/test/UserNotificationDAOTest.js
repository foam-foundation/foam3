/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.notification.test',
  name: 'UserNotificationDAOTest',
  extends: 'foam.core.test.Test',

  documentation: 'Exersize test rules on UserNotificationDAO',

  javaImports: [
    'foam.core.auth.User',
    'foam.core.notification.*',
    'foam.core.ruler.RulerDAO',
    'foam.dao.DAO',
    'foam.dao.MDAO',
    'foam.lang.X',
    'foam.test.TestUtils'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
      User user = TestUtils.createTestUser("UserNotificationDAOTest");
      user.setUserName("UserNotificationDAOTest");
      user.setGroup("test");
      user = (User) ((DAO) x.get("userDAO")).put_(x, user);
      test ( user.getId() > 0, "user setup");

      DAO userNotificationDAO = new RulerDAO(x, new UserNotificationDAO(x, new MDAO(Notification.getOwnClassInfo())), "userNotificationDAO");

      String toastMessage = "UserNotificationDAOTest";
      String toastSubMessage = String.valueOf(user.getId());

      Notification notif = new Notification();
      notif.setId(user.getId());
      notif.setUserId(user.getId());

      notif = (Notification) userNotificationDAO.put_(x, notif);
      test ( notif != null, "Notification returned");
      if ( notif != null ) {
        test (notif.getToastMessage().equals(toastMessage), "Toast message set");
        test (notif.getToastSubMessage().equals(toastSubMessage), "Toast sub message set");
      }
      `
    }
  ]
});
