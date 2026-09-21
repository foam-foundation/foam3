/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.partition.test',
  name: 'DatePartitionedSelectTest',
  extends: 'foam.core.test.Test',

  documentation: `DatePartitionedDAO.select_ hands the query to each partition
    rather than scanning it: the predicate always, and the order plus a
    top-(skip+limit) when the limit is bounded, while the skip stays outside
    because it counts across partitions. The merged answer matches an
    unpartitioned select.`,

  javaImports: [
    'foam.core.fs.FileSystemStorage',
    'foam.core.fs.Storage',
    'foam.core.partition.DatePartitionedDAO',
    'foam.core.partition.DatePartitioningScheme',
    'foam.dao.AbstractDAO',
    'foam.dao.ArraySink',
    'foam.dao.DAO',
    'foam.dao.ProxyDAO',
    'foam.dao.Sink',
    'foam.lang.ClassInfo',
    'foam.lang.X',
    'foam.mlang.Expr',
    'foam.mlang.order.Comparator',
    'foam.mlang.predicate.Predicate',
    'java.io.File',
    'java.util.Date',
    'java.util.List',
    'static foam.mlang.MLang.AND',
    'static foam.mlang.MLang.DESC',
    'static foam.mlang.MLang.EQ',
    'static foam.mlang.MLang.GTE',
    'static foam.mlang.MLang.LTE'
  ],

  javaCode: `
    /** Records the select_ arguments its partition was handed. */
    public static class RecordingDAO extends ProxyDAO {
      public long       skip;
      public long       limit;
      public Comparator order;
      public Predicate  predicate;

      public RecordingDAO(X x, DAO delegate) {
        setX(x);
        setDelegate(delegate);
      }

      public Sink select_(X x, Sink sink, long skip, long limit, Comparator order, Predicate predicate) {
        this.skip      = skip;
        this.limit     = limit;
        this.order     = order;
        this.predicate = predicate;
        return super.select_(x, sink, skip, limit, order, predicate);
      }
    }

    /** DatePartitionedDAO whose partitions are the real thing behind a recorder. */
    public static class RecordingDatePartitionedDAO extends DatePartitionedDAO {
      public final List<RecordingDAO> recorders = new java.util.ArrayList<>();

      public RecordingDatePartitionedDAO(X x, ClassInfo of, String dirName, Expr prop, DatePartitioningScheme scheme) {
        super(x, of, dirName, prop, scheme);
      }

      public DAO createDAO(String part) {
        RecordingDAO r = new RecordingDAO(getX(), super.createDAO(part));
        recorders.add(r);
        return r;
      }
    }
  `,

  methods: [
    {
      name: 'runTest',
      javaCode: `
        X tx = newStorageContext(x);

        RecordingDatePartitionedDAO dao = new RecordingDatePartitionedDAO(
          tx, PartitionStrRecord.getOwnClassInfo(), "dpdSelect" + System.nanoTime() + "_",
          (Expr) PartitionStrRecord.DATE, DatePartitioningScheme.YYYYMMDD);

        // Three days, three records each, every date distinct so DESC(date) is
        // a total order: d0i0 (newest) .. d2i2 (oldest).
        long now = System.currentTimeMillis();
        for ( int d = 0 ; d < 3 ; d++ ) {
          for ( int i = 0 ; i < 3 ; i++ ) {
            PartitionStrRecord r = new PartitionStrRecord();
            r.setDate(new Date(now - d*DatePartitionedDAO.DAY - i*1000));
            r.setBucket(i);
            r.setData("d" + d + "i" + i);
            dao.put(r);
          }
        }

        Predicate  range = AND(
          GTE(PartitionStrRecord.DATE, new Date(now - 3*DatePartitionedDAO.DAY)),
          LTE(PartitionStrRecord.DATE, new Date(now + DatePartitionedDAO.DAY)));
        Comparator desc  = DESC(PartitionStrRecord.DATE);

        // Bounded: the two newest records, both from the newest partition.
        String bounded = dataOf(dao.select_(tx, new ArraySink(), 0, 2, desc, range));
        test("d0i0,d0i1".equals(bounded), "limit 2 DESC returns the two newest across partitions, got " + bounded);
        test(everyPartitionSaw(dao, 0, 2, true, true),
          "bounded select pushes the predicate, the order and skip+limit into every partition, and keeps the skip outside: " + argsOf(dao));

        // Bounded with a skip: the partition limit covers skip+limit, so the
        // rows the skip consumes are still there to be skipped.
        String skipped = dataOf(dao.select_(tx, new ArraySink(), 2, 2, desc, range));
        test("d0i2,d1i0".equals(skipped), "skip 2 limit 2 DESC crosses the partition boundary, got " + skipped);
        test(everyPartitionSaw(dao, 0, 4, true, true),
          "a skipped select pushes skip+limit as the partition limit: " + argsOf(dao));

        // Unbounded: one bucket per day, and neither the order nor the limit
        // is worth pushing because every row reaches the outer sink anyway.
        String unbounded = dataOf(dao.select_(tx, new ArraySink(), 0, AbstractDAO.MAX_SAFE_INTEGER, desc,
          AND(range, EQ(PartitionStrRecord.BUCKET, 1))));
        test("d0i1,d1i1,d2i1".equals(unbounded), "unbounded predicated select returns one row per partition in order, got " + unbounded);
        test(everyPartitionSaw(dao, 0, AbstractDAO.MAX_SAFE_INTEGER, false, true),
          "an unbounded select pushes only the predicate: " + argsOf(dao));

        // No predicate at all: every partition in the default window is still
        // walked, and nothing is pushed.
        int all = ((ArraySink) dao.select_(tx, new ArraySink(), 0, AbstractDAO.MAX_SAFE_INTEGER, null, null)).getArray().size();
        test(all == 9, "unpredicated select returns every record in the default window, got " + all);
        test(everyPartitionSaw(dao, 0, AbstractDAO.MAX_SAFE_INTEGER, false, false),
          "an unpredicated select pushes nothing: " + argsOf(dao));
      `
    },
    {
      name: 'dataOf',
      args: 'foam.dao.Sink sink',
      type: 'String',
      documentation: 'Comma-joined data field of an ArraySink result, in the order the sink received it.',
      javaCode: `
        StringBuilder sb = new StringBuilder();
        for ( Object o : ((ArraySink) sink).getArray() ) {
          if ( sb.length() > 0 ) sb.append(",");
          sb.append(((PartitionStrRecord) o).getData());
        }
        return sb.toString();
      `
    },
    {
      name: 'everyPartitionSaw',
      args: 'RecordingDatePartitionedDAO dao, long skip, long limit, boolean order, boolean predicate',
      type: 'Boolean',
      javaCode: `
        for ( RecordingDAO r : dao.recorders ) {
          if ( r.skip != skip || r.limit != limit ) return false;
          if ( ( r.order != null ) != order ) return false;
          if ( ( r.predicate != null ) != predicate ) return false;
        }
        return dao.recorders.size() > 1;
      `
    },
    {
      name: 'argsOf',
      args: 'RecordingDatePartitionedDAO dao',
      type: 'String',
      javaCode: `
        StringBuilder sb = new StringBuilder();
        for ( RecordingDAO r : dao.recorders ) {
          sb.append("[skip=").append(r.skip).append(" limit=").append(r.limit)
            .append(" order=").append(r.order).append(" predicate=").append(r.predicate).append("]");
        }
        return sb.toString();
      `
    },
    {
      name: 'newStorageContext',
      args: 'X x',
      type: 'X',
      documentation: 'Sub-context with a temp-dir FileSystemStorage so journals stay out of the runtime journals dir.',
      javaCode: `
        String dir = System.getProperty("java.io.tmpdir") + File.separator
          + "dpdselect_" + System.nanoTime();
        new File(dir).mkdirs();
        FileSystemStorage fs = new FileSystemStorage(dir);
        return x.put(Storage.class, fs).put(FileSystemStorage.class, fs);
      `
    }
  ]
});
