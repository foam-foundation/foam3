/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.lang.test',
  name: 'CodePropertyInitRaceJSTest',
  extends: 'foam.core.test.JSTest',

  documentation: `CurrencyCode and CountryCode normalize their value in an
    async initObject. A script that cloned a record and set a new currency
    right away lost it: one tick later initObject wrote the cloned value back,
    and the put sent the old currency with no error.`,

  requires: [
    'foam.dao.MDAO',
    'foam.lang.Currency'
  ],

  methods: [
    {
      name: 'runTest',
      code: async function(x) {
        var dao = this.MDAO.create({ of: this.Currency });
        await dao.put(this.Currency.create({ id: 'CAD', numericCode: 124 }));
        await dao.put(this.Currency.create({ id: 'USD', numericCode: 840 }));
        var ctx = x.createSubContext({ currencyDAO: dao });

        foam.CLASS({
          package: 'foam.lang.test',
          name: 'CodePropertyInitRaceFixture',
          properties: [
            { class: 'CurrencyCode', name: 'currency' },
            { class: 'CountryCode',  name: 'country' }
          ]
        });
        var of   = foam.lang.test.CodePropertyInitRaceFixture;
        var tick = () => new Promise(r => setTimeout(r, 50));

        var stored = of.create({ currency: 'USD', country: 'US' }, ctx);
        await tick();
        var edited = stored.clone();
        edited.currency = 'CAD';
        edited.country  = 'CA';
        await tick();
        x.test(edited.currency === 'CAD',
          'a currency set right after clone() is kept, got: ' + edited.currency);
        x.test(edited.country === 'CA',
          'a country set right after clone() is kept, got: ' + edited.country);

        var numeric = of.create({ currency: '124' }, ctx);
        await tick();
        x.test(numeric.currency === 'CAD',
          'a numeric currency code still normalizes on create, got: ' + numeric.currency);
      }
    }
  ]
});
