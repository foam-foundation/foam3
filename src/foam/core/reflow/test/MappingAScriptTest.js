/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.test',
  name: 'MappingAScriptTest',
  extends: 'foam.core.test.JSTest',

  requires: [
    'foam.core.reflow.Mapping',
    'foam.core.reflow.MappingType'
  ],

  methods: [
    async function runTest(x) {
      foam.CLASS({
        package: 'foam.core.reflow.test',
        name: 'MappingAScriptRow',
        properties: [
          { class: 'String', name: 'name' },
          { class: 'Double', name: 'amount' }
        ]
      });
      var of  = foam.core.reflow.test.MappingAScriptRow;
      var row = { 'Customer Name': 'ada lovelace', 'Amount': '12.50', 'Side': 'DR' };
      var MT  = this.MappingType;

      // Saved mappings hold the type as its name or its ordinal; both still
      // mean the JavaScript option, now labelled for what it takes.
      x.test(MT.DYNAMIC.label === 'JavaScript' && MT.DYNAMIC.ordinal === 2, 'Dynamic is shown as JavaScript and keeps ordinal 2');
      x.test(MT.ASCRIPT.ordinal === 3, 'AScript is added after the existing types');
      [ 2, 'DYNAMIC' ].forEach(t => {
        var saved = foam.json.parseString(foam.json.stringify({ class: 'foam.core.reflow.Mapping', property: 'name', type: t, dynamicExpression: 'customer_Name.toUpperCase()' }));
        saved.of  = of;
        var obj   = of.create();
        saved.process(obj, undefined, row);
        x.test(saved.type === MT.DYNAMIC && obj.name === 'ADA LOVELACE', 'A mapping saved with type ' + JSON.stringify(t) + ' still runs its JavaScript: ' + obj.name);
      });

      var m = this.Mapping.create({ of: of, property: 'name', type: MT.ASCRIPT, formula: 'UPPER(customer_Name)' });
      var obj = of.create();
      m.process(obj, undefined, row);
      x.test(obj.name === 'ADA LOVELACE', 'An AScript mapping sets the value from its formula: ' + obj.name);

      var signed = this.Mapping.create({ of: of, property: 'amount', type: MT.ASCRIPT, formula: 'IF(side = "DR", -VALUE(amount), VALUE(amount))' });
      [ row, { 'Customer Name': 'b', 'Amount': '3', 'Side': 'CR' }, { 'Customer Name': 'c', 'Amount': '4', 'Side': 'DR' } ].forEach(r => {
        var o = of.create();
        signed.process(o, undefined, r);
        x.test(o.amount === ( r.Side === 'DR' ? -1 : 1 ) * Number(r.Amount), 'Signed amount for ' + r.Side + ' ' + r.Amount + ': ' + o.amount);
      });
      x.test(Object.keys(signed.formulaExprs_).length === 1, 'Three rows compile the formula once');

      var sample = this.Mapping.create({ of: of, property: 'name', type: MT.ASCRIPT, fileHeaders: Object.keys(row), sampleData: row, formula: 'LEFT(customer_Name, 3)' });
      x.test(sample.sampleValue === 'ada', 'The sample shows the formula over the first row: ' + sample.sampleValue);
      x.test(sample.formulaParser_ && sample.formulaParser_.of === sample.columns_(Object.keys(row)).of, 'The editor suggests the same column names the formula reads');

      sample.formula = 'UPPER(customer_Name) zz';
      x.test(String(sample.sampleValue).indexOf('stops making sense after "UPPER(customer_Name)') !== -1, 'Text after a valid formula is an error, not ignored: ' + sample.sampleValue);
      sample.formula = 'ROUND(amount';
      x.test(String(sample.sampleValue).indexOf('⚠ Error') === 0, 'An unfinished formula shows an error: ' + sample.sampleValue);

      var broken = this.Mapping.create({ of: of, property: 'name', type: MT.ASCRIPT, formula: 'ROUND(amount' });
      var o2 = of.create();
      broken.process(o2, undefined, row);
      broken.process(of.create(), undefined, row);
      x.test(o2.name === '' && Object.keys(broken.formulaExprs_).length === 1, 'A formula that does not parse leaves the value empty, and is parsed once, not once per row');
    }
  ]
});
