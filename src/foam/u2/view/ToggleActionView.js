/**
* @license
* Copyright 2022 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.u2',
  name: 'ToggleActionView',
  extends: 'foam.u2.ActionView',

  documentation: 'ActionView for a toggle-able action, state toggles on click',

  css: `
    ^active, ^active svg {
      background-color: $backgroundSecondary;
      color: $textBrand;
      fill: currentColor;
      border-color: $borderBrand;
    }
    ^active^tertiary, ^active^tertiary svg, ^active^text, ^active^text svg {
      background-color: transparent;
      border-color: transparent;
    }
  `,
  properties: [
    {
      class: 'Boolean',
      name: 'actionState'
    },
    {
      name: 'buttonStyle',
      value: foam.u2.ButtonStyle.TERTIARY
    }
  ],

  methods: [
    function initCls() {
      this.SUPER();
      this.enableClass(this.myClass('active'), this.actionState$);
    }
  ],
  listeners: [
    function click() {
      this.SUPER();
      this.actionState = ! this.actionState;
    }
  ]
});
