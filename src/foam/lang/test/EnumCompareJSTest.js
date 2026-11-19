/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// An enum whose own property and documentation sort the other way round from
// its ordinals: before the fix, JS compared them first.
foam.ENUM({
  package: 'foam.lang.test',
  name: 'EnumCompareTestStage',

  properties: [ 'meaning' ],

  values: [
    { name: 'FIRST',  documentation: 'z: first',  meaning: 'zebra' },
    { name: 'SECOND', documentation: 'y: second', meaning: 'yak' },
    { name: 'THIRD',  documentation: 'x: third',  meaning: 'xerus' }
  ]
});

foam.CLASS({
  package: 'foam.lang.test',
  name: 'EnumCompareTestRow',

  properties: [
    { class: 'Long', name: 'id' },
    { class: 'Enum', of: 'foam.lang.test.EnumCompareTestStage', name: 'stage' }
  ]
});

foam.CLASS({
  package: 'foam.lang.test',
  name: 'EnumCompareJSTest',
  extends: 'foam.core.test.JSTest',

  documentation: `Values of one enum compare by ordinal, as Java enums do, not
    by the enum's own properties.`,

  requires: [
    'foam.dao.MDAO',
    'foam.lang.test.EnumCompareTestRow',
    'foam.lang.test.EnumCompareTestStage'
  ],

  methods: [
    async function runTest(x) {
      var S = this.EnumCompareTestStage;
      var R = this.EnumCompareTestRow;
      var E = foam.mlang.ExpressionsSingleton.create();

      x.test(foam.util.compare(S.SECOND, S.FIRST) > 0, 'SECOND sorts after FIRST');
      x.test(foam.util.compare(S.FIRST, S.THIRD) < 0, 'FIRST sorts before THIRD');
      x.test(foam.util.compare(S.SECOND, S.SECOND) === 0, 'a value equals itself');
      x.test(foam.util.equals(S.FIRST, S.FIRST) && ! foam.util.equals(S.FIRST, S.SECOND),
        'equals still tells values apart');

      var sorted = [ S.THIRD, S.FIRST, S.SECOND ].sort(foam.util.compare).map(function(v) { return v.name; });
      x.test(sorted.join() === 'FIRST,SECOND,THIRD', 'sort follows the ordinals: ' + sorted.join());

      var row = R.create({ id: 1, stage: S.SECOND });
      x.test(E.GT(R.STAGE, S.FIRST).f(row) && ! E.LT(R.STAGE, S.FIRST).f(row),
        'GT/LT on an enum property follow the ordinals');

      var dao = this.MDAO.create({ of: R });
      await dao.put(R.create({ id: 1, stage: S.THIRD }));
      await dao.put(R.create({ id: 2, stage: S.FIRST }));
      await dao.put(R.create({ id: 3, stage: S.SECOND }));
      var ids = ( await dao.orderBy(R.STAGE).select() ).array.map(function(o) { return o.id; });
      x.test(ids.join() === '2,3,1', 'an MDAO ordered by the enum property follows the ordinals: ' + ids.join());
    }
  ]
});
