/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.index',
  name: 'TreeIndexTest',
  extends: 'foam.core.test.Test',

  javaImports: [
    'foam.core.test.TestObject',
    'foam.lang.Indexer',
    'static foam.mlang.MLang.*',
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        System.out.println("###### TreeIndex");
        testINPredicateWithPrimaryIndex(x);
      `
    },
    {
      name: 'testINPredicateWithPrimaryIndex',
      args: 'Context x',
      javaCode: `
        var idIndex = new TreeIndex((Indexer) TestObject.getOwnClassInfo().getAxiomByName("id"), true);
        Object state = null;

        for ( long i = 0 ; i < 1000 ; i++ ) {
          state = idIndex.put(state, new TestObject(i, ""+i/4));
        }

        var plan = idIndex.planSelect(state, null, 0, Long.MAX_VALUE, null, IN(TestObject.ID, new Long[]{1L}));

        System.out.println(plan.cost());

        System.out.println("AAAA: " + idIndex.size(state) + ", level: " + ((TreeNode) state).level);
      `
    }
  ]
})