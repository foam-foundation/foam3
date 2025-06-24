/**
 * @license
 * Copyright 2025 Google Inc. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.notification',
  name: 'UserNotificationDAO',
  extends: 'foam.dao.ProxyDAO',

  documentation: `A DAO primarily for RulerDAO appication. Called by
NotificationExpansionDAO after the per-user Notification is created,
allowing the RuleEngine to further configure the notification.`,

  javaImports: [
    'foam.core.auth.User',
    'foam.lang.X',
    'foam.dao.DAO'
  ],

  javaCode: `
  public UserNotificationDAO(X x, DAO delegate) {
    setX(x);
    setDelegate(delegate);
  }
  `,

  methods: [
    {
      name: 'put_',
      javaCode: `
      Notification notification = (Notification) getDelegate().put_(x, obj);
      // User user = notification.findUser(x);
      User user = (User) ((DAO) x.get("localUserDAO")).find_(x, notification.getUserId());
      user.doNotify(x, notification);
      return notification;
      `
    }
  ]
});
