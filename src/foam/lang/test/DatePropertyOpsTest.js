/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.lang.test',
  name: 'DatePropertyOpsTest',
  extends: 'foam.core.test.Test',

  documentation: `Behaviour of date-typed properties across the operations that
    read them through a PropertyInfo: GROUP_BY on a raw date key, GROUP_BY on a
    date expression, range predicates, ordered select, fclone, JSON round trip,
    and the unset/null path.

    GroupBy keys its buckets in a HashMap, so grouping is only correct while
    equal date values hash equal. These cases pin that down, together with the
    Date noon-UTC adapt and the distinction between an unset date and one
    explicitly set to null.`,

  javaImports: [
    'foam.dao.ArraySink',
    'foam.dao.DAO',
    'foam.dao.MDAO',
    'foam.lib.json.JSONParser',
    'foam.lib.json.Outputter',
    'foam.mlang.expr.DateToYYYYMMExpr',
    'foam.mlang.sink.Count',
    'foam.mlang.sink.GroupBy',
    'java.util.Date',
    'java.util.List',
    'java.util.Map',
    'static foam.mlang.MLang.AND',
    'static foam.mlang.MLang.COUNT',
    'static foam.mlang.MLang.GROUP_BY',
    'static foam.mlang.MLang.GTE',
    'static foam.mlang.MLang.LTE'
  ],

  methods: [
    {
      name: 'model',
      type: 'foam.lang.test.DateTimeTestModel',
      args: 'long id, long dayMillis',
      javaCode: `
        DateTimeTestModel o = new DateTimeTestModel();
        o.setId(id);
        o.setEventName("e" + id);
        o.setRegularDate(new Date(dayMillis));
        o.setRegularDateTime(new Date(dayMillis + 3600000L));
        o.setUtcDateTime(new Date(dayMillis + 7200000L));
        return o;
      `
    },
    {
      name: 'countIn',
      documentation: 'Bucket count for one GroupBy key, or -1 when absent.',
      type: 'Long',
      args: 'GroupBy g, Object key',
      javaCode: `
        Object sink = g.getGroups().get(key);
        return sink == null ? -1L : ((Count) sink).getValue();
      `
    },
    {
      name: 'runTest',
      javaCode: `
        // Noon UTC on 2020-01-15, 2020-01-20 and 2020-02-10.
        long JAN_15 = 1579089600000L;
        long JAN_20 = 1579521600000L;
        long FEB_10 = 1581336000000L;

        // Three records on Jan 15, two on Jan 20, one on Feb 10.
        DAO dao = new MDAO(DateTimeTestModel.getOwnClassInfo());
        long id = 1;
        for ( int i = 0 ; i < 3 ; i++ ) dao.put(model(id++, JAN_15));
        for ( int i = 0 ; i < 2 ; i++ ) dao.put(model(id++, JAN_20));
        dao.put(model(id++, FEB_10));

        // ---- GROUP_BY on the raw date property ----
        GroupBy byDate = (GroupBy) dao.select(
          GROUP_BY(DateTimeTestModel.REGULAR_DATE, COUNT()));

        test(byDate.getGroups().size() == 3,
          "GROUP_BY on a date property produced one bucket per distinct day. expected: 3, found: "
          + byDate.getGroups().size());

        // Fresh Date instances as lookup keys: buckets must be keyed by value.
        test(countIn(byDate, new Date(JAN_15)) == 3,
          "Jan 15 bucket counted 3 records, found by an equal-valued Date key. found: "
          + countIn(byDate, new Date(JAN_15)));
        test(countIn(byDate, new Date(JAN_20)) == 2,
          "Jan 20 bucket counted 2 records. found: " + countIn(byDate, new Date(JAN_20)));
        test(countIn(byDate, new Date(FEB_10)) == 1,
          "Feb 10 bucket counted 1 record. found: " + countIn(byDate, new Date(FEB_10)));

        // ---- GROUP_BY on a date expression ----
        DateToYYYYMMExpr month = new DateToYYYYMMExpr.Builder(getX())
          .setDelegate(DateTimeTestModel.REGULAR_DATE)
          .build();
        GroupBy byMonth = (GroupBy) dao.select(GROUP_BY(month, COUNT()));

        test(byMonth.getGroups().size() == 2,
          "GROUP_BY on DateToYYYYMMExpr produced one bucket per month. expected: 2, found: "
          + byMonth.getGroups().size());
        test(countIn(byMonth, "2020/01") == 5,
          "2020/01 bucket counted 5 records. found: " + countIn(byMonth, "2020/01"));
        test(countIn(byMonth, "2020/02") == 1,
          "2020/02 bucket counted 1 record. found: " + countIn(byMonth, "2020/02"));

        // ---- range predicate, boundaries inclusive ----
        ArraySink ranged = (ArraySink) dao.select_(getX(), new ArraySink(), 0,
          Long.MAX_VALUE, null,
          AND(
            GTE(DateTimeTestModel.REGULAR_DATE, new Date(JAN_15)),
            LTE(DateTimeTestModel.REGULAR_DATE, new Date(JAN_20))));
        test(ranged.getArray().size() == 5,
          "GTE/LTE range on a date property included both boundary days. expected: 5, found: "
          + ranged.getArray().size());

        // ---- ordered select ----
        ArraySink ordered = (ArraySink) dao.select_(getX(), new ArraySink(), 0,
          Long.MAX_VALUE, DateTimeTestModel.REGULAR_DATE, null);
        List rows = ordered.getArray();
        boolean ascending = true;
        for ( int i = 1 ; i < rows.size() ; i++ ) {
          long prev = ((DateTimeTestModel) rows.get(i - 1)).getRegularDate().getTime();
          long cur  = ((DateTimeTestModel) rows.get(i)).getRegularDate().getTime();
          if ( cur < prev ) ascending = false;
        }
        test(rows.size() == 6 && ascending,
          "Date-ordered select returned every row in ascending date order");

        // ---- repeated reads return equal values ----
        DateTimeTestModel sample = model(100, JAN_15);
        test(sample.getRegularDate().equals(sample.getRegularDate()),
          "Two reads of the same date property are equal");
        test(sample.getRegularDate().getTime() == sample.getRegularDate().getTime(),
          "Two reads of the same date property carry the same millis");
        test(sample.getRegularDate().hashCode() == new Date(JAN_15).hashCode(),
          "A date read back hashes equal to an independent Date of the same value");

        // ---- Date adapts to noon UTC, DateTime keeps its time ----
        DateTimeTestModel adapted = new DateTimeTestModel();
        adapted.setRegularDate(new Date(JAN_15 + 3600000L));
        adapted.setRegularDateTime(new Date(JAN_15 + 3600000L));
        test(adapted.getRegularDate().getTime() == JAN_15,
          "A Date property floors to noon UTC. expected: " + JAN_15
          + ", found: " + adapted.getRegularDate().getTime());
        test(adapted.getRegularDateTime().getTime() == JAN_15 + 3600000L,
          "A DateTime property keeps the time of day it was given");

        // ---- fclone ----
        DateTimeTestModel clone = (DateTimeTestModel) sample.fclone();
        test(clone.getRegularDate().getTime() == sample.getRegularDate().getTime()
          && clone.getRegularDateTime().getTime() == sample.getRegularDateTime().getTime()
          && clone.getUtcDateTime().getTime() == sample.getUtcDateTime().getTime(),
          "fclone carried every date value across");

        // ---- JSON round trip ----
        String wire = new Outputter(getX()).stringify(sample);
        DateTimeTestModel parsed =
          (DateTimeTestModel) new JSONParser().parseString(wire);
        test(parsed.getRegularDate().getTime() == sample.getRegularDate().getTime()
          && parsed.getRegularDateTime().getTime() == sample.getRegularDateTime().getTime()
          && parsed.getUtcDateTime().getTime() == sample.getUtcDateTime().getTime(),
          "A JSON round trip preserved every date value");

        // ---- unset, explicit null, and clear ----
        DateTimeTestModel empty = new DateTimeTestModel();
        test(empty.getRegularDate() == null,
          "An unset date property reads as null");
        test(! empty.regularDateIsSet_,
          "An unset date property reports isSet false");

        empty.setRegularDate(null);
        test(empty.getRegularDate() == null,
          "A date property explicitly set to null reads back as null");
        test(empty.regularDateIsSet_,
          "A date property explicitly set to null reports isSet true");

        empty.setRegularDate(new Date(JAN_15));
        test(empty.getRegularDate() != null, "A date set after null reads back");
        empty.clearRegularDate();
        test(empty.getRegularDate() == null && ! empty.regularDateIsSet_,
          "clear() returned the date property to unset");
      `
    }
  ]
});
