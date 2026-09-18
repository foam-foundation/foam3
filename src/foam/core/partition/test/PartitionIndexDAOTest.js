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
    indexing DATA (one bucket) and BUCKET (four buckets): puts keep one entry
    per (value, leaf); EQ, IN, AND and COUNT on an indexed property reach only
    the leaves holding the value, also after a restart from the journals;
    removeAll prunes the entries; an unindexed predicate is forwarded as-is;
    migration through the decorator fills the index.`,

  javaImports: [
    'foam.core.fs.FileSystemStorage',
    'foam.core.fs.Storage',
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

        // The index is itself partitioned by bucket, so its rows are counted through that key.
        DAO dataIndex   = dao.getIndex(PartitionStrRecord.DATA).where(EQ(PartitionIndexEntry.BUCKET, 0));
        DAO bucketIndex = dao.getIndex(PartitionStrRecord.BUCKET).where(IN(PartitionIndexEntry.BUCKET, new Object[] { 0, 1, 2, 3 }));
        test(count(dataIndex, null) == 3, "one entry per (value, leaf): f1 in two months, f2 in one, got " + count(dataIndex, null));
        test(count(bucketIndex, null) == 3, "bucket index: 5 in two leaves, 6 in one, got " + count(bucketIndex, null));

        // Restart: a fresh decorator over the same journals, nothing put yet.
        // The index handle is taken again: the first instance's in-memory
        // copy no longer sees writes made through the second.
        dao = newDAO(tx, dirName);
        dataIndex = dao.getIndex(PartitionStrRecord.DATA).where(EQ(PartitionIndexEntry.BUCKET, 0));
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

        // Migration through the decorator fills the index (the migrator only writes into an empty partition dir).
        String legacy = "legacy_" + System.nanoTime();
        DAO src = new JDAO(tx, PartitionStrRecord.getOwnClassInfo(), legacy);
        PartitionStrRecord m1 = row(3, 2026, 3, 10, 5, "m1"); m1.setId("a"); src.put(m1);
        PartitionStrRecord m2 = row(3, 2026, 3, 11, 5, "m1"); m2.setId("b"); src.put(m2);
        PartitionIndexDAO migrated = newDAO(tx, "pidxm" + System.nanoTime() + "/");
        migrated.migrateFrom(tx, legacy);
        test(count(migrated, EQ(PartitionStrRecord.DATA, "m1")) == 2, "migrated rows are reachable through the index, got " + count(migrated, EQ(PartitionStrRecord.DATA, "m1")));
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
          .index(PartitionStrRecord.DATA, 1)
          .index(PartitionStrRecord.BUCKET, 4);
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
