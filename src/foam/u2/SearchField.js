/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

 foam.CLASS({
  package: 'foam.u2',
  name: 'SearchField',
  extends: 'foam.u2.TextField',

  documentation: `
    Bare search input: type="search", magnifier icon, 'Search...' placeholder.
    No clear button - only the Chrome-only native ::-webkit-search-cancel-button.

    Prefer foam.u2.ClearableSearchField, which pairs this with
    ClearableSearchBorder for a real, keyboard-reachable X. Use this class alone
    only when standing in for a plain text input, as TextSearchView does by
    registering it under 'foam.u2.TextField'.

    Gotcha: the placeholder factory always returns a value, so
    TextField.fromProperty never copies a property's placeholder:. Pass
    placeholder in the view spec, or use ClearableSearchField.
  `,

  cssTokens: [
    [ 'searchRoundness', '$inputBorderRadius' ]
  ],

  css: `
    ^.foam-u2-TextInputCSS{
      border-radius: $searchRoundness;
      border-color: $borderStrong;
    }
    ^icon{
      background-image: url("/images/ic-search.svg");
      background-repeat: no-repeat;
      background-position: left 0.5em top 50%, 0 0;
      padding: 0 16px 0 32px;
    }
  `,

   messages: [
     {
       name: 'LABEL_SEARCH',
       messageMap: {
         en: 'Search...',
         fr: 'Recherche...'
       }
     }
   ],

  properties: [
    ['type', 'search'],
    {
      name: 'placeholder',
      factory: x => {return x.sourceCls_.LABEL_SEARCH;}
    }
  ],

  methods: [
    function initCls() {
      this.addClass();
      this.addClass(this.myClass('icon'));
    }
  ]
});
