/**
* @license
* Copyright 2025 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/


foam.CLASS({
  package: 'foam.u2',
  name: 'CSSTokenSuggestedTextField',
  extends: 'foam.u2.view.SuggestedTextField',

  requires: ['foam.u2.CSSTokenAutocompleter'],

  imports: ['theme?'],

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.u2.Autocompleter',
      name: 'autocompleter',
      factory: function() {
        return this.CSSTokenAutocompleter.create({ themeID: this.theme?.id });
      }
    },
    {
      name: 'onSelect',
      value: function(obj) {
        this.data = '$' + obj.id;
        this.tokenObject = obj;
      }
    },
    {
      class: 'FObjectProperty',
      of: 'foam.u2.CSSToken',
      name: 'tokenObject',
    }
  ],
  methods: [
    async function init() {
      this.SUPER();
      if (this.data?.startsWith('$')) {
        this.tokenObject = foam.CSS.findTokenAxiom(this.data.substring(1), this.cls_, this.__subContext__);
      }
    }
  ]
});

foam.CLASS({
  package: 'foam.u2',
  name: 'CSSTokenAutocompleter',
  extends: 'foam.u2.Autocompleter',

  imports: [
    'cssTokenOverrideService?',
    'theme? as importedTheme'
  ],

  properties: [
    {
      class: 'String',
      name: 'themeID',
      hidden:true,
      expression: function(importedTheme) {
        return importedTheme?.id ?? '';
      }
    },
    {
      name: 'queryFactory',
      value: function(str) {
        if ( str.startsWith('$') )
          str = str.substring(1);
        return foam.mlang.predicate.Keyword.create({ arg1: str });
      }
    },
    {
      name: 'dao',
      factory: function() {
        return foam.dao.MDAO.create({ of: 'foam.u2.CSSToken' });
      }
    }
  ],

  methods: [
    async function init() {
      this.SUPER();
      await this.updateThemeTokens();
    }
  ],
  listeners: [
    {
      name: 'updateThemeTokens',
      isFramed: true,
      on: ['this.cssTokenOverrideService.cacheUpdated' ],
      code: async function() {
        let self = this;
        // Load all base tokens from CSSTokens.js
        // This wont include any tokens in the classes, maybe there is a way we can pub these tokens so they are added after the fact
        // Would using foam.USED be too expensive??
        let allTokens = foam.u2.CSSTokens.getAxiomsByClass(foam.u2.CSSToken);
        let pArray = allTokens.map(v => {
          return self.dao.put(v);
        })
        await Promise.all(pArray);
        // Load current theme tokens if they exist
        if ( this.cssTokenOverrideService && this.importedTheme ) {
          let map = this.cssTokenOverrideService.tokenCache[this.importedTheme.id];
          if ( ! map ) return;
          let pArray = Object.keys(map).map(v => {
            let ax = foam.u2.CSSToken.create({ name: v, value: map[v] });
            return self.dao.put(ax);
          })
          return Promise.all(pArray); 
        }
      }
    }
  ]

});
