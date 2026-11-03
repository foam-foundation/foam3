/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.partition.test',
  name: 'PartitionedDAOTwoLevelIdTest',
  extends: 'foam.core.test.Test',

  documentation: `New records put to a two-level partitioned DAO each get their
    own id, <region>~<bucket>~<n>, so three puts store three records. A record
    that already has an id keeps it, and a reloaded leaf numbers the next record
    past the ids already in its journal.`,

  javaImports: [
    'foam.core.fs.FileSystemStorage',
    'foam.core.fs.Storage',
    'foam.core.partition.PartitionedDAO',
    'foam.dao.DAO',
    'foam.lang.X',
    'foam.mlang.sink.Count',
    'java.io.File',
    'java.util.HashSet',
    'java.util.Set',
    'static foam.mlang.MLang.COUNT'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        X tx = newStorageContext(x);
        String dir = "twoLevelId" + System.nanoTime() + "/";

        TwoLevelPartitionedDAO dao = new TwoLevelPartitionedDAO(
          tx, PartitionStrRecord.getOwnClassInfo(), dir,
          PartitionStrRecord.REGION, PartitionStrRecord.BUCKET);

        Set<String> ids = new HashSet<>();
        for ( int i = 0 ; i < 3 ; i++ ) {
          PartitionStrRecord r = new PartitionStrRecord();
          r.setRegion(1); r.setBucket(5); r.setData("r" + i);
          ids.add(((PartitionStrRecord) dao.put(r)).getId());
        }

        test(ids.size() == 3, "three new records get three ids, got " + ids);
        for ( String id : ids )
          test(id.matches("1~5~[0-9]+"), "id is <region>~<bucket>~<n>, got " + id);

        DAO leaf = ((PartitionedDAO) dao.getDelegate("1")).getDelegate("5");
        long stored = ((Count) leaf.select(COUNT())).getValue();
        test(stored == 3, "the region 1 / bucket 5 leaf holds 3 records, got " + stored);

        for ( String id : ids )
          test(dao.find(id) != null, "find routes " + id + " to its record");

        PartitionStrRecord legacy = new PartitionStrRecord();
        legacy.setId("old-7"); legacy.setRegion(1); legacy.setBucket(5); legacy.setData("legacy");
        String legacyId = ((PartitionStrRecord) dao.put(legacy)).getId();
        test("1~5~old-7".equals(legacyId), "a record with an id keeps it under its partitions, got " + legacyId);

        // A fresh DAO on the same directory replays the leaf journal; its next
        // record must be numbered past the three ids written above.
        TwoLevelPartitionedDAO reloaded = new TwoLevelPartitionedDAO(
          tx, PartitionStrRecord.getOwnClassInfo(), dir,
          PartitionStrRecord.REGION, PartitionStrRecord.BUCKET);
        PartitionStrRecord next = new PartitionStrRecord();
        next.setRegion(1); next.setBucket(5); next.setData("after reload");
        String nextId = ((PartitionStrRecord) reloaded.put(next)).getId();
        test( ! ids.contains(nextId), "after a reload the next id is new, got " + nextId + " among " + ids);

        DAO reloadedLeaf = ((PartitionedDAO) reloaded.getDelegate("1")).getDelegate("5");
        long after = ((Count) reloadedLeaf.select(COUNT())).getValue();
        test(after == 5, "the reloaded leaf holds all 5 records, got " + after);
      `
    },
    {
      name: 'newStorageContext',
      args: 'X x',
      type: 'X',
      documentation: 'Sub-context with a temp-dir FileSystemStorage so journals stay out of the runtime journals dir.',
      javaCode: `
        String dir = System.getProperty("java.io.tmpdir") + File.separator
          + "prttwolevelid_" + System.nanoTime();
        new File(dir).mkdirs();
        FileSystemStorage fs = new FileSystemStorage(dir);
        return x.put(Storage.class, fs).put(FileSystemStorage.class, fs);
      `
    }
  ]
});
