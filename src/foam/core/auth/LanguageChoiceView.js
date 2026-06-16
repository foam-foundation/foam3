/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.auth',
  name: 'LanguageChoiceView',
  extends: 'foam.u2.View',

  implements: [
    'foam.mlang.Expressions'
  ],

  requires: [
    'foam.lang.Action',
    'foam.core.auth.Language',
    'foam.u2.view.OverlayActionListView',
    'foam.u2.View'
  ],

  imports: [
    'auth',
    'countryDAO',
    'languageDAO',
    'stack',
    'subject',
    'translationService',
    'userDAO'
  ],

  exports: [ 'as data' ],

  css: `
    ^dropdown span, ^dropdown svg {
      font-weight: $font-regular;
    }
  `,

  properties: [
    'optionsBtn_',
    'supportedLanguages',
    {
      class: 'FObjectProperty',
      of: 'foam.core.auth.Language',
      name: 'lastLanguage',
      factory: function() {
        let language = this.supportedLanguages.find( e => e.toString() === foam.locale );
        language = language === undefined ? this.defaultLanguage : language;
        localStorage.setItem('localeLanguage', language.toString());
        return language;
      }
    },
    {
      class: 'Boolean',
      name: 'longName'
    }
  ],

  methods: [
    async function render() {
      var self = this;
      this.__subContext__.register(foam.u2.ActionView, 'foam.u2.ActionView');
      this.supportedLanguages = (await this.languageDAO
        .where(foam.mlang.predicate.Eq.create({
          arg1: foam.core.auth.Language.ENABLED,
          arg2: true
        })).select()).array;

      if ( this.supportedLanguages.length <= 1 ) return;
      var i = this.supportedLanguages.length;
      while ( i-- ) {
        var code = this.supportedLanguages[i].code;
        if ( ! code.includes('-') )
          code += '-';
        if ( ! await this.auth.check(this.__subContext__, `language.read.${code}`) )
          self.supportedLanguages.splice(i, 1);
      }
      var actionArray = this.supportedLanguages.map( c => {
        var labelSlot = foam.lang.PromiseSlot.create({ value: '', promise: self.formatLabel(c) });
        return self.Action.create({
          name: c.name,
          label$: labelSlot,
          code: async function() {
            let user = self.subject.realUser;
            user.language = c.id;
            await self.userDAO.put(user);
            location.reload();
            localStorage.setItem('localeLanguage', c.toString());
          }
        });
      });

      var label = this.formatLabel(this.lastLanguage, ! this.longName);

      this
        .addClass(this.myClass())
        .start(this.OverlayActionListView, {
          label:       label,
          data:        actionArray,
          obj:         self,
          buttonStyle: 'UNSTYLED'
        })
          .addClass(this.myClass('dropdown'))
        .end()
      .end();
    },

    async function formatLabel(language, shortName) {
      let country = await this.countryDAO.find(language.variant);
      let label;
      if ( shortName ) {
        return language.code.toUpperCase();
      } else {
        label = language.variant != '' ? `${language.nativeName}(${language.variant})` : `${language.nativeName}`;
      }
      if ( country && country.nativeName != null ) {
        label = `${language.nativeName}\u00A0(${country.nativeName})`;
      }
      return label;
    }
  ]
});
