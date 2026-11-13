/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang.predicate.test',
  name: 'PredicateJSTest',
  extends: 'foam.core.test.JSTest',

  documentation: `Three small JS predicate fixes: NOT(GT) keeps its value when
    partialEval rewrites it as LTE, EQ with a null constant builds for a
    property whose adapt answers null, and CONTAINS of "" matches an empty
    string as it does in Java.`,

  requires: [
    'foam.dao.MDAO',
    'foam.dao.index.test.IndexKeyRecord'
  ],

  methods: [
    async function runTest(x) {
      var E = foam.mlang.ExpressionsSingleton.create();
      var R = this.IndexKeyRecord;

      // NOT(GT(a, 9)) is LTE(a, 9): the rewrite used to drop the 9 (arg22 typo).
      var lte = E.NOT(E.GT(R.GROUP_ID, 9)).partialEval();
      x.test(foam.mlang.predicate.Lte.isInstance(lte) && !! lte.arg2 && lte.arg2.f() === 9,
        'NOT(GT(groupId, 9)) partialEvals to LTE(groupId, 9)');

      var dao = this.MDAO.create({ of: R });
      await dao.put(R.create({ id: 1, groupId: 5, name: 'a' }));
      await dao.put(R.create({ id: 2, groupId: 12, name: 'a' }));
      var rows;
      try {
        rows = ( await dao.where(E.AND(
          E.NOT(E.GT(R.GROUP_ID, 9)),
          E.OR(E.EQ(R.NAME, 'x'), E.EQ(R.ID, 1))
        )).select() ).array.map(function(o) { return o.id; });
      } catch (e) {
        rows = e.message;
      }
      x.test(foam.util.equals(rows, [ 1 ]),
        'an MDAO select of NOT(GT) next to an OR answers [1], not a throw: ' + rows);

      // EQ(date, null) used to throw while it was built (null.value in Binary.arg2's adapt).
      var eqNull;
      try { eqNull = E.EQ(R.WHEN, null); } catch (e) { eqNull = e.message; }
      x.test(foam.mlang.predicate.Eq.isInstance(eqNull),
        'EQ(when, null) builds: ' + eqNull);
      if ( foam.mlang.predicate.Eq.isInstance(eqNull) ) {
        x.test(eqNull.f(R.create({ id: 3 })) && ! eqNull.f(R.create({ id: 4, when: new Date(0) })),
          'EQ(when, null) matches a row with no date and not one with a date');
      }

      // CONTAINS(s, "") on an empty string: Java's "".contains("") is true.
      var empty = R.create({ id: 5 });
      x.test(E.CONTAINS(R.NAME, '').f(empty), 'CONTAINS(name, "") matches an empty name');
      x.test(! E.CONTAINS(R.NAME, 'a').f(empty), 'CONTAINS(name, "a") does not match an empty name');
      x.test(E.CONTAINS_IC(R.NAME, '').f(empty), 'CONTAINS_IC(name, "") matches an empty name');
      x.test(E.CONTAINS(R.NAME, 'b').f(R.create({ id: 6, name: 'abc' })), 'CONTAINS(name, "b") still matches "abc"');
    }
  ]
});
