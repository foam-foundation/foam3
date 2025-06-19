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
    'foam.lang.FObject',
    'foam.lang.X',
    'foam.lang.XLocator',
    'foam.core.logger.Logger',
    'foam.core.logger.Loggers',
    'foam.core.notification.push.PushService',
    'foam.util.SafetyUtil'
  ],

  properties: [
    {
      class: 'String',
      name: 'threadPoolName',
      value: 'threadPool'
    }
  ],

  methods: [
    {
      name: 'sendNotification',
      javaCode: `
        Agency agency = (Agency) x.get(getThreadPoolName());
        agency.submit(x, new ContextAgent() {
          public void execute(X x) {
            x = XLocator.get();
            PushService pushService = (PushService) x.get("pushService");
            String title = notification.getToastMessage();    // restricted to 30 chars
            String body  = notification.getToastSubMessage(); // restricted to 60 chars
            var extra = notification.getExtra();
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
        }, "PushService");
      `
    }
  ]
});
