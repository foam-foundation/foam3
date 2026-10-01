/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.index',
  name: 'MDAOAndOrderTest',
  extends: 'foam.core.test.Test',

  documentation: `Guards a core DAO invariant: dao.where(A).where(B) must count
    the same as dao.where(AND(A, B)) and dao.where(AND(B, A)). The MDAO tree
    index simplifies an AND by pulling out the arg it can serve from its own
    index and applying the rest as a residual predicate. That path calls
    Not.partialEval, whose De Morgan rewrite used to mutate the predicate in
    place; a predicate reused across select() calls (as a chained second
    where() produces) was corrupted after the first use, so the count came back
    too high when a NOT(AND(EQ, NOT(HAS))) arg led the AND.`,

  javaImports: [
    'foam.dao.MDAO',
    'foam.dao.index.AndOrderRecord',
    'foam.dao.index.AndOrderStatus',
    'foam.mlang.predicate.Predicate',
    'foam.mlang.sink.Count',
    'static foam.mlang.MLang.*'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        MDAO dao = new MDAO(AndOrderRecord.getOwnClassInfo());
        // Index every property involved so the tree-index simplify path runs,
        // matching a real server DAO rather than a plain scan.
        dao.addIndex(AndOrderRecord.STATUS);
        dao.addIndex(AndOrderRecord.CASE_ID);
        dao.addIndex(AndOrderRecord.CB);

        dao.put_(x, mk(1, 99, AndOrderStatus.INIT,      ""));    // counts
        dao.put_(x, mk(2, 99, AndOrderStatus.WITHDRAWN, ""));    // abandoned -> excluded
        dao.put_(x, mk(3, 99, AndOrderStatus.WITHDRAWN, "CB"));  // filed then reversed -> counts

        Predicate inCase = EQ(AndOrderRecord.CASE_ID, 99L);

        // One excl() instance reused across every query below: this is the real
        // failure mode. MDAO planning must not mutate a predicate it is handed,
        // or the second and later uses of a shared predicate go wrong.
        Predicate excl = excl();

        long all      = count(x, dao, inCase);
        long single   = count(x, dao, AND(inCase, excl));
        long singleR  = count(x, dao, AND(excl, inCase));
        long chained  = ((Count) dao.inX(x).where(excl).where(inCase)
                          .select(new Count())).getValue();

        test(all == 3,     "baseline: all three rows in case 99; got " + all);
        test(single == 2,  "AND(inCase, excl) excludes abandoned; got " + single);
        test(singleR == 2, "AND(excl, inCase) excludes abandoned (order-independent); got " + singleR);
        test(chained == 2, "where(excl).where(inCase) == where(AND(...)); got " + chained);
      `
    },
    {
      name: 'excl',
      type: 'foam.mlang.predicate.Predicate',
      documentation: 'Keep a row unless it is WITHDRAWN with no cb (abandoned).',
      javaCode: `
        return NOT(AND(
          EQ(AndOrderRecord.STATUS, AndOrderStatus.WITHDRAWN),
          NOT(HAS(AndOrderRecord.CB))));
      `
    },
    {
      name: 'count',
      args: 'X x, foam.dao.MDAO dao, foam.mlang.predicate.Predicate p',
      type: 'Long',
      javaCode: `
        return ((foam.mlang.sink.Count) dao.inX(x).where(p)
          .select(new foam.mlang.sink.Count())).getValue();
      `
    },
    {
      name: 'mk',
      args: 'long id, long caseId, foam.dao.index.AndOrderStatus status, String cb',
      type: 'foam.dao.index.AndOrderRecord',
      javaCode: `
        AndOrderRecord r = new AndOrderRecord();
        r.setId(id);
        r.setCaseId(caseId);
        r.setStatus(status);
        r.setCb(cb);
        return r;
      `
    }
  ]
});
