/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.notification.push',
  name: 'PushSetting',
  extends: 'foam.core.notification.NotificationSetting',
  label: 'Push Notifications',

  javaImports: [
    'foam.lang.Agency',
    'foam.lang.ContextAgent',
    'foam.lang.TimeoutAgent',
    'foam.lang.FObject',
    'foam.lang.X',
    'foam.lang.XLocator',
    'foam.core.er.EventRecord',
    'foam.core.logger.Logger',
    'foam.core.logger.Loggers',
    'foam.core.notification.push.PushService',
    'foam.dao.DAO',
    'foam.log.LogLevel',
    'foam.util.SafetyUtil'
  ],

  properties: [
    {
      class: 'String',
      name: 'threadPoolName',
      value: 'pushNotificationThreadPool'
    },
    {
      class: 'Long',
      name: 'timeout',
      value: 120000,
      units: 'ms'
    }
  ],

  methods: [
    {
      name: 'sendNotification',
      javaCode: `
        String title = notification.getToastMessage();    // restricted to 30 chars
        String body  = notification.getToastSubMessage(); // restricted to 60 chars
        var extra = notification.getExtra();

        Agency agency = (Agency) x.get(getThreadPoolName());
        ContextAgent agent = new ContextAgent() {
          public void execute(X x) {
            x = XLocator.get();
            PushService pushService = (PushService) x.get("pushService");
            if ( SafetyUtil.isEmpty(title) ||
                 SafetyUtil.isEmpty(body) ) {
              // Loggers.logger(x, this).debug("push suppressed, title or body empty");
              return;
            }
            ((foam.core.om.OMLogger) x.get("OMLogger")).log("Notification:Push");
            try {
              pushService.sendPush(user, title, body, extra);
            } catch (Throwable t) {
              Loggers.logger(x, this).error(t);
            }
          }
        };

        agency.submit(x, new TimeoutAgent(getTimeout(), agent) {
          public void onTimeout() {
            String message = "timeout notification user:" + notification.getUserId() + ", title:" + title + ", body:" + body + ", extra:" + String.valueOf(extra);
            ((DAO) x.get("eventRecordDAO")).put(new EventRecord(x, "PushSetting", "sendNotification", null, null, message, LogLevel.WARN, null));
          }
        }, "PushService");
      `
    }
  ]
});
