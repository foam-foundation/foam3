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
    'foam.i18n.TranslationService',
    'foam.lang.Currency',
    'foam.lang.X',
    'static foam.mlang.MLang.AND',
    'static foam.mlang.MLang.EQ',
    'static foam.mlang.MLang.OR',
    'foam.util.SafetyUtil',
    'java.util.Map'
  ],

  constants: [
    {
      name: 'CURRENCY_TYPE',
      type: 'String',
      value: 'CURRENCY_TYPE'
    },
    // TODO: Number - requires precision for formatting,
    // see foam.u2.FloatView
    // {
    //   name: 'NUMBER_TYPE',
    //   type: 'String',
    //   value: 'NUMBER_TYPE'
    // }
  ],

  methods: [
    {
      name: 'applyLocaleTemplate',
      args: 'X x, User user, Notification notif',
      type: 'Notification',
      javaCode: `
      NotificationLocaleTemplate template = null;
      try {
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
        template = (NotificationLocaleTemplate)dao.find(
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
        } else {
          code = id;
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

        // required for currency formatting - see Currency.js Currency.delimeter
        x = x.put("locale.language", code.toString());

        notif = translateArgs(x, code.toString(), notif);
        return template.apply(x, notif);
      } catch (Throwable t) {
        if ( template != null )
          Loggers.logger(x, this).error(template.getName(), notif.getToastMessage(), notif.getBody(), t);
        else
          Loggers.logger(x, this).error(notif.getToastMessage(), notif.getBody(), t);
        return notif;
      }
      `
    },
    {
      // make part of EmailTemplateEngine
      name: 'translateArgs',
      args: 'X x, String locale , Notification notif',
      type: 'Notification',
      javaCode: `
      TranslationService ts = (TranslationService) x.get("translationService");
      Map<String, String> translationMappings = notif.getLocaleTranslationMappings();
      if ( translationMappings == null ||
           translationMappings.size() == 0 )
        return notif;

      Map<String, String> emailArgs = notif.getEmailArgs();
      for ( String key : translationMappings.keySet() ) {
        Object value = emailArgs.get(key);
        if ( value == null )
          continue;
        String id = translationMappings.get(key);
        if ( id == null )
          continue;
        if ( id.equals(CURRENCY_TYPE) )
          emailArgs.put(key, formatCurrency(x, emailArgs, key, value.toString()));
        else
          emailArgs.put(key, ts.getTranslation(locale, id, value.toString()));
      }
      return notif;
      `
    },
    {
      name: 'formatCurrency',
      args: 'X x, Map emailArgs, String key, String value',
      type: 'String',
      javaThrows: ['NumberFormatException'],
      javaCode: `
        Object code = emailArgs.get(key+"Currency");
        if ( code == null )
          return value;

        Currency curr = (Currency) ((DAO) x.get("currencyDAO")).find(code.toString());
        if ( curr == null ) {
          foam.core.logger.Loggers.logger(x, this).warning("Currency not found", code, key);
          return value;
        }

        long amount = 0L;
        try {
          if ( value.indexOf(".") > 0 )  // DoubelUnitValue
            amount = curr.minorAmount(Double.parseDouble(value));
          else
            amount = Long.parseLong(value);
          String result = curr.format(x, amount, true, false);
          return result;
        } catch (NumberFormatException e) {
          foam.core.logger.Loggers.logger(x, this).error("Failed to format currency value", key, curr.toString(), value);
          return value;
        }
      `
    }
  ]
});
