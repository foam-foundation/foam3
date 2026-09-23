/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang.predicate.test',
  name: 'DatePredicateConstantTest',
  extends: 'foam.core.test.Test',

  documentation: `A Date property stores noon GMT. The tree index normalises a
    query constant through the property's cast, so a constant at 18:00 finds
    the rows of that day; a scan compares the raw constant and misses them.
    The same predicate must return the same rows either way, and the same rows
    as the noon-aligned constant. Rows with the date unset are present so the
    null side of every comparison is covered too.`,

  javaImports: [
    'foam.dao.ArraySink',
    'foam.dao.DAO',
    'foam.dao.MDAO',
    'foam.dao.index.test.IndexKeyRecord',
    'foam.mlang.predicate.Predicate',
    'java.util.Date',
    'java.util.List',
    'static foam.mlang.MLang.*'
  ],

  constants: [
    { name: 'DAY',  type: 'Long', value: 86400000 },
    { name: 'NOON', type: 'Long', value: 1700049600000 }
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        MDAO plain = new MDAO(IndexKeyRecord.getOwnClassInfo());
        MDAO idx   = new MDAO(IndexKeyRecord.getOwnClassInfo());
        idx.addIndex(IndexKeyRecord.WHEN);

        // Twelve rows over five days; every fourth leaves the date unset.
        for ( int i = 1 ; i <= 12 ; i++ ) {
          IndexKeyRecord r = new IndexKeyRecord();
          r.setId(i);
          r.setGroupId(i % 2);
          if ( i % 4 != 0 ) r.setWhen(new Date(NOON + (i % 5) * DAY));
          plain.put_(x, r);
          idx.put_(x, r);
        }

        Date noon    = new Date(NOON + 2 * DAY);
        Date evening = new Date(NOON + 2 * DAY + 6 * 3600000L);
        Date morning = new Date(NOON + 2 * DAY - 6 * 3600000L);

        Date[]   constants = { evening, morning };
        String[] labels    = { "18:00", "06:00" };

        for ( int c = 0 ; c < constants.length ; c++ ) {
          Date d = constants[c];
          check(x, plain, idx, GTE(IndexKeyRecord.WHEN, d), GTE(IndexKeyRecord.WHEN, noon), "GTE at " + labels[c]);
          check(x, plain, idx, GT(IndexKeyRecord.WHEN, d),  GT(IndexKeyRecord.WHEN, noon),  "GT at " + labels[c]);
          check(x, plain, idx, LTE(IndexKeyRecord.WHEN, d), LTE(IndexKeyRecord.WHEN, noon), "LTE at " + labels[c]);
          check(x, plain, idx, LT(IndexKeyRecord.WHEN, d),  LT(IndexKeyRecord.WHEN, noon),  "LT at " + labels[c]);
          check(x, plain, idx, EQ(IndexKeyRecord.WHEN, d),  EQ(IndexKeyRecord.WHEN, noon),  "EQ at " + labels[c]);
          check(x, plain, idx, NEQ(IndexKeyRecord.WHEN, d), NEQ(IndexKeyRecord.WHEN, noon), "NEQ at " + labels[c]);
          check(x, plain, idx,
            AND(GTE(IndexKeyRecord.WHEN, d), EQ(IndexKeyRecord.GROUP_ID, 1L)),
            AND(GTE(IndexKeyRecord.WHEN, noon), EQ(IndexKeyRecord.GROUP_ID, 1L)),
            "AND(GTE, EQ) at " + labels[c]);
        }

        // The constant a table filter produces: the day, midnight local, as a plain Date.
        test("2,3,7,9".equals(ids(idx.inX(x).where(GTE(IndexKeyRecord.WHEN, evening)))),
          "GTE on the index returns the rows of that day and later; got " + ids(idx.inX(x).where(GTE(IndexKeyRecord.WHEN, evening))));
        test("2,3,7,9".equals(ids(plain.inX(x).where(GTE(IndexKeyRecord.WHEN, evening)))),
          "GTE on a scan returns the same rows; got " + ids(plain.inX(x).where(GTE(IndexKeyRecord.WHEN, evening))));
      `
    },

    {
      name: 'check',
      args: 'X x, MDAO plain, MDAO idx, Predicate p, Predicate atNoon, String label',
      javaCode: `
        String scanned = ids(plain.inX(x).where(p));
        String indexed = ids(idx.inX(x).where(p));
        String aligned = ids(plain.inX(x).where(atNoon));
        test(scanned.equals(indexed), label + ": scan=[" + scanned + "] index=[" + indexed + "]");
        test(scanned.equals(aligned), label + ": scan=[" + scanned + "] noon-aligned constant=[" + aligned + "]");
      `
    },

    {
      name: 'ids',
      args: 'DAO dao',
      type: 'String',
      javaCode: `
        List rows = ((ArraySink) dao.orderBy(IndexKeyRecord.ID).select(new ArraySink())).getArray();
        StringBuilder sb = new StringBuilder();
        for ( Object o : rows ) {
          if ( sb.length() > 0 ) sb.append(',');
          sb.append(((IndexKeyRecord) o).getId());
        }
        return sb.toString();
      `
    }
  ]
});
