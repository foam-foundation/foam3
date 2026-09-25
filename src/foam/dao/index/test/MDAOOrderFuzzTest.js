/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.index.test',
  name: 'MDAOOrderFuzzTest',
  extends: 'foam.core.test.Test',

  documentation: `Every order x predicate x skip x limit combination over an
    MDAO with secondary indexes, checked against a brute-force answer built
    from the same rows: filter with the predicate, stable-sort with the
    comparator, then skip and limit. Rows carry duplicate keys on every
    secondary index, unset dates, and an empty string, so a walk that gets
    a tie, a null or a group boundary wrong shows up here. Three index shapes
    are covered: one index per property added before the rows, the same added
    after them, and one compound chain over all four. Rows tied under the
    order are compared by key, not by id: ORDER BY promises nothing inside a
    tie.`,

  javaImports: [
    'foam.dao.ArraySink',
    'foam.dao.DAO',
    'foam.dao.MDAO',
    'foam.dao.index.AndOrderStatus',
    'foam.lang.Indexer',
    'foam.mlang.order.Comparator',
    'foam.mlang.predicate.Predicate',
    'java.util.ArrayList',
    'java.util.Collections',
    'java.util.Date',
    'java.util.List',
    'static foam.mlang.MLang.*'
  ],

  constants: [
    { name: 'ROWS', type: 'Integer', value: 40 },
    { name: 'DAY',  type: 'Long',    value: 86400000 },
    { name: 'T0',   type: 'Long',    value: 1700049600000 },
    { name: 'DUMP', type: 'String',  value: 'foam-order-fuzz.txt' }
  ],

  properties: [
    { class: 'Int', name: 'failures_', transient: true, hidden: true },
    { class: 'Int', name: 'checked_',  transient: true, hidden: true },
    { class: 'Object', name: 'dump_', transient: true, hidden: true, javaType: 'java.io.PrintWriter' }
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        Indexer[] secondary = new Indexer[] {
          IndexKeyRecord.GROUP_ID, IndexKeyRecord.NAME, IndexKeyRecord.WHEN, IndexKeyRecord.STATUS
        };

        // T0 is noon GMT: a Date property stores noon, so predicate constants
        // built from T0 compare the same way through f() and through the index.
        // Every combination's ids also go to a dump file in java.io.tmpdir, so two
        // builds can be diffed line by line.
        try {
          setDump_(new java.io.PrintWriter(new java.io.FileWriter(new java.io.File(System.getProperty("java.io.tmpdir"), DUMP))));
        } catch ( java.io.IOException e ) {
          print("no dump: " + e.getMessage());
        }

        String[] passes = { "separate, index first", "separate, index after", "compound chain" };
        for ( int pass = 0 ; pass < passes.length ; pass++ ) {
          List rows = new ArrayList();
          MDAO dao = new MDAO(IndexKeyRecord.getOwnClassInfo());
          if ( pass == 0 ) for ( Indexer i : secondary ) dao.addIndex(i);
          if ( pass == 2 ) dao.addIndex(secondary);
          for ( int i = 1 ; i <= ROWS ; i++ ) {
            IndexKeyRecord r = mk(i);
            rows.add(r);
            dao.put_(x, r);
          }
          if ( pass == 1 ) for ( Indexer i : secondary ) dao.addIndex(i);
          runAll(x, dao, rows, passes[pass]);
        }

        if ( getDump_() != null ) getDump_().close();
        test(getFailures_() == 0, getChecked_() + " combinations checked, " + getFailures_() + " disagree with brute force");
      `
    },

    {
      name: 'runAll',
      args: 'X x, MDAO dao, List rows, String pass',
      javaCode: `
        Date d = new Date(T0 + 3 * DAY);
        Predicate[] predicates = new Predicate[] {
          null,
          EQ(IndexKeyRecord.GROUP_ID, 2L),
          GT(IndexKeyRecord.ID, 25L),
          AND(GTE(IndexKeyRecord.WHEN, d), EQ(IndexKeyRecord.GROUP_ID, 1L)),
          NEQ(IndexKeyRecord.NAME, "bravo"),
          IN(IndexKeyRecord.GROUP_ID, new Object[] { 0L, 4L }),
          EQ(IndexKeyRecord.STATUS, AndOrderStatus.WITHDRAWN),
          LT(IndexKeyRecord.WHEN, new Date(T0 + 2 * DAY))
        };
        Comparator[] orders = new Comparator[] {
          null,
          IndexKeyRecord.ID,        DESC(IndexKeyRecord.ID),
          IndexKeyRecord.GROUP_ID,  DESC(IndexKeyRecord.GROUP_ID),
          IndexKeyRecord.NAME,      DESC(IndexKeyRecord.NAME),
          IndexKeyRecord.WHEN,      DESC(IndexKeyRecord.WHEN),
          IndexKeyRecord.STATUS,    DESC(IndexKeyRecord.STATUS),
          THEN_BY(DESC(IndexKeyRecord.GROUP_ID), IndexKeyRecord.ID),
          THEN_BY(IndexKeyRecord.GROUP_ID, DESC(IndexKeyRecord.ID))
        };
        long[] skips  = { 0, 1, 4 };
        long[] limits = { foam.dao.AbstractDAO.MAX_SAFE_INTEGER, 1, 2, 6 };

        for ( Predicate p : predicates )
          for ( Comparator o : orders )
            for ( long s : skips )
              for ( long l : limits )
                check(x, dao, rows, p, o, s, l, pass);
      `
    },

    {
      name: 'check',
      args: 'X x, MDAO dao, List rows, Predicate p, Comparator o, long skip, long limit, String pass',
      javaCode: `
        setChecked_(getChecked_() + 1);

        // Brute force: filter, stable sort, skip, limit. Rows start in id order.
        List expected = new ArrayList();
        for ( Object r : rows ) if ( p == null || p.f(r) ) expected.add(r);
        if ( o != null ) Collections.sort(expected, o);
        long from = Math.min(skip, expected.size());
        long to   = Math.min(expected.size(), from + limit);
        expected  = expected.subList((int) from, (int) to);

        DAO q = dao.inX(x);
        if ( p != null ) q = q.where(p);
        if ( o != null ) q = q.orderBy(o);
        if ( skip > 0 ) q = q.skip(skip);
        if ( limit != foam.dao.AbstractDAO.MAX_SAFE_INTEGER ) q = q.limit(limit);
        List actual = ((ArraySink) q.select(new ArraySink())).getArray();

        String label = pass + " / where=" + p + " order=" + o + " skip=" + skip + " limit=" + (limit == foam.dao.AbstractDAO.MAX_SAFE_INTEGER ? "none" : String.valueOf(limit));
        if ( getDump_() != null ) getDump_().println(label + " => " + ids(actual));

        // Without an order the row order is unspecified: compare the count, and
        // the set when nothing was skipped or cut.
        if ( o == null ) {
          boolean ok = actual.size() == expected.size();
          if ( ok && skip == 0 && limit == foam.dao.AbstractDAO.MAX_SAFE_INTEGER ) ok = idSet(actual).equals(idSet(expected));
          if ( ! ok ) fail(label, ids(expected), ids(actual));
          return;
        }

        // With an order: same length, every row passes the predicate, no id twice,
        // and row i ties with the brute-force row i under the comparator.
        boolean ok = actual.size() == expected.size() && distinct(actual);
        for ( int i = 0 ; ok && i < actual.size() ; i++ ) {
          Object a = actual.get(i);
          ok = ( p == null || p.f(a) ) && o.compare(a, expected.get(i)) == 0;
        }
        if ( ! ok ) fail(label, ids(expected), ids(actual));
      `
    },

    {
      name: 'distinct',
      args: 'List rows',
      type: 'Boolean',
      javaCode: `
        java.util.Set seen = new java.util.HashSet();
        for ( Object o : rows ) if ( ! seen.add(((IndexKeyRecord) o).getId()) ) return false;
        return true;
      `
    },

    {
      name: 'fail',
      args: 'String label, String expected, String actual',
      javaCode: `
        setFailures_(getFailures_() + 1);
        if ( getFailures_() <= 25 ) test(false, label + " expected=[" + expected + "] got=[" + actual + "]");
      `
    },

    {
      name: 'mk',
      args: 'int i',
      type: 'foam.dao.index.test.IndexKeyRecord',
      documentation: 'groupId repeats every 5, name cycles through 4 values with an empty one, every 7th date is unset, status cycles through 3.',
      javaCode: `
        String[] names = { "delta", "bravo", "", "alpha" };
        IndexKeyRecord r = new IndexKeyRecord();
        r.setId(i);
        r.setGroupId(i % 5);
        r.setName(names[i % 4]);
        if ( i % 7 != 0 ) r.setWhen(new Date(T0 + (i % 9) * DAY));
        r.setStatus(AndOrderStatus.values()[i % 3]);
        return r;
      `
    },

    {
      name: 'ids',
      args: 'List rows',
      type: 'String',
      javaCode: `
        StringBuilder sb = new StringBuilder();
        for ( Object o : rows ) {
          if ( sb.length() > 0 ) sb.append(',');
          sb.append(((IndexKeyRecord) o).getId());
        }
        return sb.toString();
      `
    },

    {
      name: 'idSet',
      args: 'List rows',
      type: 'String',
      javaCode: `
        List l = new ArrayList();
        for ( Object o : rows ) l.add(((IndexKeyRecord) o).getId());
        Collections.sort(l);
        return l.toString();
      `
    }
  ]
});
