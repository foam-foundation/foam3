/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.index',
  name: 'TreeIndexInTest',
  extends: 'foam.core.test.Test',

  documentation: `An IN over an indexed property must be answered from the tree
    rather than by scanning every row, and must return exactly the rows a scan
    would have returned.

    Two things make that easy to get wrong. The tree compares keys through the
    property's comparePropertyToValue, which casts both sides, while In.f
    compares them with equals - so the two disagree on a key like "5" against a
    Long id. And Count is answered from the tree's size while a row select
    re-tests the predicate through ValuePlan, so a lookup that trusts the tree's
    equality makes those two report different things about the same query. Every
    case below therefore checks the row ids AND that Count agrees with the number
    of rows returned; a cardinality-only test hides exactly this bug.`,

  javaImports: [
    'foam.dao.AbstractDAO',
    'foam.dao.ArraySink',
    'foam.dao.MDAO',
    'foam.mlang.Constant',
    'foam.mlang.Expr',
    'foam.mlang.predicate.In',
    'foam.mlang.predicate.Predicate',
    'java.util.ArrayList',
    'java.util.Collections',
    'java.util.List',
    'static foam.mlang.MLang.*'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        MDAO dao = new MDAO(AndOrderRecord.getOwnClassInfo());
        dao.addIndex(AndOrderRecord.CASE_ID);
        for ( long i = 1 ; i <= 1000 ; i++ ) dao.put_(x, mk(i, i % 3, "cb" + i));

        // The shape a browser-built IN arrives in: ExprProperty wraps the array
        // in a Constant, so arg2 is a Constant holding an Object[].
        check(x, dao, in(AndOrderRecord.ID, new Object[] {9L, 1L, 5L}),
          "1,5,9", "IN over Constant(Object[])");

        // The shape MLang.IN builds: prepare() turns an Object[] into an
        // ArrayConstant, a sibling of Constant rather than a subclass.
        check(x, dao, IN(AndOrderRecord.ID, new Object[] {9L, 1L, 5L}),
          "1,5,9", "IN over ArrayConstant");

        // Keys out of ascending order with one that is absent. A min/max range
        // trim gets this wrong; exact key lookups do not.
        check(x, dao, in(AndOrderRecord.ID, new Object[] {9L, 1L, 5L, 4242L}),
          "1,5,9", "unsorted keys plus an absent key");

        // A repeated key must produce one node, not two, or the tree's size
        // double-counts it.
        check(x, dao, in(AndOrderRecord.ID, new Object[] {3L, 3L, 5L}),
          "3,5", "a repeated key");

        // Both go through MLang.IN: In.partialEval rewrites the Constant shape
        // (0 keys to FALSE, 1 key to Eq) before the index ever sees it, so only
        // the ArrayConstant shape actually exercises the lookup.
        check(x, dao, IN(AndOrderRecord.ID, new Object[] {7L}), "7", "one key");
        check(x, dao, IN(AndOrderRecord.ID, new Object[] {}), "", "no keys");

        // Non-unique index: every row behind each key, through a TreeIndex tail
        // rather than a ValueIndex. caseId is i%3 over 1..1000, so 0 covers 333
        // rows and 1 covers 334.
        long nonUnique = consistentCount(x, dao, in(AndOrderRecord.CASE_ID, new Object[] {0L, 1L}));
        test(nonUnique == 667, "IN on a non-unique index returns every row behind each key; got " + nonUnique);

        // Unindexed property: the lookup declines and the scan filters.
        check(x, dao, in(AndOrderRecord.CB, new Object[] {"cb2", "cb4"}),
          "2,4", "IN on an unindexed property");

        // A null key cannot reach the tree - cast(null) throws on a primitive
        // property - so this must fall back to the scan.
        check(x, dao, in(AndOrderRecord.ID, new Object[] {null, 3L}),
          "3", "a null key");

        // A String key against a Long id: the tree matches it (cast coerces),
        // In.f does not (equals). Whatever the answer is, Count and a row select
        // have to agree on it, and it has to be the answer a scan gives - which
        // is none, because In.f decides. EQ says 1 here, because Binary coerces
        // its Constant while ArrayBinary leaves an ArrayConstant alone; that
        // asymmetry lives in predicate construction, not in this index.
        check(x, dao, IN(AndOrderRecord.ID, new Object[] {"5"}),
          "", "a String key against a Long id");

        // A key no cast can handle must degrade to the scan rather than throw
        // inside the plan auction, where AltIndex would swallow it and answer
        // nothing at all.
        check(x, dao, IN(AndOrderRecord.ID, new Object[] {"not-a-number", 3L}),
          "3", "an uncomparable key alongside a good one");

        planCosts(x);
      `
    },
    {
      name: 'planCosts',
      args: 'X x',
      documentation: `Cost is what proves the index answered the query: a scan
        costs the row count, a lookup costs the number of matches. Also pins the
        guard that declines the lookup when it would cost more than a scan.`,
      javaCode: `
        TreeIndex idx   = new TreeIndex(AndOrderRecord.ID, true);
        Object    state = null;
        for ( long i = 1 ; i <= 1000 ; i++ ) state = idx.put(state, mk(i, i % 3, "cb" + i));

        long cost = idx.planSelect(state, null, 0, AbstractDAO.MAX_SAFE_INTEGER, null,
          in(AndOrderRecord.ID, new Object[] {9L, 1L, 5L})).cost();
        test(cost == 3, "IN plan costs the 3 matches, not the 1000 rows; got " + cost);

        // More keys than the tree has rows: looking each one up costs more than
        // reading the table, so the plan must stay a scan.
        Object[] many = new Object[2000];
        for ( int i = 0 ; i < many.length ; i++ ) many[i] = (long) i;
        long scanCost = idx.planSelect(state, null, 0, AbstractDAO.MAX_SAFE_INTEGER, null,
          in(AndOrderRecord.ID, many)).cost();
        test(scanCost == 1000, "an IN listing more keys than rows stays a scan; got " + scanCost);

        // In.f's HashSet fast path has to cover the ArrayConstant shape too, or
        // every MLang.IN caller keeps paying the O(n) compareTo loop.
        In arrayIn = (In) IN(AndOrderRecord.ID, new Object[] {9L, 1L, 5L});
        arrayIn.f(mk(9, 0, "cb9"));
        test(arrayIn.getArg2AsSet() != null, "IN over ArrayConstant builds the HashSet fast path");
      `
    },
    {
      name: 'check',
      args: 'X x, foam.dao.MDAO dao, foam.mlang.predicate.Predicate p, String expectedIds, String what',
      documentation: 'Asserts the exact rows, and that Count agrees with them.',
      javaCode: `
        String got = ids(x, dao, p);
        test(expectedIds.equals(got), what + " returns rows [" + expectedIds + "]; got [" + got + "]");
        consistentCount(x, dao, p);
      `
    },
    {
      name: 'consistentCount',
      args: 'X x, foam.dao.MDAO dao, foam.mlang.predicate.Predicate p',
      type: 'Long',
      documentation: `Count reads the tree size; a row select re-tests the
        predicate. They must report the same thing about the same query.`,
      javaCode: `
        long counted = ((foam.mlang.sink.Count) dao.inX(x).where(p)
          .select(new foam.mlang.sink.Count())).getValue();
        long selected = rows(x, dao, p).size();
        test(counted == selected,
          "count agrees with the rows returned for " + p + "; count " + counted + ", rows " + selected);
        return counted;
      `
    },
    {
      name: 'rows',
      args: 'X x, foam.dao.MDAO dao, foam.mlang.predicate.Predicate p',
      type: 'java.util.List',
      javaCode: `
        return ((ArraySink) dao.inX(x).where(p).select(new ArraySink())).getArray();
      `
    },
    {
      name: 'ids',
      args: 'X x, foam.dao.MDAO dao, foam.mlang.predicate.Predicate p',
      type: 'String',
      javaCode: `
        List<Long> found = new ArrayList<>();
        for ( Object o : rows(x, dao, p) ) found.add(((AndOrderRecord) o).getId());
        Collections.sort(found);

        StringBuilder b = new StringBuilder();
        for ( int i = 0 ; i < found.size() ; i++ ) {
          if ( i > 0 ) b.append(',');
          b.append(found.get(i));
        }
        return b.toString();
      `
    },
    {
      name: 'in',
      documentation: `An IN whose arg2 is a Constant holding the array, which is
        what ExprProperty.adaptValue produces for a client-built predicate.`,
      args: 'foam.mlang.Expr arg1, Object[] keys',
      type: 'foam.mlang.predicate.Predicate',
      javaCode: `
        In in = new In();
        in.setArg1(arg1);
        in.setArg2(new Constant(keys));
        return in;
      `
    },
    {
      name: 'mk',
      args: 'long id, long caseId, String cb',
      type: 'foam.dao.index.AndOrderRecord',
      javaCode: `
        AndOrderRecord r = new AndOrderRecord();
        r.setId(id);
        r.setCaseId(caseId);
        r.setCb(cb);
        return r;
      `
    }
  ]
});
