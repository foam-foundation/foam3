/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.lang.test',
  name: 'CurrencyFormatJSTest',
  extends: 'foam.core.test.JSTest',

  documentation: `Money display contract (issue #5298): Currency.format takes
    MINOR units (cents) on every path — the declared arg type, the Java
    implementation, and the legacy JS branch all already agree on that, so the
    Intl branch must too. UnitValue (stores cents) passes through unchanged;
    DoubleUnitValue (stores major units) converts at its own edge. CurrencyView
    must show 12345 cents as 123.45, and a displayed value typed back in must
    round-trip to the same stored number.`,

  requires: [
    'foam.dao.MDAO',
    'foam.lang.Currency',
    'foam.u2.CurrencyView'
  ],

  methods: [
    {
      name: 'runTest',
      code: async function(x) {
        var gbp = this.Currency.create({ id: 'GBP', symbol: '£', precision: 2 });
        var dao = this.MDAO.create({ of: this.Currency });
        await dao.put(gbp);
        var ctx = x.createSubContext({ currencyDAO: dao });

        // --- Currency.format contract: minor units in ---
        var s = gbp.format(12345, false, false);
        x.test(s === '£123.45',
          'format takes minor units: 12345 cents GBP -> £123.45, got: ' + s);

        s = gbp.format(12345, true, true);
        x.test(s === '123.45',
          'format with symbol and id hidden still divides: ' + s);

        s = gbp.format(-12345, false, false);
        x.test(s === '(£123.45)',
          'negative cents format as accounting parens: ' + s);

        // --- minorAmount: the major->minor edge for callers holding majors ---
        var m = gbp.minorAmount(123.45);
        x.test(m === 12345,
          'minorAmount converts major to minor with rounding, got: ' + m);
        x.test(gbp.floatAmount(gbp.minorAmount(123.45)) === 123.45,
          'minorAmount is the inverse of floatAmount');
        s = gbp.format(gbp.minorAmount(123.45), false, false);
        x.test(s === '£123.45',
          'format(minorAmount(major)) is the caller idiom for major units: ' + s);

        // --- property-level formatting through the contract ---
        foam.CLASS({
          package: 'foam.lang.test',
          name: 'CurrencyFormatFixture',
          properties: [
            { class: 'UnitValue', name: 'cents', unitPropName: 'currency' },
            { class: 'DoubleUnitValue', name: 'pounds', unitPropName: 'currency' },
            { class: 'String', name: 'currency' }
          ]
        });
        var of = foam.lang.test.CurrencyFormatFixture;

        s = await of.CENTS.unitPropValueToString(ctx, 12345, 'GBP');
        x.test(s === '£123.45',
          'UnitValue (stored cents) formats without pre-dividing: ' + s);

        s = await of.POUNDS.unitPropValueToString(ctx, 123.45, 'GBP');
        x.test(s === '£123.45',
          'DoubleUnitValue (stored major) formats the same value: ' + s);

        // plain-string export path must be unaffected by the contract change
        s = await of.CENTS.unitPropValueToPlainString(ctx, 12345, 'GBP');
        x.test(s === '123.45',
          'UnitValue plain export stays 123.45: ' + s);
        s = await of.POUNDS.unitPropValueToPlainString(ctx, 123.45, 'GBP');
        x.test(s === '123.45',
          'DoubleUnitValue plain export stays 123.45: ' + s);

        // --- edit view: display and round-trip ---
        var centsView = this.CurrencyView.create(
          { currency: 'GBP', curr_: gbp, useMinorUnits: true }, ctx);
        s = String(centsView.dataToText(12345));
        x.test(s === '123.45',
          'edit view shows 12345 cents as 123.45, got: ' + s);
        var n = centsView.textToData('123.45');
        x.test(n === 12345,
          'typed 123.45 stores back as 12345 cents (no x100 drift), got: ' + n);

        var poundsView = this.CurrencyView.create(
          { currency: 'GBP', curr_: gbp, useMinorUnits: false }, ctx);
        s = String(poundsView.dataToText(123.45));
        x.test(s === '123.45',
          'major-units view (DoubleUnitValue) shows 123.45 as-is, got: ' + s);
        n = poundsView.textToData('123.45');
        x.test(n === 123.45,
          'major-units round-trip preserves 123.45, got: ' + n);
      }
    }
  ]
});
