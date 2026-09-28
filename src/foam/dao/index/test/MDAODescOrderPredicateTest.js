/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.index.test',
  name: 'MDAODescOrderPredicateTest',
  extends: 'foam.core.test.Test',

  documentation: `A "newest first" page over a filtered DAO: where(p), ORDER BY
    -id, limit 10. The primary index can answer it by walking backwards and
    stopping at the tenth match, the way the ascending walk already stops.
    ScanPlan only takes the reverse walk when there is no predicate, so with
    one it evaluates every row, collects every match and sorts them to return
    ten. The select runs through an EasyDAO, the way a served DAO receives it,
    and the predicate counts its own evaluations: the row set must be right,
    and the scan must not visit the whole DAO to produce it.`,

  javaImports: [
    'foam.dao.ArraySink',
    'foam.dao.DAO',
    'foam.dao.EasyDAO',
    'foam.mlang.predicate.AbstractPredicate',
    'foam.mlang.predicate.Predicate',
    'java.util.List',
    'static foam.mlang.MLang.*'
  ],

  constants: [
    { name: 'ROWS',  type: 'Long', value: 200 },
    { name: 'LIMIT', type: 'Long', value: 10 }
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        DAO dao = new EasyDAO.Builder(x)
          .setOf(IndexKeyRecord.getOwnClassInfo())
          .setAuthorize(false)
          .build();

        // Even ids are in group 10, odd ids in group 20.
        for ( long i = 1 ; i <= ROWS ; i++ ) {
          IndexKeyRecord r = new IndexKeyRecord();
          r.setId(i);
          r.setGroupId(i % 2 == 0 ? 10L : 20L);
          dao.inX(x).put(r);
        }

        final long[] calls = { 0 };
        Predicate inGroup10 = new AbstractPredicate() {
          public boolean f(Object o) {
            calls[0]++;
            return ((IndexKeyRecord) o).getGroupId() == 10L;
          }
        };

        String asc = ids(dao.inX(x).where(inGroup10).orderBy(IndexKeyRecord.ID).limit(LIMIT));
        test("2,4,6,8,10,12,14,16,18,20".equals(asc), "ASC(id) page under a predicate; got " + asc);
        test(calls[0] < ROWS / 2,
          "ASC(id) page stops at the limit: " + calls[0] + " of " + ROWS + " rows evaluated");

        calls[0] = 0;
        String desc = ids(dao.inX(x).where(inGroup10).orderBy(DESC(IndexKeyRecord.ID)).limit(LIMIT));
        test("200,198,196,194,192,190,188,186,184,182".equals(desc), "DESC(id) page under a predicate; got " + desc);
        test(calls[0] < ROWS / 2,
          "DESC(id) page walks the index backwards and stops at the limit: " + calls[0] + " of " + ROWS + " rows evaluated");
      `
    },
    {
      name: 'ids',
      args: 'foam.dao.DAO dao',
      type: 'String',
      javaCode: `
        StringBuilder sb = new StringBuilder();
        List rows = ((ArraySink) dao.select(new ArraySink())).getArray();
        for ( Object o : rows ) {
          if ( sb.length() > 0 ) sb.append(',');
          sb.append(((IndexKeyRecord) o).getId());
        }
        return sb.toString();
      `
    }
  ]
});
