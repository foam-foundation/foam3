/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.partition.test',
  name: 'PartitionedDAOSelectTest',
  extends: 'foam.core.test.Test',

  documentation: `PartitionedDAO.select(): discovers its partitions from disk,
    fans out across all of them when the predicate carries an AllPartitions
    naming its property, still routes a plain EQ to the one partition, and
    refuses the two cases that would otherwise fail silently -- a query with no
    partition selector, and an ordering spanning partitions.`,

  javaImports: [
    'foam.core.fs.FileSystemStorage',
    'foam.core.fs.Storage',
    'foam.core.partition.AllPartitions',
    'foam.core.partition.DatePartitionedDAO',
    'foam.core.partition.DatePartitioningScheme',
    'foam.core.partition.PartitionedDAO',
    'foam.dao.ArraySink',
    'foam.dao.DAO',
    'foam.lang.X',
    'foam.mlang.Expr',
    'foam.mlang.sink.Count',
    'java.io.File',
    'java.util.Arrays',
    'java.util.Calendar',
    'java.util.Date',
    'static foam.mlang.MLang.AND',
    'static foam.mlang.MLang.COUNT',
    'static foam.mlang.MLang.EQ',
    'static foam.mlang.MLang.GTE'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        testDiscoveryAndFanOut(x);
        testRefusals(x);
        testRolloverNaming(x);
        testNestedDateRange(x);
      `
    },

    {
      name: 'testDiscoveryAndFanOut',
      args: 'X x',
      javaThrows: [ 'Throwable' ],
      javaCode: `
        PartitionedDAO dao = new PartitionedDAO(
          storageContext(x, newStorageDir()), PartitionStrRecord.getOwnClassInfo(),
          "sel/", PartitionStrRecord.BUCKET);

        dao.put(rec(5, "a"));
        dao.put(rec(7, "b"));
        dao.put(rec(7, "c"));

        String[] parts = dao.getPartitions();
        test(Arrays.equals(parts, new String[] { "5", "7" }),
          "getPartitions() discovered the written partitions, got " + Arrays.toString(parts));

        int one = count(dao.where(EQ(PartitionStrRecord.BUCKET, 5)));
        test(one == 1, "EQ still routes to a single partition, got " + one);

        int all = count(dao.where(allOf(PartitionStrRecord.BUCKET)));
        test(all == 3, "AllPartitions fanned out across every partition, got " + all);
      `
    },

    {
      name: 'testRefusals',
      args: 'X x',
      javaThrows: [ 'Throwable' ],
      javaCode: `
        String         root = newStorageDir();
        PartitionedDAO dao  = new PartitionedDAO(
          storageContext(x, root), PartitionStrRecord.getOwnClassInfo(),
          "ref/", PartitionStrRecord.BUCKET);

        dao.put(rec(5, "a"));
        dao.put(rec(7, "b"));

        // Used to route to getDelegate("null") and quietly return nothing.
        boolean threw = false;
        try {
          dao.select(new ArraySink());
        } catch ( UnsupportedOperationException e ) {
          threw = true;
        }
        test(threw, "select() with no partition selector was refused");
        test(! new File(root, "ref/null").exists(), "refusing left no 'null' journal behind");

        // Ordering across partitions would buffer every partition's rows.
        threw = false;
        try {
          dao.where(allOf(PartitionStrRecord.BUCKET))
             .orderBy(PartitionStrRecord.DATA)
             .select(new ArraySink());
        } catch ( UnsupportedOperationException e ) {
          threw = true;
        }
        test(threw, "ordered select across partitions was refused");

        // decorateSink drops the ordering for an aggregate sink anyway, so
        // this one must still be allowed through.
        threw = false;
        long n = 0;
        try {
          n = ((Count) dao.where(allOf(PartitionStrRecord.BUCKET))
                          .orderBy(PartitionStrRecord.DATA)
                          .select(COUNT())).getValue();
        } catch ( UnsupportedOperationException e ) {
          threw = true;
        }
        test(! threw && n == 2,
          "ordered COUNT() across partitions still allowed, threw=" + threw + " got " + n);

        // Ordering inside a single partition is untouched.
        threw = false;
        try {
          dao.where(EQ(PartitionStrRecord.BUCKET, 5))
             .orderBy(PartitionStrRecord.DATA)
             .select(new ArraySink());
        } catch ( UnsupportedOperationException e ) {
          threw = true;
        }
        test(! threw, "ordering within a single partition still works");
      `
    },

    {
      name: 'testRolloverNaming',
      args: 'X x',
      javaThrows: [ 'Throwable' ],
      javaCode: `
        String root = newStorageDir();
        new File(root, "roll").mkdirs();
        // A partition owns a directory; its journal and that journal's
        // generations live inside, where they cannot be mistaken for it.
        new File(root, "roll/5").mkdirs();
        new File(root, "roll/5/journal").createNewFile();
        new File(root, "roll/5/journal.0").createNewFile();
        new File(root, "roll/5/journal.2.snap.gz").createNewFile();
        // Partition values needing no escaping now that they are directories.
        new File(root, "roll/9.0").mkdirs();
        new File(root, "roll/a__b").mkdirs();
        new File(root, "roll/stray").createNewFile();  // a loose file is not a partition

        PartitionedDAO dao = new PartitionedDAO(
          storageContext(x, root), PartitionStrRecord.getOwnClassInfo(),
          "roll/", PartitionStrRecord.BUCKET);

        String[] parts = dao.getPartitions();
        test(Arrays.equals(parts, new String[] { "5", "9.0", "a__b" }),
          "partitions are the directories; journal files inside are not, got " + Arrays.toString(parts));
      `
    },

    {
      name: 'testNestedDateRange',
      args: 'X x',
      javaThrows: [ 'Throwable' ],
      documentation: `Mirrors PADDAO: an outer PartitionedDAO keyed on region
        whose partitions are DatePartitionedDAOs. AllPartitions expands only the
        region level; the date level still narrows to the requested range.`,
      javaCode: `
        PartitionedDAO outer = new PartitionedDAO(
          storageContext(x, newStorageDir()), PartitionStrRecord.getOwnClassInfo(),
          "nest/", PartitionStrRecord.REGION) {
          public DAO createDAO(String part) {
            DatePartitionedDAO inner = new DatePartitionedDAO(
              getX(), getOf(), partitionDirFor(part),
              PartitionStrRecord.DATE, DatePartitioningScheme.YYYYMM);
            inner.setDepth(getDepth() + 1);
            return inner;
          }
        };

        // Mid-month so the local-timezone Calendar in DatePartitionedDAO.
        // getPartition can't shift these into a neighbouring month.
        Date jan = day(2024, Calendar.JANUARY, 15);
        Date jun = day(2024, Calendar.JUNE,    15);

        outer.put(dated(1, jan, "r1-jan"));
        outer.put(dated(1, jun, "r1-jun"));
        outer.put(dated(2, jan, "r2-jan"));
        outer.put(dated(2, jun, "r2-jun"));

        String[] regions = outer.getPartitions();
        test(Arrays.equals(regions, new String[] { "1", "2" }),
          "outer level discovered its region partitions, got " + Arrays.toString(regions));

        // Every region, but only the date partitions the range covers. The
        // inner DatePartitionedDAO sees that range only because select_ passes
        // the predicate down -- without it it falls back to its default time
        // window, which is nowhere near 2024, and finds nothing.
        int n = count(outer.where(AND(
          allOf(PartitionStrRecord.REGION),
          GTE(PartitionStrRecord.DATE, day(2024, Calendar.JUNE, 1)))));
        test(n == 2, "every region but June only, got " + n);
      `
    },

    {
      name: 'allOf',
      args: 'Expr prop',
      type: 'foam.mlang.predicate.Predicate',
      javaCode: `
        AllPartitions p = new AllPartitions();
        p.setArg1(prop);
        return p;
      `
    },

    {
      name: 'count',
      args: 'DAO dao',
      type: 'Int',
      javaCode: 'return ((ArraySink) dao.select(new ArraySink())).getArray().size();'
    },

    {
      name: 'rec',
      args: 'int bucket, String data',
      type: 'foam.core.partition.test.PartitionStrRecord',
      javaCode: `
        PartitionStrRecord r = new PartitionStrRecord();
        r.setBucket(bucket);
        r.setData(data);
        return r;
      `
    },

    {
      name: 'dated',
      args: 'int region, Date date, String data',
      type: 'foam.core.partition.test.PartitionStrRecord',
      javaCode: `
        PartitionStrRecord r = new PartitionStrRecord();
        r.setRegion(region);
        r.setDate(date);
        r.setData(data);
        return r;
      `
    },

    {
      name: 'day',
      args: 'int year, int month, int dayOfMonth',
      type: 'java.util.Date',
      javaCode: `
        Calendar c = Calendar.getInstance();
        c.clear();
        c.set(year, month, dayOfMonth, 12, 0, 0);
        return c.getTime();
      `
    },

    {
      name: 'newStorageDir',
      type: 'String',
      documentation: 'Fresh temp dir so journals stay out of the runtime journals dir.',
      javaCode: `
        String dir = System.getProperty("java.io.tmpdir") + File.separator
          + "prtsel_" + System.nanoTime();
        new File(dir).mkdirs();
        return dir;
      `
    },

    {
      name: 'storageContext',
      args: 'X x, String dir',
      type: 'X',
      javaCode: `
        FileSystemStorage fs = new FileSystemStorage(dir);
        return x.put(Storage.class, fs).put(FileSystemStorage.class, fs);
      `
    }
  ]
});
