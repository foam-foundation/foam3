/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.notification',
  name: 'NotificationLocaleTemplate',

  documentation: `Support locale specific notifications.
Delay creating notification title and body until final notification user has been determined`,

  implements: [
    'foam.core.auth.ServiceProviderAware'
  ],

  javaImports: [
    'foam.core.auth.LanguageId',
    'foam.core.logger.Loggers',
    'foam.core.notification.email.EmailTemplateEngine',
    'foam.util.SafetyUtil'
  ],

  requires: [
    'foam.core.auth.LanguageId'
  ],

  ids: [ 'name', 'language' ],

  properties: [
    {
      class: 'String',
      name: 'name',
      required: 'true'
    },
    {
      class: 'Reference',
      of: 'foam.core.auth.Language',
      name: 'language',
      factory: function() { return foam.core.auth.LanguageId.create({code:"en"}); },
      javaFactory: 'return new foam.core.auth.LanguageId("en", "");'
    },
    {
      class: 'String',
      name: 'description',
      documentation: 'Details, info regarding this template'
    },
    {
      class: 'String',
      name: 'body'
    },
    {
      class: 'String',
      name: 'toastMessage'
    },
    {
      class: 'String',
      name: 'toastSubMessage'
    },
  ],

  methods: [
    {
      name: 'apply',
      args: 'X x, Notification notif',
      type: 'Notification',
      javaCode: `
        if ( notif == null )
          throw new IllegalArgumentException("Notification is null");

        EmailTemplateEngine templateEngine = (EmailTemplateEngine) x.get("templateEngine");
        if ( SafetyUtil.isEmpty(notif.getBody()) )
          notif.setBody(templateEngine.renderTemplate(x, getBody(), notif.getLocaleTemplateArgs()).toString());
        if ( SafetyUtil.isEmpty(notif.getToastMessage()) )
          notif.setToastMessage(templateEngine.renderTemplate(x, getToastMessage(), notif.getLocaleTemplateArgs()).toString());
        if ( SafetyUtil.isEmpty(notif.getToastSubMessage()) )
          notif.setToastSubMessage(templateEngine.renderTemplate(x, getToastSubMessage(), notif.getLocaleTemplateArgs()).toString());

        return notif;
      `
    }
  ]
})
