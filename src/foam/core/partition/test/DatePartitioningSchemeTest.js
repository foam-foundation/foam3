/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.partition.test',
  name: 'DatePartitioningSchemeTest',
  extends: 'foam.core.test.Test',

  documentation: 'Each DatePartitioningScheme value implements its own getPartition/step (per-constant enum bodies), and DatePartitionedDAO.getPartitions walks a date range at the scheme granularity, terminating on the range-end partition and bounding inverted ranges.',

  javaImports: [
    'foam.core.partition.DatePartitionedDAO',
    'foam.core.partition.DatePartitioningScheme',
    'foam.core.partition.test.PartitionStrRecord',
    'foam.mlang.Expr',
    'java.util.Calendar'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        // Per-value getPartition -- fixed date: Feb 1 2026
        Calendar cal = Calendar.getInstance();
        cal.clear();
        cal.set(2026, Calendar.FEBRUARY, 1);

        test("2026/2".equals(DatePartitioningScheme.YYYYMM.getPartition(cal)),   "YYYYMM names 2026/2, got "   + DatePartitioningScheme.YYYYMM.getPartition(cal));
        test("2026/32".equals(DatePartitioningScheme.YYYYDDD.getPartition(cal)), "YYYYDDD names 2026/32, got " + DatePartitioningScheme.YYYYDDD.getPartition(cal));
        test("2026/2/1".equals(DatePartitioningScheme.YYYYMMDD.getPartition(cal)), "YYYYMMDD names 2026/2/1, got " + DatePartitioningScheme.YYYYMMDD.getPartition(cal));
        String weekPart = 2026 + "/" + cal.get(Calendar.WEEK_OF_YEAR);
        test(weekPart.equals(DatePartitioningScheme.YYYYWW.getPartition(cal)), "YYYYWW names year/weekOfYear, got " + DatePartitioningScheme.YYYYWW.getPartition(cal));

        // Per-value step -- December rolls the year for months, Jan 31 rolls the month for days
        cal.clear();
        cal.set(2026, Calendar.DECEMBER, 15);
        DatePartitioningScheme.YYYYMM.step(cal);
        test("2027/1".equals(DatePartitioningScheme.YYYYMM.getPartition(cal)), "YYYYMM step rolls 2026/12 into 2027/1, got " + DatePartitioningScheme.YYYYMM.getPartition(cal));

        cal.clear();
        cal.set(2026, Calendar.JANUARY, 31);
        DatePartitioningScheme.YYYYMMDD.step(cal);
        test("2026/2/1".equals(DatePartitioningScheme.YYYYMMDD.getPartition(cal)), "YYYYMMDD step rolls Jan 31 into 2026/2/1, got " + DatePartitioningScheme.YYYYMMDD.getPartition(cal));

        cal.clear();
        cal.set(2026, Calendar.JUNE, 10);
        int week = cal.get(Calendar.WEEK_OF_YEAR);
        DatePartitioningScheme.YYYYWW.step(cal);
        test(cal.get(Calendar.WEEK_OF_YEAR) == week + 1, "YYYYWW step advances one week");

        // getPartitions walks the range at scheme granularity
        test(joinParts(rangeParts(x, DatePartitioningScheme.YYYYMM, 2025, Calendar.NOVEMBER, 15, 2026, Calendar.FEBRUARY, 3))
          .equals("2025/11,2025/12,2026/1,2026/2"),
          "YYYYMM range walk spans Nov 2025 - Feb 2026: " + joinParts(rangeParts(x, DatePartitioningScheme.YYYYMM, 2025, Calendar.NOVEMBER, 15, 2026, Calendar.FEBRUARY, 3)));

        String[] days = rangeParts(x, DatePartitioningScheme.YYYYMMDD, 2026, Calendar.JANUARY, 30, 2026, Calendar.FEBRUARY, 1);
        test(joinParts(days).equals("2026/1/30,2026/1/31,2026/2/1"), "YYYYMMDD range walk steps days: " + joinParts(days));

        String[] weeks = rangeParts(x, DatePartitioningScheme.YYYYWW, 2026, Calendar.JUNE, 1, 2026, Calendar.JUNE, 22);
        test(weeks.length == 4, "YYYYWW range walk steps weeks (4 partitions over 22 days, got " + weeks.length + ")");

        // Inverted (contradictory) range terminates with the start partition only
        String[] inverted = rangeParts(x, DatePartitioningScheme.YYYYMM, 2026, Calendar.MARCH, 1, 2026, Calendar.JANUARY, 1);
        test(inverted.length == 1 && "2026/3".equals(inverted[0]), "inverted range yields just the start partition, got " + joinParts(inverted));
      `
    },
    {
      name: 'rangeParts',
      args: 'foam.lang.X x, DatePartitioningScheme scheme, int y1, int m1, int d1, int y2, int m2, int d2',
      type: 'String[]',
      javaCode: `
        Calendar from = Calendar.getInstance();
        from.clear();
        from.set(y1, m1, d1);
        Calendar to = Calendar.getInstance();
        to.clear();
        to.set(y2, m2, d2);

        DatePartitionedDAO dao = new DatePartitionedDAO(
          x, PartitionStrRecord.getOwnClassInfo(), "dpsTest_", (Expr) PartitionStrRecord.DATE, scheme);
        return dao.getPartitions(new java.util.Date[] { from.getTime(), to.getTime() });
      `
    },
    {
      name: 'joinParts',
      args: 'String[] parts',
      type: 'String',
      javaCode: `
        return String.join(",", parts);
      `
    }
  ]
});
