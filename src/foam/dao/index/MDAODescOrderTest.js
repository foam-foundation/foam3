/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.index',
  name: 'MDAODescOrderTest',
  extends: 'foam.core.test.Test',

  documentation: `Guards DESC ordering on an indexed property when the select
    has no skip and no effective limit. ScanPlan turns DESC(indexedProp) into
    a reverse tree walk instead of a sort, and TreeNode.select used to take the
    plain in-order walk whenever skip was 0 and limit was unbounded, so the
    rows came back ascending. TreeIndex.planSelect also widens any limit that
    is at least the collection size to unbounded, so a paged table over a
    small DAO hit the same path.`,

  javaImports: [
    'foam.dao.ArraySink',
    'foam.dao.MDAO',
    'foam.dao.index.AndOrderRecord',
    'java.util.List',
    'static foam.mlang.MLang.*'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        MDAO dao = new MDAO(AndOrderRecord.getOwnClassInfo());
        dao.addIndex(AndOrderRecord.CASE_ID);

        for ( long i = 1 ; i <= 3 ; i++ ) {
          AndOrderRecord r = new AndOrderRecord();
          r.setId(i);
          r.setCaseId(99L);
          dao.put_(x, r);
        }

        test("321".equals(ids(dao.inX(x).orderBy(DESC(AndOrderRecord.ID)))),
          "DESC(ID), no limit: primary index walks in reverse; got " + ids(dao.inX(x).orderBy(DESC(AndOrderRecord.ID))));

        test("321".equals(ids(dao.inX(x).orderBy(DESC(AndOrderRecord.ID)).limit(50))),
          "DESC(ID), limit above size: still reverse; got " + ids(dao.inX(x).orderBy(DESC(AndOrderRecord.ID)).limit(50)));

        test("32".equals(ids(dao.inX(x).orderBy(DESC(AndOrderRecord.ID)).limit(2))),
          "DESC(ID), limit below size: reverse walk honours limit; got " + ids(dao.inX(x).orderBy(DESC(AndOrderRecord.ID)).limit(2)));

        test("321".equals(ids(dao.inX(x).where(EQ(AndOrderRecord.CASE_ID, 99L)).orderBy(DESC(AndOrderRecord.ID)))),
          "DESC(ID) under an indexed EQ: sub-tree walks in reverse; got " + ids(dao.inX(x).where(EQ(AndOrderRecord.CASE_ID, 99L)).orderBy(DESC(AndOrderRecord.ID))));

        test("123".equals(ids(dao.inX(x).orderBy(AndOrderRecord.ID))),
          "ASC(ID) unchanged; got " + ids(dao.inX(x).orderBy(AndOrderRecord.ID)));
      `
    },
    {
      name: 'ids',
      args: 'foam.dao.DAO dao',
      type: 'String',
      javaCode: `
        StringBuilder sb = new StringBuilder();
        List rows = ((ArraySink) dao.select(new ArraySink())).getArray();
        for ( Object o : rows ) sb.append(((AndOrderRecord) o).getId());
        return sb.toString();
      `
    }
  ]
});
