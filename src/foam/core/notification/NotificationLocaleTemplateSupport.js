/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.notification',
  name: 'NotificationLocaleTemplateSupport',

  // mixin moddel

  javaImports: [
    'foam.core.auth.User',
    'foam.core.auth.Language',
    'foam.core.auth.LanguageId',
    'foam.core.logger.Loggers',
    'foam.dao.DAO',
    'foam.lang.X',
    'static foam.mlang.MLang.AND',
    'static foam.mlang.MLang.EQ',
    'static foam.mlang.MLang.OR',
    'foam.util.SafetyUtil'
  ],

  methods: [
    {
      name: 'applyLocaleTemplate',
      args: 'X x, User user, Notification notif',
      type: 'Notification',
      javaCode: `
        if ( SafetyUtil.isEmpty(notif.getLocaleTemplateName()) )
          return notif;

        LanguageId id = (LanguageId) user.getLanguage();
        LanguageId code = new LanguageId("en", "");
        Language language = (Language) user.findLanguage(x);
        if ( language == null ) {
          Loggers.logger(x, this).warning("Language not found", user.getLanguage());
          id = code;
        } else {
          code = new LanguageId(language.getCode(), "");
        }

        // find by language, code+variant, then code only
        DAO dao = (DAO) x.get("notificationLocaleTemplateDAO");
        NotificationLocaleTemplate template = (NotificationLocaleTemplate)dao.find(
          AND(
            EQ(NotificationLocaleTemplate.NAME, notif.getLocaleTemplateName()),
            EQ(NotificationLocaleTemplate.LANGUAGE, id)
          ));
        if ( template == null ) {
          template = (NotificationLocaleTemplate)dao.find(
            AND(
              EQ(NotificationLocaleTemplate.NAME, notif.getLocaleTemplateName()),
              EQ(NotificationLocaleTemplate.LANGUAGE, code)
            ));
        }
        // fallback to english
        if ( template == null &&
             ! code.getCode().equals("en") ) {
          code = new LanguageId("en", "");
          template = (NotificationLocaleTemplate)dao.find(
            AND(
              EQ(NotificationLocaleTemplate.NAME, notif.getLocaleTemplateName()),
              EQ(NotificationLocaleTemplate.LANGUAGE, code)
            ));
        }
        if ( template == null ) {
          Loggers.logger(x, this).error("NotificationLocaleTemplate not found", notif.getLocaleTemplateName(), user.getLanguage());
          return notif;
        }

        return template.apply(x, notif);
      `
    }
  ]
});
