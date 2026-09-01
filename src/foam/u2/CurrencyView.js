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

  imports: [
    'translationService'
  ],

  properties: [
    ['precision', 2],
    {
      name: 'precision',
      expression: function(curr_) {
        return curr_?.precision ?? 2;
      },
    },
    {
      name: 'units',
      expression: function(curr_) {
        return curr_ ? (curr_.symbol || curr_.code) : '';
      },
    },
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
      var delimiter = this.translationService.getTranslation(foam.locale, 'Currency.delimiter', this.curr_?.delimiter ?? ',');
      if ( delimiter == '.' )
        delimiter = '\\.';

      const delim = new RegExp(delimiter, 'g');
      let plainText = text.replace(delim, '');
      plainText =
        ! this.hideSymbol && this.curr_.symbol && plainText.startsWith(this.curr_.symbol) ?
        plainText.substring(1) :
        plainText;
      var val = this.SUPER(plainText);
      var scale = Math.pow(10, this.precision);
      return this.useMinorUnits ? Math.round(val * scale) : Math.round(val * scale) / scale;
    },

    function dataToText(val) {
      // FloatView's Intl path formats the raw stored value, but currency data
      // may be in minor units — route through formatNumber, which converts.
      // Without this override the field shows 12345 cents as 12,345.00 while
      // textToData still multiplies on save (#5298 data-corruption pair).
      return this.formatNumber(val);
    },

    function formatNumber(val) {
      if ( ! this.curr_ ) return val.toFixed(2);
      // Currency.format takes minor units; mirror textToData's useMinorUnits
      var minor = this.useMinorUnits ? val : this.curr_.minorAmount(val);
      return this.curr_.format(minor, true, this.hideSymbol);
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
