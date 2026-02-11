/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2',
  name: 'CurrencyView',
  extends: 'foam.u2.FloatView',

  documentation: 'View for formatting currency values. Supports both UnitValue (Long/cents) and DoubleUnitValue (Double/dollars).',

  properties: [
    ['precision', 2],
    ['trimZeros', false],
    ['onKey', true],
    {
      class: 'Reference',
      name: 'currency',
      of: 'foam.lang.Currency',
      value: 'CAD'
    },
    'curr_',
    ['hideSymbol', true],
    {
      class: 'Boolean',
      name: 'useMinorUnits',
      documentation: 'When true, converts between major and minor units (e.g. dollars to cents). Set to false for DoubleUnitValue properties that store values in major units.',
      value: true
    }
  ],

  methods: [
    async function render() {
      let sup = this.SUPER;
      let self = this;
      this.curr_ = await this.currency$find;
      sup.call(self);
    },

    function textToData(text) {
      const delim = new RegExp((this.curr_?.delimiter ?? ','), 'g');
      let plainText = text.replace(delim, '')
      plainText = 
        ! this.hideSymbol && this.curr_.symbol && plainText.startsWith(this.curr_.symbol) ?
        plainText.substring(1) :
        plainText;
      var val = this.SUPER(plainText);
      return this.useMinorUnits ? Math.round(val * 100) : val;
    },

    function formatNumber(val) {
      return this.curr_ ? this.curr_.format(val, true, this.hideSymbol) : val.toFixed(2);
    },

    function link() {
      this.SUPER();

      // If the values is currently displaying 0.00, then when
      // you select focus the screen changes its value to '',
      // so that you don't have to delete the 0.00 to enter your
      // value.
      this.on('focus', () => {
        var view = this.attrSlot(null, this.onKey ? 'input' : null);
        if ( ! this.data ) { view.set(''); }
      });
    }
  ]
});
