/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.notification.email.test',
  name: 'MockSMTPAgent',
  extends: 'foam.core.notification.email.SMTPAgent',

  javaImports: [
    'foam.lang.X',
    'foam.dao.DAO',
    'foam.core.notification.email.EmailMessage',
    'foam.core.notification.email.EmailServiceConfig',
    'foam.core.notification.email.Status',
    'jakarta.mail.Session', // satisfy javagen/compilation
    'jakarta.mail.Transport' // satisfy javagen/compilation
  ],

  properties: [
    {
      name: 'throttler',
      class: 'String',
      value: 'mockSmtpAgentThrottle'
    }
  ],

  methods: [
    {
      name: 'start',
      javaCode: `
      // nop
      `
    },
    {
      name: 'sleep',
      args: 'Long interval',
      javaCode: `
      // don't let test continue after first rate limit
      EmailServiceConfig config = (EmailServiceConfig) findId(getX()).fclone();
      config.setEnabled(false);
      ((DAO) getX().get("emailServiceConfigDAO")).put(config);
      `
    },
    {
      name: 'send',
      javaCode: `
        emailMessage = (EmailMessage) emailMessage.fclone();
        emailMessage.setStatus(Status.SENT);
        return emailMessage;
      `,
      code: function() { return; }
    }
  ]
});
