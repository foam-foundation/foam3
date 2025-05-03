
/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.notification',
  name: 'EmailSetting',
  extends: 'foam.core.notification.NotificationSetting',
  label: 'Email Notifications',

  javaImports: [
    'foam.lang.PropertyInfo',
    'foam.dao.DAO',
    'foam.core.auth.User',
    'foam.core.auth.LifecycleState',
    'foam.core.app.AppConfig',
    'foam.core.logger.Logger',
    'foam.core.logger.Loggers',
    'foam.core.notification.email.EmailMessage',
    'java.util.HashSet',
    'java.util.Iterator',
    'java.util.Map',
    'foam.util.SafetyUtil',
    'static foam.mlang.MLang.EQ'
  ],

  properties: [
    {
      name: 'enabled',
      readPermissionRequired: false,
      writePermissionRequired: true
    },
  ],

  methods: [
    {
      name: 'resolveNotificationArguments',
      type: 'Map',
      documentation: `
          Iterate through arguments to replace propertyInfo values with the notified user' values.
          TODO: Handle nested FObjects passed in as propertyInfo.
      `,
      args: 'Context x, Map arguments, User user',
      javaCode: `
        Logger logger = Loggers.logger(x, this);

        Iterator entries = arguments.entrySet().iterator();
        while ( entries.hasNext() ) {
          Map.Entry entry = (Map.Entry) entries.next();
          if ( entry.getValue() instanceof PropertyInfo ) {
            if ( ! ((PropertyInfo) entry.getValue()).getClassInfo().getObjClass().isAssignableFrom(user.getClass()) ) {
              entry.setValue("");
              logger.error("Cannot set an unrelated PropertyInfo to notified user as an argument value");
              continue;
            }
            entry.setValue(((PropertyInfo) entry.getValue()).get(user));
          }
        }
        return arguments;
      `
    },
    {
      name: 'sendNotification',
      javaCode: `
        // Check if the user has disabled email notifications
        if ( ! getEnabled() || user == null )
          return;

        // Do not send notifications to users that are not yet active
        if ( user.getLifecycleState() != LifecycleState.ACTIVE )
          return;

        // Skip sending email messages for disabled topics
        if ( user.getDisabledTopicSet() != null ) {
          HashSet<String> disabledTopics = (HashSet<String>) user.getDisabledTopicSet();
          if ( disabledTopics.contains(notification.getNotificationType()) ) {
            return;
          }
        }

        Logger logger = Loggers.logger(x, this);
        EmailMessage message = new EmailMessage();
        message.setUser(user.getId());
        message.setSpid(user.getSpid());
        message.setTo(new String[] { user.getEmail() });
        message.setClusterable(notification.getClusterable());
        notification = (Notification) notification.fclone();

        if ( notification.BODY.isSet(notification) ) message.setBody(notification.getBody());

        if ( notification.getEmailArgs() != null ) {
          Map<String, Object> emailArgs = resolveNotificationArguments(x, notification.getEmailArgs(), user);
          notification.setEmailArgs(emailArgs);
        }

        if ( "notification".equals(notification.getEmailName()) ) {
          notification.getEmailArgs().put("type", notification.getNotificationType());

          AppConfig config = (AppConfig) x.get("appConfig");
          if ( config != null ) {
            notification.getEmailArgs().put("link", config.getUrl());
          }
        }

        if ( ! SafetyUtil.isEmpty(notification.getBody()) ) {
          notification.getEmailArgs().put("body", notification.getBody());
        }

        ((foam.core.om.OMLogger) x.get("OMLogger")).log("Notification:Email");
        try {
          if ( ! SafetyUtil.isEmpty(notification.getEmailName()) ) {
            Map args = notification.getEmailArgs();
            args.put("template", notification.getEmailName());
            message.setTemplateArguments(args);
            ((DAO) x.get("emailMessageDAO")).put(message);
          } else {
            logger.warning("EmailTemplate not specified.");
          }
        } catch(Throwable t) {
          logger.error("Error sending notification email message", message, t.getMessage(), t);
        }
      `
    }
  ]
});
