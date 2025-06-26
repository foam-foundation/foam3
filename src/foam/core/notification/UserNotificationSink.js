/**
 * @license
 * Copyright 2025 Google Inc. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.notification',
  name: 'UserNotificationSink',
  extends: 'foam.dao.AbstractSink',

  documentation: `Prepare notification per user then put to DAO decorated
with RulerDAO which can perform further per user setup before user.doNotify.`,

  javaImports: [
    'foam.dao.DAO',
    'foam.core.auth.User'
  ],

  properties: [
    {
      name: 'notification',
      class: 'FObjectProperty',
      of: 'foam.core.notification.Notification'
    },
    {
      name: 'userNotificationDAO',
      class: 'foam.dao.DAOProperty'
    }
  ],

  methods: [
    {
      name: 'put',
      javaCode: `
      User user = (User) obj;
      Notification notification = (Notification) getNotification().fclone();
      Notification.ID.clear(notification);
      Notification.GROUP_ID.clear(notification);
      Notification.TEMPLATE.clear(notification);
      notification.setBroadcasted(false);
      notification.setUserId(user.getId());
      getUserNotificationDAO().put(notification);
      `
    }
  ]
});
