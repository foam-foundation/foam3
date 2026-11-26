/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.notification.test',
  name: 'EmailSettingBodyTest',
  extends: 'foam.core.test.Test',

  documentation: `A locale template writes a line break in a body as the two characters "\\n".
    The in-app modal shows it as a line break; the email must get <br> instead, or the reader
    sees "\\n" as text. The stored notification must keep "\\n" for the modal.`,

  javaImports: [
    'foam.core.auth.LifecycleState',
    'foam.core.auth.User',
    'foam.core.notification.EmailSetting',
    'foam.core.notification.Notification',
    'foam.core.notification.email.EmailMessage',
    'foam.dao.ArraySink',
    'foam.dao.DAO',
    'foam.dao.MDAO',
    'foam.lang.X',
    'java.util.List',
    'java.util.Map'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        DAO emailMessageDAO = new MDAO(EmailMessage.getOwnClassInfo());
        X y = x.put("emailMessageDAO", emailMessageDAO);

        User user = new User();
        user.setId(990003L);
        user.setSpid("test");
        user.setEmail("reader@example.com");
        user.setLifecycleState(LifecycleState.ACTIVE);

        Notification notification = new Notification();
        notification.setBody("deleted user Dana\\\\nusername: dana");
        notification.setEmailName("EmailSettingBodyTest");

        new EmailSetting().sendNotification(y, user, notification);

        List messages = ((ArraySink) emailMessageDAO.select(new ArraySink())).getArray();
        test(messages.size() == 1, "one email, got " + messages.size());
        if ( messages.size() != 1 ) return;

        Map args = ((EmailMessage) messages.get(0)).getTemplateArguments();
        expect(args.get("body"), "deleted user Dana<br>username: dana", "the email body turns \\"\\\\n\\" into <br>");
        expect(notification.getBody(), "deleted user Dana\\\\nusername: dana", "the notification keeps \\"\\\\n\\" for the in-app modal");
        test(! notification.getEmailArgs().containsKey("body"), "the notification's own email args are not changed");
      `
    }
  ]
});
