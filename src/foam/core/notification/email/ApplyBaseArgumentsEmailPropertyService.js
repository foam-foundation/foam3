/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.notification.email',
  name: 'ApplyBaseArgumentsEmailPropertyService',

  documentation: 'set up the base arguments of theme, appConfig',

  implements: [
    'foam.core.notification.email.EmailPropertyService'
  ],

  javaImports: [
    'foam.lang.X',
    'foam.core.app.AppConfig',
    'foam.core.app.SupportConfig',
    'foam.core.auth.User',
    'foam.core.logger.Logger',
    'foam.core.logger.Loggers',
    'foam.core.notification.email.EmailConfig',
    'foam.core.notification.email.EmailMessage',
    'foam.core.session.Session',
    'foam.core.theme.Theme',
    'foam.util.SafetyUtil',
    'java.util.HashMap',
    'java.util.Map'
  ],

  methods: [
    {
      name: 'apply',
      type: 'foam.core.notification.email.EmailMessage',
      javaCode: `
        Logger logger = Loggers.logger(x, this);

        User user = (User) emailMessage.findUser(getX());
        x = foam.util.Auth.sudo(x, user);

        emailMessage.setSpid(user.getSpid());

        Theme theme = (Theme) x.get("theme");
        SupportConfig supportConfig = theme.getSupportConfig();
        EmailConfig emailConfig = supportConfig.getEmailConfig();

        // Set ReplyTo, From, DisplayName from support email config
        if ( emailConfig != null ) {
          // REPLY TO:
          if ( ! SafetyUtil.isEmpty(emailConfig.getReplyTo()) ) {
            emailMessage.setReplyTo(emailConfig.getReplyTo());
          }
          // DISPLAY NAME:
          if ( ! SafetyUtil.isEmpty(emailConfig.getDisplayName()) ) {
            emailMessage.setDisplayName(emailConfig.getDisplayName());
          }
          // FROM:
          if ( ! SafetyUtil.isEmpty(emailConfig.getFrom()) ) {
            emailMessage.setFrom(emailConfig.getFrom());
          }
        }

        // template name check
        String templateName = (String) templateArgs.get("template");
        if ( SafetyUtil.isEmpty(templateName) ) {
          logger.debug("EmailTemplate not found");
          return emailMessage;
        }

        String sendTo = (String) templateArgs.get("sendTo");
        if ( SafetyUtil.isEmpty(sendTo) )
          templateArgs.put("sendTo", user.getEmail());

        AppConfig appConfig = (AppConfig) x.get("appConfig");
        String url = appConfig.getUrl();
        templateArgs.put("logo", url + theme.getLogo());
        templateArgs.put("largeLogo", url + theme.getLargeLogo());
        templateArgs.put("appLink", url);
        templateArgs.put("appName", theme.getAppName());
        templateArgs.put("locale", user.getLanguage().getCode().toString());
        foam.core.auth.Address address = supportConfig.getSupportAddress();
        templateArgs.put("supportAddress", address == null ? "" : address.toSummary());
        templateArgs.put("supportPhone", supportConfig.getSupportPhone());
        templateArgs.put("supportEmail", supportConfig.getSupportEmail());
        templateArgs.put("supportLogo", supportConfig.getSupportLogo());
        templateArgs.put("termsAndCondLink", url + appConfig.getTermsAndCondLink());
        templateArgs.put("termsAndCondLabel", appConfig.getTermsAndCondLabel());
        templateArgs.put("copyright", appConfig.getCopyright());
        templateArgs.put("privacyUrl", url + appConfig.getPrivacyUrl());
        templateArgs.put("privacyLabel", appConfig.getPrivacy());

        // Temporary color until token support is added for email
        templateArgs.put("theme", theme);

        // personal support user
        User psUser = supportConfig.findPersonalSupportUser(getX());
        templateArgs.put("personalSupportPhone", psUser == null ? "" : psUser.getPhoneNumber());
        templateArgs.put("personalSupportEmail", psUser == null ? "" : psUser.getEmail());
        templateArgs.put("personalSupportFirstName", psUser == null ? "" : psUser.getFirstName());
        templateArgs.put("personalSupportFullName", psUser == null ? "" : psUser.getLegalName());

        // system
        templateArgs.put("hostname", System.getProperty("hostname", "localhost"));
        emailMessage.setTemplateArguments(templateArgs);

        return emailMessage;
      `
    }
  ]
});
