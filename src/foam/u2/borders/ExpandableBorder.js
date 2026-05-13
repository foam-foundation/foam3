/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

 foam.CLASS({
  package: 'foam.u2.borders',
  name: 'ExpandableBorder',
  extends: 'foam.u2.Element',

  documentation: 'Adds a collapsable card div that can be triggered by any boolean value',

  css: `
    ^ {
      box-shadow: 0px 10px 15px rgba(0, 0, 0, 0.1), 0px 4px 6px rgba(0, 0, 0, 0.05);
      display: inline-block;
      max-height: 0;
      overflow: hidden;
      transition: max-height 0.5s;
    }
    ^.expanded { 
      max-height: 500px;
    }
    ^container{
      background:$backgroundDefault; 
      border-radius: 4px;
      border: 1px solid $borderDefault;
      padding: 12px;
    }
    ^ h6{
      padding-bottom: 12px;
    }
  `,

  properties: [
    'expanded',
    'title'
  ],

  methods: [
    function init() {
      this
      .addClass(this.myClass())
      .enableClass('expanded', this.expanded$)
      .start()
        .addClass(this.myClass('container'))
        .start('h6').addClass('h600').add(this.title).end()
        .start('div', null, this.content$).style({ 'overflow': 'auto' }).end()
      .end();
    }
  ]
});
