/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

 foam.CLASS({
  package: 'foam.u2',
  name: 'SearchField',
  extends: 'foam.u2.TextField',

  cssTokens: [
    [ 'searchRoundness', '$inputBorderRadius' ]
  ],

  css: `
    ^ {
      border-radius: $searchRoundness;
    }
    ^icon{
      background-image: url("/images/ic-search.svg");
      background-repeat: no-repeat;
      background-position: left 0.5em top 50%, 0 0;
      padding: 0 16px 0 32px;
    }
  `,

  messages: [{ name: 'LABEL_SEARCH', message: 'Search...' }],

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
