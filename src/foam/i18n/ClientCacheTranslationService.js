/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.i18n',
  name: 'ClientCacheTranslationService',

  implements: [
    'foam.i18n.TranslationService',
    'foam.mlang.Expressions'
  ],

  imports: [
    'theme?',
    'localeDAO'
  ],

  requires: [
    'foam.lang.Latch',
    'foam.dao.MDAO',
    'foam.i18n.Locale',
    'foam.i18n.MessageTemplateParser'
  ],

  topics: [ 'translation' ],

  properties: [
    {
      name: 'initLatch',
      documentation: 'Latch to denote cache has been loaded and service is ready',
      factory: function() { return this.Latch.create(); }
    },
    {
      name: 'locale',
      factory: function() {
        return (foam.locale || "en").substring(0,2);
      }
    },
    {
      name: 'variant',
      factory: function() {
        return (foam.locale || "").substring(3);
      }
    },
    {
      class: 'Map',
      name: 'localeEntries',
      factory: function() {
        return {};
      }
    }
  ],

  methods: [
    function init() {
      // TODO: this should be moved to the server's getTranslations() method
      this.loadLanguageLocales().then(() => {
        if ( this.hasVariant() ) {
          return this.loadVariantLocales().then(() => {
            if ( this.theme ) {
              let pArr = [];
              pArr.push(this.loadTheme());
              pArr.push(this.loadVariantTheme());
              return Promise.all(pArr);
            }
          });
        } else {
          if ( this.theme ) {
            return this.loadTheme();
          }
        }
      }).then(() => { this.initLatch.resolve(); });
    },

    function maybeReload() {
      /**
        Reload locales if foam.locale has changed since this class was
        initially init()-ed.
      **/
      var originalLocale = this.locale;
      if ( this.variant ) originalLocale = originalLocale + '-' + this.variant;
      if ( foam.locale != originalLocale ) {
        this.locale = this.variant = undefined;
        this.initLatch = this.Latch.create();
        this.localeEntries = {};
        this.init();
      }
      return this.initLatch;
    },

    function loadLanguageLocales() {
      return this.localeDAO.where(
        this.AND(
          this.EQ(this.Locale.LOCALE,  this.locale),
          this.EQ(this.Locale.THEME_ID, ''),
          this.EQ(this.Locale.VARIANT, ''))).select(this.addLocale.bind(this));
    },

    function loadVariantLocales() {
      return this.localeDAO.where(
        this.AND(
          this.EQ(this.Locale.LOCALE,  this.locale),
          this.EQ(this.Locale.THEME_ID, ''),
          this.EQ(this.Locale.VARIANT, this.variant))).select(this.addLocale.bind(this));
    },

    function addLocale(l) {
      this.localeEntries[l.source] = l.target;
    },

    function hasVariant() { return !! this.variant; },

    /*
    {
      name: 'getTranslations',
      args: [ 'String locale' ],
      async: true
    },
    */
    {
      name: 'getTranslation',
      args: [ 'String locale', 'String source', 'String defaultText' ],
      type: 'String',
      code: function(locale, source, defaultText, replacementMap) {
        var txt = this.localeEntries[source] || defaultText;
        if ( txt && replacementMap ) {
          let parser = this.MessageTemplateParser.create({
            value: txt
          });
          let valueParser = parser.valueParserResults;
          txt = valueParser.reduce(function(ret, v) { return ret + v(replacementMap); }, '');
        }
        this.translation.pub(locale, source, txt, defaultText);
        return txt ?? defaultText;
      }
    },
    function loadTheme() {
      return this.localeDAO.where(
        this.AND(
          this.EQ(this.Locale.LOCALE,  this.locale),
          this.EQ(this.Locale.THEME_ID, this.theme.id))).select(this.addLocale.bind(this));
    },
    function loadVariantTheme() {
      return this.localeDAO.where(
        this.AND(
          this.EQ(this.Locale.LOCALE,  this.locale),
          this.EQ(this.Locale.THEME_ID, this.theme.id),
          this.EQ(this.Locale.VARIANT, this.variant))).select(this.addLocale.bind(this));
    }
  ]
});
