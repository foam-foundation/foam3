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
    'foam.lang.X',
    'foam.core.auth.Subject',
    'foam.core.auth.User',
    'foam.core.logger.Loggers',
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
      var x = (X) getX();
      try {
        x = x.put("notification", notification);
        if ( notification.getPredicate() != null && ! notification.getPredicate().f(x) ) {
          return; // Predicate is false, skip this user
        }
      } catch (Exception e) {
        Loggers.logger(x, this).error("Error evaluating predicate for notification", e);
        return; // Predicate evaluation failed, skip this user
      }
      getUserNotificationDAO().put(notification);
      `
    }
  ]
});
