/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.index',
  name: 'TreeIndexInJsTest',
  extends: 'foam.core.test.JSTest',

  documentation: `Client-side IN behaviour over an MDAO.

    The JS evaluation path is not the Java one: In.f takes a Set fast path
    whenever arg2 is a Constant, which is every predicate built in the browser,
    and it compares members by their string form so that Date and other object
    values match by value instead of by reference. These assertions pin the row
    sets that path has to produce, and cover the enum shape the query bar
    produces, where a string stands in for an enum value.`,

  requires: [
    'foam.dao.MDAO',
    'foam.dao.index.AndOrderStatus',
    'foam.mlang.predicate.In',
    'foam.mlang.sink.Count'
  ],

  classes: [
    {
      name: 'Rec',
      properties: [
        { class: 'Long', name: 'id' },
        { class: 'Long', name: 'caseId' },
        { class: 'DateTime', name: 'when' },
        { class: 'Enum', of: 'foam.dao.index.AndOrderStatus', name: 'status' }
      ]
    }
  ],

  methods: [
    {
      name: 'countWhere',
      code: async function(dao, predicate) {
        var c = await dao.where(predicate).select(this.Count.create({}));
        return c.value;
      }
    },
    {
      name: 'inOn',
      documentation: 'An IN built the way the browser builds one: arg2 adapts to a Constant.',
      code: function(prop, values) {
        return this.In.create({ arg1: prop, arg2: values });
      }
    },
    async function runTest(x) {
      var dao = this.MDAO.create({ of: this.Rec });
      dao.addPropertyIndex(this.Rec.CASE_ID);

      var statuses = [ this.AndOrderStatus.INIT, this.AndOrderStatus.WITHDRAWN, this.AndOrderStatus.EXCLUDED ];
      for ( var i = 1 ; i <= 10 ; i++ ) {
        await dao.put(this.Rec.create({
          id:     i,
          caseId: i % 3,
          when:   new Date(Date.UTC(2026, 0, i)),
          status: statuses[i % 3]
        }));
      }

      var unsorted = await this.countWhere(dao, this.inOn(this.Rec.ID, [ 9, 1, 5, 4242 ]));
      x.test(unsorted === 3, 'unsorted keys plus an absent key return three rows; got ' + unsorted);

      var repeated = await this.countWhere(dao, this.inOn(this.Rec.ID, [ 3, 3, 5 ]));
      x.test(repeated === 2, 'a repeated key is counted once; got ' + repeated);

      var single = await this.countWhere(dao, this.inOn(this.Rec.ID, [ 7 ]));
      x.test(single === 1, 'IN over one key returns one row; got ' + single);

      var empty = await this.countWhere(dao, this.inOn(this.Rec.ID, []));
      x.test(empty === 0, 'IN over no keys returns nothing; got ' + empty);

      // caseId is i%3 over 1..10, so 0 -> {3,6,9} and 1 -> {1,4,7,10}.
      var nonUnique = await this.countWhere(dao, this.inOn(this.Rec.CASE_ID, [ 0, 1 ]));
      x.test(nonUnique === 7, 'IN on an indexed non-unique property returns every matching row; got ' + nonUnique);

      // The reason the Set path stringifies both sides: a Set matches objects by
      // reference, so two Date instances at the same instant are different keys.
      var dates = await this.countWhere(dao, this.inOn(this.Rec.WHEN, [
        new Date(Date.UTC(2026, 0, 2)),
        new Date(Date.UTC(2026, 0, 4))
      ]));
      x.test(dates === 2, 'IN over Date values matches by value, not reference; got ' + dates);

      // status is i%3 over 1..10: INIT -> {3,6,9}, WITHDRAWN -> {1,4,7,10}.
      var byEnum = await this.countWhere(dao, this.inOn(this.Rec.STATUS, [ this.AndOrderStatus.INIT ]));
      x.test(byEnum === 3, 'IN over an enum value matches; got ' + byEnum);

      // What the query bar produces: a string standing in for the enum value.
      var byEnumName = await this.countWhere(dao, this.inOn(this.Rec.STATUS, [ 'INIT' ]));
      x.test(byEnumName === 3, 'IN over an enum name string matches; got ' + byEnumName);

      // Lower case too. In.f carries an upperCase_ flag for exactly this, but it
      // is only read by the loop, which the Constant fast path returns before
      // reaching - so what makes this work is arg2's adapt coercing the string
      // to the enum value, not that flag.
      var byLowerName = await this.countWhere(dao, this.inOn(this.Rec.STATUS, [ 'init' ]));
      x.test(byLowerName === 3, 'IN over a lower case enum name matches; got ' + byLowerName);
    }
  ]
});
