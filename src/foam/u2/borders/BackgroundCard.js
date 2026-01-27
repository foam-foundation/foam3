/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.borders',
  name: 'BackgroundCard',
  extends: 'foam.u2.View',

  css: `
    ^ {
      width: 100%;
      border-radius: 4px;
      overflow: auto;
    }
    ^.disablePadding {
      padding: 0 !important;
    }
  `,

  properties: [
    {
      class: 'Color',
      name: 'backgroundColor'
    },
    {
      class: 'Boolean',
      name: 'enablePadding',
      value: true
    },
    {
      class: 'String',
      name: 'padding',
      visibility: function(enablePadding) {
        return enablePadding ? 'RW' : 'HIDDEN';
      },
      value: '2.4rem'
    }
  ],

  methods: [
    function init() {
      this.addClass()
        .enableClass('disablePadding', this.enablePadding$.map(v => ! v))
        .style({
          'background': this.backgroundColor$.map(v => foam.CSS.returnTokenValue(v, this.cls_,this.__subContext__)),
          'padding': this.padding$.map(v => foam.CSS.returnTokenValue(v, this.cls_,this.__subContext__))
        })
        .tag('', null, this.content$);
    }
  ]
});
