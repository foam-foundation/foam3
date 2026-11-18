/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Two classes whose properties share one validation text. 'saleDate' is a Date
// on the first and a String (month and day, '0730') on the second.
foam.CLASS({
  package: 'foam.parse.test',
  name: 'FScriptParserCacheDated',

  properties: [
    {
      class: 'Date',
      name: 'saleDate',
      validationPredicates: [
        {
          args: [ 'saleDate' ],
          query: 'thisValue !exists||thisValue<=maxDate&&thisValue>=minDate',
          errorString: 'Invalid date value'
        }
      ]
    }
  ]
});

foam.CLASS({
  package: 'foam.parse.test',
  name: 'FScriptParserCacheTexted',

  properties: [
    {
      class: 'String',
      name: 'saleDate'
    },
    {
      class: 'Date',
      name: 'settledDate',
      validationPredicates: [
        {
          args: [ 'settledDate' ],
          query: 'thisValue !exists||thisValue<=maxDate&&thisValue>=minDate',
          errorString: 'Invalid date value'
        }
      ]
    }
  ]
});

foam.CLASS({
  package: 'foam.parse.test',
  name: 'FScriptParserCacheTest',
  extends: 'foam.core.test.JSTest',

  documentation: `
    A parsed FScript predicate names the properties of the parser that parsed
    it, so two properties with the same validation text must not share one.
    With a single cache for every parser, the second class's 'settledDate'
    check reused the predicate compiled for the first class's 'saleDate' and
    tested the string '0730' against maxDate, failing a valid row.
  `,

  requires: [
    'foam.parse.test.FScriptParserCacheDated',
    'foam.parse.test.FScriptParserCacheTexted'
  ],

  methods: [
    function runTest(x) {
      var dated = this.FScriptParserCacheDated.create({
        saleDate: new Date(Date.UTC(2026, 6, 30))
      });
      x.test(! dated.getErrors(), 'Date saleDate validates first, no errors');

      var texted = this.FScriptParserCacheTexted.create({
        saleDate:    '0730',
        settledDate: new Date(Date.UTC(2026, 6, 31))
      });
      var errors = texted.getErrors();
      x.test(! errors,
        'settledDate is checked, not the String saleDate; got ' +
        JSON.stringify(( errors || [] ).map(function(e) { return [ e[0].name, e[1] ]; })));
    }
  ]
});
