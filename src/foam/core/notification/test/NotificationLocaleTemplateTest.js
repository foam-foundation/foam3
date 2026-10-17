/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.notification.test',
  name: 'NotificationLocaleTemplateTest',
  extends: 'foam.core.test.Test',

  documentation: 'Test title and body locale template replacement',

  javaImports: [
    'foam.core.auth.User',
    'foam.core.auth.LanguageId',
    'foam.core.notification.Notification',
    'foam.core.notification.NotificationLocaleTemplateSupport',
    'foam.dao.DAO',
    'foam.lang.X',
    'static foam.mlang.MLang.EQ',
    'foam.test.TestUtils',
    'java.util.HashMap',
    'java.util.Map'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
      DAO userDAO = (DAO) x.get("userDAO");
      User old = (User) userDAO.find(185426801L).fclone();
      User user = (User) old.fclone();
      user.setLanguage(new LanguageId("pt", "BR"));
      user = (User) userDAO.put(user);
      String notificationLocaleTemplate = "NotificationLocaleTemplateTest-pt";

      DAO notificationDAO = (DAO) x.get("notificationDAO");
      notificationDAO.removeAll();

      Notification notification = new Notification();
      notification.setLocaleTemplateName(notificationLocaleTemplate);
      Map map = new HashMap<String, String>();
      Map localeMappings = new HashMap<String, String>();
      String name = "User";
      map.put("arg1", name);
      map.put("arg2", name);
      map.put("toastMessage", name);
      notification.setEmailArgs(map);
      notification.setUserId(user.getId());
      ((DAO) x.get("notificationDAO")).put_(x, notification);

      try {
        Thread.sleep(100L);
      } catch (InterruptedException e ) {
        // ignore - nop
      }

      notification = (Notification) notificationDAO.find(EQ(Notification.USER_ID, user.getId()));
      test ( notification != null, "(User) Notification found");
      if ( notification != null ) {
        test ( notification.getBody() != null &&
               notification.getBody().equals("Body "+name+"\\\\nline2 "+name),
               "(User) Body set: "+notification.getBody());
        test ( notification.getToastMessage() != null &&
               notification.getToastMessage().equals("ToastMessage "+name),
               "(User) ToastMessage set: "+notification.getToastMessage());
      }

      notificationDAO.removeAll();
      DAO userNotificationDAO = (DAO) x.get("userNotificationDAO");
      userNotificationDAO.removeAll();

      name = "Group";
      map.put("arg1", name);
      map.put("arg2", name);
      map.put("toastMessage", name);
      notification = new Notification();
      notification.setLocaleTemplateName(notificationLocaleTemplate);
      notification.setEmailArgs(map);
      notification.setGroupId("test");
      ((DAO) x.get("notificationDAO")).put_(x, notification);

      try {
        Thread.sleep(100L);
      } catch (InterruptedException e ) {
        // ignore - nop
      }

      notification = (Notification) userNotificationDAO.find(EQ(Notification.USER_ID, user.getId()));
      test ( notification != null, "(Group) Notification found");
      if ( notification != null ) {
        test ( notification.getBody() != null &&
               notification.getBody().equals("Body "+name+"\\\\nline2 "+name),
               "(Group) Body set: "+notification.getBody());
        test ( notification.getToastMessage() != null &&
               notification.getToastMessage().equals("ToastMessage "+name),
               "(Group) ToastMessage set: "+notification.getToastMessage());
      }


      userNotificationDAO.removeAll();

      name = "Broadcast";
      map.put("arg1", name);
      map.put("arg2", name);
      map.put("toastMessage", name);
      notification = new Notification();
      notification.setLocaleTemplateName(notificationLocaleTemplate);
      notification.setEmailArgs(map);
      notification.setBroadcastSpid("test");
      notification.setBroadcasted(true);
      ((DAO) x.get("notificationDAO")).put_(x, notification);

      try {
        Thread.sleep(100L);
      } catch (InterruptedException e ) {
        // ignore - nop
      }

      notification = (Notification) userNotificationDAO.find(EQ(Notification.USER_ID, user.getId()));
      test ( notification != null, "(Broadcast) Notification found");
      if ( notification != null ) {
        test ( notification.getBody() != null &&
               notification.getBody().equals("Body "+name+"\\\\nline2 "+name),
               "(Broadcast) Body set: "+notification.getBody());
        test ( notification.getToastMessage() != null &&
               notification.getToastMessage().equals("ToastMessage "+name),
               "(Broadcast) ToastMessage set: "+notification.getToastMessage());
      }

      userNotificationDAO.removeAll();

      // French formatting of currency - comma rather than . 
      user = (User) user.fclone();
      user.setLanguage(new LanguageId("fr", ""));
      user = (User) userDAO.put(user);
      notificationLocaleTemplate = "NotificationLocaleTemplateTest-fr";

      name = "Currency";
      map.clear();
      map.put("amount", "1234.56");
      map.put("amountCurrency", "MAD"); 
      localeMappings.put("amount", NotificationLocaleTemplateSupport.CURRENCY_TYPE);
      notification = new Notification();
      notification.setLocaleTemplateName(notificationLocaleTemplate);
      notification.setBroadcastSpid("test");
      notification.setBroadcasted(true);
      notification.setEmailArgs(map);
      notification.setLocaleTranslationMappings(localeMappings);
      ((DAO) x.get("notificationDAO")).put_(x, notification);

      try {
        Thread.sleep(100L);
      } catch (InterruptedException e ) {
        // ignore - nop
      }

      notification = (Notification) userNotificationDAO.find(EQ(Notification.USER_ID, user.getId()));
      test ( notification != null, "(Currency) Notification found");
      String amount = (String) notification.getEmailArgs().get("amount");
      test ( amount.equals("1.234,56 DH"), "Currency formatted "+amount);
      `
    }
  ]
});
