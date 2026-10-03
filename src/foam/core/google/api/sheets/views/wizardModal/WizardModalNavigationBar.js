/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.google.api.sheets.views.wizardModal',
  name: 'WizardModalNavigationBar',
  extends: 'foam.u2.Element',

  documentation: `
    A premade NavigationBar that can take in methods that will allow navigation in WizardModal.

    This view/model was made with the intention to be used in a modal subview.
  `,

  css: `
    <<container {
      display: table;
      text-align: right;
      width: 100%;
      padding: 24px;
      box-sizing: border-box;
      background-color: $backgroundDefault;
    }
    << .foam-u2-ActionView-back,
    << .foam-u2-ActionView-option,
    << .foam-u2-ActionView-next {
      display: table-cell;
      vertical-align: middle;
      height: 40px;
    }
  `,

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.lang.Action',
      name: 'back'
    },
    {
      class: 'FObjectProperty',
      of: 'foam.lang.Action',
      name: 'option'
    },
    {
      class: 'FObjectProperty',
      of: 'foam.lang.Action',
      name: 'next'
    }
  ],

  methods: [
    function render() {
      var self = this;
      // If none of the three options has been provided, DO NOT render
      if ( ! this.back && ! this.option && ! this.next ) return;
      this.addClass(this.myClass());
      this.start('div').addClass(this.myClass('container'))
        .callIf(this.back, function() {
          // If NEXT exists, render that action
          this.tag(self.back, { buttonStyle: 'LINK' });
        })
        .callIf(this.option, function() {
          // If option exists, render that action
          this.tag(self.option, { buttonStyle: 'TEXT' });
        })
        .callIf(this.next, function() {
          // If BACK exists, render that action
          this.tag(self.next, { buttonStyle: 'PRIMARY' });
        })
      .end();
    }
  ]
});
