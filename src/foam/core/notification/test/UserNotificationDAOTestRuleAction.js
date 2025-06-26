/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.notification.test',
  name: 'UserNotificationDAOTestRuleAction',

  implements: [
    'foam.core.ruler.RuleAction'
  ],

  documentation: 'Set toast properties on user notification',

  javaImports: [
    'foam.core.notification.Notification',
    'foam.lang.X'
  ],

  methods: [
    {
      name: 'applyAction',
      javaCode: `
        Notification notification = (Notification) obj;
        notification.setToastMessage("UserNotificationDAOTest");
        notification.setToastSubMessage(String.valueOf(notification.getUserId()));
      `
    }
  ]
});
