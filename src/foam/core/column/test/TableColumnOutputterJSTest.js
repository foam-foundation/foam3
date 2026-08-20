/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.column.test',
  name: 'TableColumnOutputterJSTest',
  extends: 'foam.core.test.JSTest',

  documentation: `Table export formatting for DoubleUnitValue columns:
    CommonColumnHandler must append the unit property to the query, and
    TableColumnOutputter must format via the unit property even when the
    projected unit value is a RefSummary {id, summary} map (Reference-typed
    unit props such as CurrencyCode project as maps, not code strings).`,

  requires: [
    'foam.core.column.CommonColumnHandler',
    'foam.core.column.TableColumnOutputter',
    'foam.dao.MDAO',
    'foam.lang.Currency'
  ],

  methods: [
    {
      name: 'runTest',
      code: async function(x) {
        foam.CLASS({
          package: 'foam.core.column.test',
          name: 'DUVExportFixture',
          properties: [
            { class: 'DoubleUnitValue', name: 'amount', unitPropName: 'currency' },
            { class: 'String', name: 'currency' }
          ]
        });
        var of  = foam.core.column.test.DUVExportFixture;
        var dao = this.MDAO.create({ of: this.Currency });
        await dao.put(this.Currency.create({ id: 'GBP', symbol: '£', precision: 2 }));
        var ctx = x.createSubContext({ currencyDAO: dao });

        var toQuery = this.CommonColumnHandler.create().returnPropNamesToQuery(
          [ { fullPropertyName: 'amount', property: of.AMOUNT } ]);
        x.test(toQuery.includes('currency'),
          'returnPropNamesToQuery appends unitPropName for a DoubleUnitValue column');

        var outputter = this.TableColumnOutputter.create();
        var props     = [ of.AMOUNT, of.CURRENCY ];
        var format    = async values => (await outputter.arrayOfValuesToArrayOfStrings(ctx, props, [ values ], 1, true))[0][0];

        var s = await format([ 1234.5, 'GBP' ]);
        x.test(/1.?234/.test(s) && ! /e/i.test(s),
          'formats DoubleUnitValue when unit value is a code string: ' + s);

        s = await format([ 1234.5, { id: 'GBP', summary: 'GBP - British Pound' } ]);
        x.test(/1.?234/.test(s) && ! /e/i.test(s),
          'formats when unit value is a RefSummary {id, summary} map: ' + s);

        s = await format([ -6.984919309616089e-10, { id: 'GBP' } ]);
        x.test(! /e/i.test(s) && /0.00/.test(s),
          'float noise exports as rounded zero, not scientific notation: ' + s);
      }
    }
  ]
});
