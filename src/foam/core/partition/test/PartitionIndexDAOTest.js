/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.partition.test',
  name: 'PartitionIndexDAOTest',
  extends: 'foam.core.test.Test',

  documentation: `PartitionIndexDAO over a region-then-month partitioned DAO,
    indexing DATA and BUCKET: puts keep one entry
    per (value, leaf); EQ, IN, AND and COUNT on an indexed property reach only
    the leaves holding the value, also after a restart from the journals;
    removeAll prunes the entries; an unindexed predicate is forwarded as-is;
    migration through the decorator fills the index.`,

  javaImports: [
    'foam.core.fs.FileSystemStorage',
    'foam.core.fs.Storage',
    'foam.core.partition.AllPartitions',
    'foam.core.partition.PartitionIndexDAO',
    'foam.core.partition.PartitionIndexEntry',
    'foam.core.partition.PartitionedDAO',
    'foam.dao.ArraySink',
    'foam.dao.DAO',
    'foam.dao.java.JDAO',
    'foam.lang.X',
    'foam.mlang.sink.Count',
    'java.io.File',
    'java.util.Calendar',
    'java.util.Date',
    'static foam.mlang.MLang.AND',
    'static foam.mlang.MLang.COUNT',
    'static foam.mlang.MLang.EQ',
    'static foam.mlang.MLang.GTE',
    'static foam.mlang.MLang.IN',
    'static foam.mlang.MLang.LT'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        X tx = newStorageContext(x);
        String dirName = "pidx" + System.nanoTime() + "/";

        PartitionIndexDAO dao = newDAO(tx, dirName);

        // region 1: 3 rows in January and 2 in February with data f1; region 2: 2 rows in January with data f2
        for ( int i = 0 ; i < 3 ; i++ ) dao.put(row(1, 2026, 0, 15, 5, "f1"));
        for ( int i = 0 ; i < 2 ; i++ ) dao.put(row(1, 2026, 1, 15, 6, "f1"));
        for ( int i = 0 ; i < 2 ; i++ ) dao.put(row(2, 2026, 0, 15, 5, "f2"));

        // getPartitions() lists every directory under dirName, so the index must live elsewhere.
        String parts = java.util.Arrays.toString(dao.getPartitioned().getPartitions());
        test(parts.equals("[1, 2]"), "the index directory is not listed as a partition, got " + parts);

        // The index is itself partitioned by bucket, so its rows are counted across every bucket.
        DAO dataIndex   = dao.getIndex(PartitionStrRecord.DATA).where(allBuckets());
        DAO bucketIndex = dao.getIndex(PartitionStrRecord.BUCKET).where(allBuckets());
        test(count(dataIndex, null) == 3, "one entry per (value, leaf): f1 in two months, f2 in one, got " + count(dataIndex, null));
        test(count(bucketIndex, null) == 3, "bucket index: 5 in two leaves, 6 in one, got " + count(bucketIndex, null));

        // Restart: a fresh decorator over the same journals, nothing put yet.
        // The index handle is taken again: the first instance's in-memory
        // copy no longer sees writes made through the second.
        dao = newDAO(tx, dirName);
        dataIndex = dao.getIndex(PartitionStrRecord.DATA).where(allBuckets());
        PartitionedDAO outer = dao.getPartitioned();

        test(count(dao, EQ(PartitionStrRecord.DATA, "f2")) == 2, "EQ on an indexed property finds the rows after a restart");
        PartitionedDAO region1 = (PartitionedDAO) outer.getDelegate("1");
        test(! region1.isLoaded("2026/1") && ! region1.isLoaded("2026/2"), "region 1 leaves were not loaded for a value held only in region 2");

        test(count(dao, EQ(PartitionStrRecord.DATA, "f1")) == 5, "EQ across two leaves counts both, got " + count(dao, EQ(PartitionStrRecord.DATA, "f1")));
        test(count(dao, IN(PartitionStrRecord.DATA, new Object[] { "f1", "f2" })) == 7, "IN unions the leaves of both values");
        test(count(dao, AND(EQ(PartitionStrRecord.DATA, "f1"), EQ(PartitionStrRecord.BUCKET, 6))) == 2, "a residual term still filters inside the leaf");
        test(count(dao, AND(EQ(PartitionStrRecord.REGION, 2), EQ(PartitionStrRecord.DATA, "f1"))) == 0, "a partition-key EQ naming another region rules its leaves out");
        test(count(dao, EQ(PartitionStrRecord.DATA, "zzz")) == 0, "an unknown value selects nothing");
        test(! outer.isLoaded("null"), "no partition named null was created");

        ArraySink ordered = (ArraySink) dao.where(EQ(PartitionStrRecord.DATA, "f1")).orderBy(PartitionStrRecord.BUCKET).limit(3).select(new ArraySink());
        test(ordered.getArray().size() == 3, "limit applies across leaves, got " + ordered.getArray().size());

        // Unindexed predicate: forwarded to the router untouched.
        Date jan1 = date(2026, 0, 1), mar1 = date(2026, 2, 1);
        test(count(dao, AND(EQ(PartitionStrRecord.REGION, 1), GTE(PartitionStrRecord.DATE, jan1), LT(PartitionStrRecord.DATE, mar1))) == 5,
          "a region and date range query is answered by the router as before");

        // removeAll through the index removes the rows and prunes the entries.
        dao.where(EQ(PartitionStrRecord.DATA, "f2")).removeAll();
        test(count(dao, EQ(PartitionStrRecord.DATA, "f2")) == 0, "rows removed through the index are gone");
        test(count(dataIndex, EQ(PartitionIndexEntry.VALUE, "f2")) == 0, "the (f2, leaf) entry is pruned once the leaf holds no f2 row");
        test(count(dataIndex, null) == 2, "f1 entries survive, got " + count(dataIndex, null));

        // A single remove leaves the entry while other rows carry the value, prunes it with the last.
        ArraySink f1feb = (ArraySink) dao.where(AND(EQ(PartitionStrRecord.DATA, "f1"), EQ(PartitionStrRecord.BUCKET, 6))).select(new ArraySink());
        dao.remove((foam.lang.FObject) f1feb.getArray().get(0));
        test(count(dataIndex, null) == 2, "entry kept while a row with the value remains in the leaf");
        dao.remove((foam.lang.FObject) f1feb.getArray().get(1));
        test(count(dataIndex, null) == 1, "entry pruned with the leaf's last row carrying the value, got " + count(dataIndex, null));

        // Compaction reaches the index journals too, and a restart reads back only the live entries.
        foam.dao.compaction.CompactionCmd cmd = new foam.dao.compaction.CompactionCmd();
        foam.dao.compaction.Compaction reclaim = new foam.dao.compaction.Compaction();
        reclaim.setKeepSupersededGenerations(false);
        cmd.setCompaction(reclaim);
        dao.cmd_(tx, cmd);
        test(cmd.awaitCompletion(60000), "compaction finished within the timeout");
        test(foam.util.SafetyUtil.isEmpty(cmd.getError()), "compaction reported no error: " + cmd.getError());
        Storage fs = (Storage) tx.get(Storage.class);
        String indexDir = "index-" + dirName.substring(0, dirName.length() - 1) + "/";
        test(fs.get(indexDir + "data/" + PartitionIndexDAO.bucket("f1") + "/journal.1.snap.gz").exists(), "the data index bucket was compacted to a snapshot");
        dao = newDAO(tx, dirName);
        dataIndex = dao.getIndex(PartitionStrRecord.DATA).where(allBuckets());
        test(count(dataIndex, null) == 1, "after compaction and a restart the data index holds its one live entry, got " + count(dataIndex, null));
        test(count(dao, EQ(PartitionStrRecord.DATA, "f1")) == 3, "rows are still found through the compacted index, got " + count(dao, EQ(PartitionStrRecord.DATA, "f1")));

        // Migration through the decorator fills the index (the migrator only writes into an empty partition dir).
        String legacy = "legacy_" + System.nanoTime();
        DAO src = new JDAO(tx, PartitionStrRecord.getOwnClassInfo(), legacy);
        PartitionStrRecord m1 = row(3, 2026, 3, 10, 5, "m1"); m1.setId("a"); src.put(m1);
        PartitionStrRecord m2 = row(3, 2026, 3, 11, 5, "m1"); m2.setId("b"); src.put(m2);
        PartitionIndexDAO migrated = newDAO(tx, "pidxm" + System.nanoTime() + "/");
        migrated.migrateFrom(tx, legacy);
        test(count(migrated, EQ(PartitionStrRecord.DATA, "m1")) == 2, "migrated rows are reachable through the index, got " + count(migrated, EQ(PartitionStrRecord.DATA, "m1")));

        testPruneRacingAPut(x);
        testRoutingAndUpkeep(x);
      `
    },
    {
      name: 'testPruneRacingAPut',
      args: 'X x',
      javaThrows: [ 'Throwable' ],
      documentation: `A remove prunes its value's entry once it counts the leaf
        empty, while a put of the same value goes into the same leaf. Both
        orders are forced through hooks on the partitioned DAO:
        - the put starts inside the remove's count, on another thread given one
          second before the remove goes on;
        - the whole remove runs after the put checked the entry and before its
          row is written.
        Either way the new row must still be found through the index.`,
      javaCode: `
        X      tx      = newStorageContext(x);
        String dirName = "pidxr" + System.nanoTime() + "/";
        java.util.concurrent.atomic.AtomicReference<Runnable> afterCount = new java.util.concurrent.atomic.AtomicReference<>();
        java.util.concurrent.atomic.AtomicReference<Runnable> beforePut  = new java.util.concurrent.atomic.AtomicReference<>();

        RegionDatePartitionedDAO inner = new RegionDatePartitionedDAO(
          tx, PartitionStrRecord.getOwnClassInfo(), dirName, PartitionStrRecord.REGION, PartitionStrRecord.DATE) {
          public foam.dao.Sink select_(X sx, foam.dao.Sink sink, long skip, long limit, foam.mlang.order.Comparator order, foam.mlang.predicate.Predicate predicate) {
            foam.dao.Sink ret  = super.select_(sx, sink, skip, limit, order, predicate);
            Runnable      hook = sink instanceof Count ? afterCount.getAndSet(null) : null;
            if ( hook != null ) hook.run();
            return ret;
          }
          public foam.lang.FObject put_(X px, foam.lang.FObject obj) {
            Runnable hook = beforePut.getAndSet(null);
            if ( hook != null ) hook.run();
            return super.put_(px, obj);
          }
        };
        PartitionIndexDAO dao = new PartitionIndexDAO(tx, inner).index(PartitionStrRecord.DATA);

        foam.lang.FObject first  = dao.put(row(1, 2026, 0, 15, 5, "r1"));
        Thread            putter = new Thread(() -> dao.put(row(1, 2026, 0, 16, 5, "r1")));
        afterCount.set(() -> {
          putter.start();
          try { putter.join(1000); } catch ( InterruptedException e ) { Thread.currentThread().interrupt(); }
        });
        dao.remove(first);
        putter.join();

        long found = count(dao, EQ(PartitionStrRecord.DATA, "r1"));
        test(found == 1, "a put that starts during the prune's count is still found through the index, got " + found);

        foam.lang.FObject older = dao.put(row(1, 2026, 0, 15, 5, "r2"));
        beforePut.set(() -> dao.remove(older));
        dao.put(row(1, 2026, 0, 16, 5, "r2"));

        found = count(dao, EQ(PartitionStrRecord.DATA, "r2"));
        test(found == 1, "a put whose row lands after a whole prune is still found through the index, got " + found);
      `
    },
    {
      name: 'testRoutingAndUpkeep',
      args: 'X x',
      javaThrows: [ 'Throwable' ],
      documentation: `An AllPartitions left in the query does not send a route
        to every partition; an EQ on the date inside a leaf still reaches it;
        an update that moves a row off an indexed value prunes that value's
        entry; rebuild indexes a row written around the decorator.`,
      javaCode: `
        X      tx      = newStorageContext(x);
        String dirName = "pidxu" + System.nanoTime() + "/";

        PartitionIndexDAO dao = newDAO(tx, dirName);
        dao.put(row(1, 2026, 0, 15, 5, "g1"));
        dao.put(row(1, 2026, 0, 20, 7, "g1"));
        dao.put(row(2, 2026, 0, 15, 5, "h1"));

        dao = newDAO(tx, dirName);
        long found = count(dao, AND(allRegions(), EQ(PartitionStrRecord.DATA, "g1")));
        test(found == 2, "AllPartitions plus an indexed EQ finds the value's rows, got " + found);
        test(! dao.getPartitioned().isLoaded("2"), "the routes do not visit region 2, which holds no g1 row");

        ArraySink          sel = (ArraySink) dao.where(AND(EQ(PartitionStrRecord.DATA, "g1"), EQ(PartitionStrRecord.BUCKET, 7))).select(new ArraySink());
        PartitionStrRecord r20 = (PartitionStrRecord) sel.getArray().get(0);
        found = count(dao, AND(EQ(PartitionStrRecord.DATA, "g1"), EQ(PartitionStrRecord.DATE, r20.getDate())));
        test(found == 1, "an EQ on a date other than the one the entry was created with still reaches the leaf, got " + found);

        DAO dataIndex = dao.getIndex(PartitionStrRecord.DATA).where(allBuckets());
        PartitionStrRecord changed = (PartitionStrRecord) r20.fclone();
        changed.setData("g2");
        dao.put(changed);
        test(count(dataIndex, EQ(PartitionIndexEntry.VALUE, "g1")) == 1, "the g1 entry stays while another row in the leaf carries g1");
        sel = (ArraySink) dao.where(EQ(PartitionStrRecord.DATA, "g1")).select(new ArraySink());
        changed = (PartitionStrRecord) ((PartitionStrRecord) sel.getArray().get(0)).fclone();
        changed.setData("g2");
        dao.put(changed);
        test(count(dataIndex, EQ(PartitionIndexEntry.VALUE, "g1")) == 0, "the g1 entry is pruned when an update moves the leaf's last g1 row off it");
        found = count(dao, EQ(PartitionStrRecord.DATA, "g2"));
        test(found == 2, "both updated rows are found by their new value, got " + found);

        dao.getPartitioned().put(row(1, 2026, 0, 21, 5, "k1"));
        test(count(dao, EQ(PartitionStrRecord.DATA, "k1")) == 0, "a row written around the decorator has no entry");
        dao.rebuild(tx, AND(allRegions(), GTE(PartitionStrRecord.DATE, date(2026, 0, 1)), LT(PartitionStrRecord.DATE, date(2026, 1, 1))));
        found = count(dao, EQ(PartitionStrRecord.DATA, "k1"));
        test(found == 1, "rebuild indexes it, got " + found);
      `
    },
    {
      name: 'allBuckets',
      type: 'foam.mlang.predicate.Predicate',
      javaCode: `
        AllPartitions p = new AllPartitions();
        p.setArg1(PartitionIndexEntry.BUCKET);
        return p;
      `
    },
    {
      name: 'allRegions',
      type: 'foam.mlang.predicate.Predicate',
      javaCode: `
        AllPartitions p = new AllPartitions();
        p.setArg1(PartitionStrRecord.REGION);
        return p;
      `
    },
    {
      name: 'newDAO',
      args: 'X tx, String dirName',
      type: 'foam.core.partition.PartitionIndexDAO',
      javaCode: `
        RegionDatePartitionedDAO inner = new RegionDatePartitionedDAO(
          tx, PartitionStrRecord.getOwnClassInfo(), dirName, PartitionStrRecord.REGION, PartitionStrRecord.DATE);
        return new PartitionIndexDAO(tx, inner)
          .index(PartitionStrRecord.DATA)
          .index(PartitionStrRecord.BUCKET);
      `
    },
    {
      name: 'row',
      args: 'int region, int year, int month, int day, int bucket, String data',
      type: 'foam.core.partition.test.PartitionStrRecord',
      javaCode: `
        PartitionStrRecord r = new PartitionStrRecord();
        r.setRegion(region); r.setDate(date(year, month, day)); r.setBucket(bucket); r.setData(data);
        return r;
      `
    },
    {
      name: 'date',
      args: 'int year, int month, int day',
      type: 'java.util.Date',
      javaCode: `
        Calendar cal = Calendar.getInstance();
        cal.clear();
        cal.set(year, month, day, 12, 0, 0);
        return cal.getTime();
      `
    },
    {
      name: 'count',
      args: 'DAO dao, foam.mlang.predicate.Predicate predicate',
      type: 'Long',
      javaCode: `
        DAO d = predicate == null ? dao : dao.where(predicate);
        return ((Count) d.select(COUNT())).getValue();
      `
    },
    {
      name: 'newStorageContext',
      args: 'X x',
      type: 'X',
      javaCode: `
        String dir = System.getProperty("java.io.tmpdir") + File.separator + "pidx_" + System.nanoTime();
        new File(dir).mkdirs();
        FileSystemStorage fs = new FileSystemStorage(dir);
        return x.put(Storage.class, fs).put(FileSystemStorage.class, fs);
      `
    }
  ]
});
