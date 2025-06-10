/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.notification',
  name: 'GoogleChatSetting',
  extends: 'foam.core.notification.NotificationSetting',

  javaImports: [
    'foam.core.app.AppConfig',
    'foam.core.logger.Logger',
    'foam.core.logger.Loggers',
    'foam.core.notification.email.EmailMessage',
    'foam.core.notification.email.EmailPropertyService',
    'foam.dao.DAO',
    'foam.dao.ProxyDAO',
    'foam.lang.FObject',
    'foam.lang.X',
    'foam.lib.json.Outputter',
    'foam.util.SafetyUtil',
    'java.net.http.HttpClient',
    'java.net.http.HttpRequest',
    'java.net.http.HttpResponse',
    'java.io.PrintWriter',
    'java.io.StringWriter',
    'java.util.HashMap',
    'java.util.Map',
    'java.net.URI'
  ],

  properties: [
    {
      name: 'throttler',
      class: 'String',
      value: 'googleChatNotificationThrottler'
    },
    {
      name: 'template',
      class: 'String',
      value: 'googleChatCardsV2NotificationTemplate'
    }
  ],

  methods: [
    {
      name: 'sendNotification',
      javaCode: `
      try {
        if ( foam.util.SafetyUtil.isEmpty(notification.getGoogleChatWebhook()) )
          return;

        Map map = new HashMap();

        String URL = notification.getGoogleChatWebhook();
        String message = notification.getGoogleChatMessage();
        if ( foam.util.SafetyUtil.isEmpty(message) ) {
          message = notification.getBody();
        }

        int count = 0;
        String[] lines = message.split("\\n");
        map.put("title", lines[0]);
        map.put("subtitle", "Host: "+System.getProperty("hostname", "localhost"));
        map.put("message", message);

        String body = null;

        try {
          map.put("template", getTemplate());
          EmailMessage emailMessage = new EmailMessage(x, user.getId(), map);
          // satisfy EmailPropertyService
          emailMessage.setSubject("nop");
          emailMessage.setTo(new String[] {user.getEmail()});

          EmailPropertyService service = (EmailPropertyService) x.get("emailPropertyService");
          service.apply(x, null, emailMessage, null);
          body = emailMessage.getBody();
          // Loggers.logger(x, this).debug("body", body);
        } catch (Exception e) {
          Loggers.logger(x, this).warning("EmailPropertyService", e.getMessage(), e);
          throw new RuntimeException("EmailPropertyService error: "+e.getMessage());
        }

        throttle(x);

        HttpRequest request = HttpRequest.newBuilder(URI.create(URL))
          .header("accept", "application/json; charset=UTF-8")
          .POST(HttpRequest.BodyPublishers.ofString(body))
          .build();

        HttpResponse<String> response = HttpClient.newHttpClient()
          .send(request, HttpResponse.BodyHandlers.ofString());

        // Loggers.logger(x, this).debug(response.body());
        if ( response.statusCode() != 200 ) {
          Loggers.logger(x, this).warning("Failed posting to Google", response.statusCode(), response.body(), "message", message);
        }
      } catch (Throwable t) {
        Loggers.logger(x, this).error(t);
      }
      `
    },
    {
      name: 'throttle',
      args: 'X x',
      javaCode: `
        var t = (foam.core.pool.Throttle) x.get(getThrottler());
        if ( t != null ) t.throttle();
      `
    }
  ]
});
