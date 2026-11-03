/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.borders',
  name: 'TopBorderCard',
  extends: 'foam.u2.View',

  css: `
    <<container {
      width: 100%;
      padding: 2.4rem;
      background: $backgroundDefault;
      border: 1px solid $borderXLight;
      border-top: none;
      border-bottom-left-radius: 4px;
      border-bottom-right-radius: 4px;
    }
    <<bar {
      width: 100%;
      height: 8px;
      border-top-left-radius: 4px;
      border-top-right-radius: 4px;
    }
  `,

  properties: [
    {
      class: 'Color',
      name: 'color'
    }
  ],

  methods: [
    function init() {
      this.addClass()
        .start().addClass(this.myClass('bar'))
          .style({'background' : foam.CSS.returnTokenValue(this.color, this.cls_, this.__subContext__), 'border' : '1px solid' + foam.CSS.returnTokenValue(this.color, this.cls_, this.__subContext__) })
        .end()
        .start('div', null, this.content$)
          .addClass(this.myClass('container'))
        .end()
        ;
    }
  ]
});
