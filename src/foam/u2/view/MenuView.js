/**
* @license
* Copyright 2021 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.u2.view',
  name: 'MenuView',
  extends: 'foam.u2.tag.Button',

  imports: [
    'menu',
    // If rendered in a dropdown, close the dropdown after launching menu
    'dropdown? as parentMenuDropdown',
    'translationService'
  ],

  properties: [
    {
      name: 'label',
      expression: function(menu) {
        if ( menu && menu.label )
          return this.translationService.getTranslation(foam.locale, menu.id+".label", menu.label);
        return '';
      }
    },
    {
      name: 'icon',
      expression: function(menu) {
        return ( menu && menu.icon ) || '';
      }
    },
    {
      name: 'themeIcon',
      expression: function(menu) {
        return ( menu && menu.themeIcon ) || '';
      }
    },
    {
      class: 'Function',
      generateJava: false,
      name: 'isEnabled',
      documentation: 'Function to determine if button is enabled.',
      value: null
    }
  ],

  methods: [
    function render() {
      this.attrs({ disabled: this.createIsEnabled$(this.__context__, this).map((e) => e ? false : 'disabled') });
      this.SUPER();

    },
    function createIsEnabled$(x, data) {
      return this.isEnabled ?
      data.slot(this.isEnabled ) :
      foam.lang.ConstantSlot.create({ value: true });
    }
  ],

  listeners: [
    function click(evt) {
      this.SUPER(evt);
      if ( evt.detail && evt.detail > 1 ) return;
      let ret;
      ret = this.menu.handler.select(this.__subContext__, this.menu);
      if ( ret && ret.then ) {
        this.loading_ = true;
        ret.then(() => { this.loading_ = false; })
      }
      if ( this.parentMenuDropdown ) this.parentMenuDropdown.close();
      return;
    }
  ]
});
