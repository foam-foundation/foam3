/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.index.test',
  name: 'MDAOOrderDropJsTest',
  extends: 'foam.core.test.JSTest',

  documentation: `An ORDER BY the index cannot serve makes the client planner
    collect every matching row and sort it before the sink sees one. A sink
    whose result does not depend on put order - a Count, a GroupBy of Counts,
    a Pivot of either - must have the order dropped from the plan, and only
    when the select is unlimited: with a limit, which rows arrive depends on
    the order.`,

  implements: [ 'foam.mlang.Expressions' ],

  requires: [
    'foam.core.reflow.Pivot',
    'foam.dao.ArraySink',
    'foam.dao.MDAO'
  ],

  classes: [
    {
      name: 'Rec',
      properties: [
        { class: 'Long',   name: 'id' },
        { class: 'Long',   name: 'groupId' },
        { class: 'String', name: 'name' }
      ]
    }
  ],

  methods: [
    {
      name: 'sorts',
      documentation: 'Whether the plan for an ORDER BY name select with this sink still sorts.',
      code: function(dao, sink, limit) {
        var plan = dao.index.plan(sink, undefined, limit, this.Rec.NAME, undefined, dao.index);
        return plan.toString().indexOf('sorting=none') < 0;
      }
    },
    async function runTest(x) {
      var dao = this.MDAO.create({ of: this.Rec });
      await dao.put(this.Rec.create({ id: 1, groupId: 10, name: 'bravo' }));
      await dao.put(this.Rec.create({ id: 2, groupId: 20, name: 'alpha' }));
      await dao.put(this.Rec.create({ id: 3, groupId: 10, name: 'delta' }));

      var pivot = this.Pivot.create({ yFunc: [ this.Rec.GROUP_ID ], acc: this.COUNT() });

      x.test(this.sorts(dao, this.ArraySink.create()), 'ArraySink keeps its sort');
      x.test(! this.sorts(dao, this.GROUP_BY(this.Rec.GROUP_ID, this.COUNT())), 'GROUP_BY(COUNT) drops the sort');
      x.test(! this.sorts(dao, pivot), 'a Pivot of COUNT drops the sort');
      x.test(this.sorts(dao, pivot, 2), 'a limited Pivot keeps its sort');
      x.test(this.sorts(dao, this.GROUP_BY(this.Rec.GROUP_ID, this.ArraySink.create())), 'GROUP_BY(ArraySink) keeps its sort');
    }
  ]
});
