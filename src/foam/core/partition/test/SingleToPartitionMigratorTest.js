/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.partition.test',
  name: 'SingleToPartitionMigratorTest',
  extends: 'foam.core.test.Test',

  documentation: 'Tests SingleToPartitionMigrator: routing, counts, archive, idempotent re-run, partial-migration guard.',

  javaImports: [
    'foam.core.fs.FileSystemStorage',
    'foam.core.fs.Storage',
    'foam.core.partition.PartitionedDAO',
    'foam.core.partition.SingleToPartitionMigrator',
    'foam.core.partition.test.PartitionStrRecord',
    'foam.dao.ArraySink',
    'foam.dao.DAO',
    'foam.dao.java.JDAO',
    'foam.lang.FObject',
    'foam.lang.X',
    'foam.mlang.Constant',
    'foam.mlang.sink.Count',
    'java.io.File',
    'java.util.HashMap',
    'java.util.Map',
    'static foam.mlang.MLang.COUNT'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        testMigrateRoutesByBucket(x);
        testNeedsMigrationAndArchive(x);
        testRunEndToEndAndIdempotent(x);
        testRunUsesWritableStorageNotResourceStorage(x);
        testArchiveSkipsDirectory(x);
        testCompositeKeyFind(x);
        testMigrateFromStringIdModel(x);
        testNegativePartitionKnownGap(x);
        testMigratedIdsRoutable(x);
        testNonNumericSuffixNoCrash(x);
        testMigrateCapturesIdMap(x);
        testPartialMigrationGuard(x);
      `
    },
    {
      name: 'testMigratedIdsRoutable',
      args: 'X x',
      type: 'Void',
      documentation: 'migrateFrom lets the target DAO stamp fresh <partition>-<seqNo> ids on String-id records (no legacy-id preservation), and the stamped ids route back through the outer PartitionedDAO via find_.',
      javaCode: `
        X tx = newStorageContext(x);
        String legacy = "routable_" + System.nanoTime();

        DAO src = new JDAO(tx, PartitionStrRecord.getOwnClassInfo(), legacy);
        PartitionStrRecord r1 = new PartitionStrRecord(); r1.setId("a"); r1.setBucket(5); r1.setData("d1"); src.put(r1);
        PartitionStrRecord r2 = new PartitionStrRecord(); r2.setId("7"); r2.setBucket(9); r2.setData("d2"); src.put(r2);

        PartitionedDAO target = new PartitionedDAO(
          tx, PartitionStrRecord.getOwnClassInfo(), "prt" + System.nanoTime() + "/",
          new Constant(null), PartitionStrRecord.BUCKET);
        target.migrateFrom(tx, legacy);

        ArraySink s5 = (ArraySink) target.getDelegate("5").select(new ArraySink());
        ArraySink s9 = (ArraySink) target.getDelegate("9").select(new ArraySink());
        test( s5.getArray().size() == 1,
          "partition 5 holds exactly 1 migrated record, got " + s5.getArray().size() );
        test( s9.getArray().size() == 1,
          "partition 9 holds exactly 1 migrated record, got " + s9.getArray().size() );
        if ( s5.getArray().size() != 1 || s9.getArray().size() != 1 ) return;

        String id5 = (String) PartitionStrRecord.ID.get((FObject) s5.getArray().get(0));
        String id9 = (String) PartitionStrRecord.ID.get((FObject) s9.getArray().get(0));
        test( id5 != null && id5.startsWith("5-") && ! "a".equals(id5),
          "legacy id 'a' restamped to a '5-' seqNo id, got " + id5 );
        test( id9 != null && id9.startsWith("9-") && ! "7".equals(id9),
          "legacy id '7' restamped to a '9-' seqNo id, got " + id9 );

        // The stamped composite ids route through the OUTER PartitionedDAO.
        FObject f5 = target.find_(tx, id5);
        FObject f9 = target.find_(tx, id9);
        test( f5 != null && "d1".equals(PartitionStrRecord.DATA.get(f5)),
          "find_('" + id5 + "') routed by prefix to the bucket-5 record" );
        test( f9 != null && "d2".equals(PartitionStrRecord.DATA.get(f9)),
          "find_('" + id9 + "') routed by prefix to the bucket-9 record" );
      `
    },
    {
      name: 'testPartialMigrationGuard',
      args: 'X x',
      type: 'Void',
      documentation: 'A legacy journal found alongside already-populated partition journals signals a crashed prior migration: run must refuse to import (no duplicates) and must NOT archive the legacy journal.',
      javaCode: `
        X tx = newStorageContext(x);
        Storage storage = (Storage) tx.get(FileSystemStorage.class);
        String legacy = "partial_" + System.nanoTime();

        PartitionedDAO target = new PartitionedDAO(
          tx, PartitionStrRecord.getOwnClassInfo(), "pguard" + System.nanoTime() + "/",
          new Constant(null), PartitionStrRecord.BUCKET);

        // Populate a partition journal directly (stands in for a crashed prior migration).
        PartitionStrRecord pre = new PartitionStrRecord(); pre.setBucket(5); pre.setData("pre");
        target.put_(tx, pre);

        // A legacy journal appears alongside the populated partitions.
        DAO src = new JDAO(tx, PartitionStrRecord.getOwnClassInfo(), legacy);
        PartitionStrRecord r = new PartitionStrRecord(); r.setId("a"); r.setBucket(5); r.setData("da"); src.put(r);

        target.migrateFrom(tx, legacy);

        test( storage.get(legacy).exists(),
          "guard left the legacy journal in place (NOT archived)" );
        test( ! storage.get(legacy + ".migrated").exists(),
          "guard did not create <legacy>.migrated" );
        Count c5 = (Count) target.getDelegate("5").select(COUNT());
        test( c5.getValue() == 1,
          "guard did not import (partition 5 still has 1 record), got " + c5.getValue() );
      `
    },
    {
      name: 'testNonNumericSuffixNoCrash',
      args: 'X x',
      type: 'Void',
      documentation: 'Putting a record with a pre-set non-numeric-suffix id ("5-a") through the partitioned DAO neither crashes (getObjId no longer throws) nor changes the id.',
      javaCode: `
        X tx = newStorageContext(x);
        PartitionedDAO p = new PartitionedDAO(
          tx, PartitionStrRecord.getOwnClassInfo(), "pnn" + System.nanoTime() + "/",
          new Constant(null), PartitionStrRecord.BUCKET);

        PartitionStrRecord r = new PartitionStrRecord(); r.setId("5-a"); r.setBucket(5); r.setData("d");
        try {
          FObject pr = p.put_(tx, r);
          String id = (String) PartitionStrRecord.ID.get(pr);
          test( "5-a".equals(id),
            "pre-set id '5-a' preserved through put_, got " + id );
        } catch ( Throwable t ) {
          test( false,
            "put_ of a pre-set id '5-a' must not throw, got: " + t.getMessage() );
        }
      `
    },
    {
      name: 'testMigrateCapturesIdMap',
      args: 'X x',
      type: 'Void',
      documentation: 'migrate fills the supplied idMap with oldId -> newId for every String-id record whose id changed: "a" in bucket 5 and "7" in bucket 9 map to fresh "5-"/"9-" seqNo ids stamped by the target DAO.',
      javaCode: `
        X tx = newStorageContext(x);
        String legacy = "idMapSrc_" + System.nanoTime();

        DAO src = new JDAO(tx, PartitionStrRecord.getOwnClassInfo(), legacy);
        PartitionStrRecord r1 = new PartitionStrRecord(); r1.setId("a"); r1.setBucket(5); r1.setData("d1"); src.put(r1);
        PartitionStrRecord r2 = new PartitionStrRecord(); r2.setId("7"); r2.setBucket(9); r2.setData("d2"); src.put(r2);

        PartitionedDAO target = new PartitionedDAO(
          tx, PartitionStrRecord.getOwnClassInfo(), "pidmap" + System.nanoTime() + "/",
          new Constant(null), PartitionStrRecord.BUCKET);

        Map<String,String> idMap = new HashMap<>();
        new SingleToPartitionMigrator().migrate(tx, src, target, idMap);

        test( idMap.size() == 2, "idMap captured 2 id changes, got " + idMap.size() );
        String na = idMap.get("a");
        String n7 = idMap.get("7");
        test( na != null && na.startsWith("5-") && ! "a".equals(na),
          "idMap maps 'a' to a fresh '5-' id, got " + na );
        test( n7 != null && n7.startsWith("9-") && ! "7".equals(n7),
          "idMap maps '7' to a fresh '9-' id, got " + n7 );
      `
    },
    {
      name: 'testNegativePartitionKnownGap',
      args: 'X x',
      type: 'Void',
      documentation: 'KNOWN-FAILING on purpose. getPartition_ uses indexOf (first "-") so chained partitions ("<a>-<b>-<key>") peel the outermost first; but a negative partition value ("-116993-1") then extracts "" instead of "-116993". Partition values can be negative, so this must be handled by a future negative-aware fix. Kept failing so that fix is validated when it lands.',
      javaCode: `
        PartitionedDAO p = newPartitioned(x);
        String id = "-116993-1";
        test( "-116993".equals(p.getPartition(id)),
          "KNOWN GAP: getPartition('-116993-1') should be '-116993' (negative partition), got '"
            + p.getPartition(id) + "' under indexOf — fix when negative-aware partition keys land" );
      `
    },
    {
      name: 'testMigrateFromStringIdModel',
      args: 'X x',
      type: 'Void',
      documentation: 'PartitionedDAO.migrateFrom on a String-id (seqNo) model: source records are frozen and the per-partition seqNo stamps a composite id, so migrate must clone before put_ (regression for the frozen-record crash).',
      javaCode: `
        X tx = newStorageContext(x);
        String legacy = "strLegacy_" + System.nanoTime();

        // Seed a single-file legacy journal with String-id records (2 in bucket 5).
        DAO src = new JDAO(tx, PartitionStrRecord.getOwnClassInfo(), legacy);
        PartitionStrRecord r1 = new PartitionStrRecord(); r1.setId("a"); r1.setBucket(5); r1.setData("d1"); src.put(r1);
        PartitionStrRecord r2 = new PartitionStrRecord(); r2.setId("b"); r2.setBucket(5); r2.setData("d2"); src.put(r2);

        PartitionedDAO target = new PartitionedDAO(
          tx, PartitionStrRecord.getOwnClassInfo(), "pstrmig/", new Constant(null), PartitionStrRecord.BUCKET);

        // Must not throw "Object is frozen" — migrate clones the selected records.
        target.migrateFrom(tx, legacy);

        Count c5 = (Count) target.getDelegate("5").select(COUNT());
        test( c5.getValue() == 2, "migrateFrom landed 2 records in partition 5, got " + c5.getValue() );
      `
    },
    {
      name: 'testCompositeKeyFind',
      args: 'X x',
      type: 'Void',
      documentation: 'A String-id model auto-gets composite <partition>-<seq> ids; put_ stamps them and find resolves by the partition prefix across partitions.',
      javaCode: `
        X tx = newStorageContext(x);

        // Constant(null) identity (as the real wiring uses) so put_ routes by the
        // partition property, not getID — an unset String id is "" not null, which
        // would otherwise send objToPath down the id branch and resolve to null.
        PartitionedDAO p = new PartitionedDAO(
          tx, PartitionStrRecord.getOwnClassInfo(), "pstr/", new Constant(null), PartitionStrRecord.BUCKET);

        // ids UNSET -> the per-partition seqNo stamps <bucket>-<seq>. Two in bucket 5, one in bucket 99.
        PartitionStrRecord a = new PartitionStrRecord(); a.setBucket(5);  a.setData("a"); FObject pa = p.put_(tx, a);
        PartitionStrRecord b = new PartitionStrRecord(); b.setBucket(5);  b.setData("b"); FObject pb = p.put_(tx, b);
        PartitionStrRecord c = new PartitionStrRecord(); c.setBucket(99); c.setData("c"); FObject pc = p.put_(tx, c);

        String idA = (String) PartitionStrRecord.ID.get(pa);
        String idC = (String) PartitionStrRecord.ID.get(pc);
        test( idA != null && idA.startsWith("5-"),
          "bucket 5 record got composite id '5-...', got " + idA );
        test( idC != null && idC.startsWith("99-"),
          "bucket 99 record got composite id '99-...', got " + idC );

        // partition extraction reads the prefix before the first '-'.
        test( "5".equals(p.getPartition(idA)), "getPartition('" + idA + "') == 5" );
        test( "99".equals(p.getPartition(idC)), "getPartition('" + idC + "') == 99" );

        // find by the composite id resolves to the right partition.
        FObject foundA = p.find_(tx, idA);
        FObject foundC = p.find_(tx, idC);
        test( foundA != null && "a".equals(PartitionStrRecord.DATA.get(foundA)),
          "find(idA) resolved record a" );
        test( foundC != null && "c".equals(PartitionStrRecord.DATA.get(foundC)),
          "find(idC) resolved record c in partition 99" );

        // Re-open a fresh PartitionedDAO on the same storage: find must resolve
        // from the on-disk partition journals (a boot), not the in-memory cache.
        PartitionedDAO p2 = new PartitionedDAO(
          tx, PartitionStrRecord.getOwnClassInfo(), "pstr/", new Constant(null), PartitionStrRecord.BUCKET);
        FObject reA = p2.find_(tx, idA);
        FObject reC = p2.find_(tx, idC);
        test( reA != null && "a".equals(PartitionStrRecord.DATA.get(reA)),
          "fresh DAO instance resolved idA from the journal" );
        test( reC != null && "c".equals(PartitionStrRecord.DATA.get(reC)),
          "fresh DAO instance resolved idC (partition 99) from the journal" );

        // A non-existent composite id in a real partition returns null, not a crash.
        test( p2.find_(tx, "5-9999") == null, "find of a missing id returns null" );
      `
    },
    {
      name: 'newStorageContext',
      args: 'X x',
      type: 'X',
      documentation: 'Sub-context with a temp-dir FileSystemStorage so journals are isolated.',
      javaCode: `
        String dir = System.getProperty("java.io.tmpdir") + File.separator
          + "partmig_" + System.nanoTime();
        new File(dir).mkdirs();
        FileSystemStorage fs = new FileSystemStorage(dir);
        return x.put(Storage.class, fs).put(FileSystemStorage.class, fs);
      `
    },
    {
      name: 'seedRec',
      args: 'X x, DAO dao, long id, int bucket',
      type: 'Void',
      javaCode: `
        PartitionTestRecord r = new PartitionTestRecord();
        r.setId(id);
        r.setBucket(bucket);
        r.setData("d" + id);
        dao.put(r);
      `
    },
    {
      name: 'newPartitioned',
      args: 'X x',
      type: 'PartitionedDAO',
      javaCode: `
        // Use Constant(null) as identityExpr so put_ routes via getPartition(obj)
        // (the default IdentityExpr returns a Long which cannot be cast to String).
        return new PartitionedDAO(
          x,
          PartitionTestRecord.getOwnClassInfo(),
          "ptest",
          new Constant(null),
          PartitionTestRecord.BUCKET);
      `
    },
    {
      name: 'testMigrateRoutesByBucket',
      args: 'X x',
      type: 'Void',
      javaThrows: ['Throwable'],
      javaCode: `
        X tx = newStorageContext(x);
        String src = "ptestSource_" + System.nanoTime();

        // Seed the REPO journal (.0) — bucket 1: ids 1,2 ; bucket 2: id 4.
        // Writing via a JDAO whose filename is "<src>.0" lands records in the file <src>.0,
        // which a JDAO opened on "<src>" later replays as its read-only repo journal.
        DAO repoDAO = new JDAO(tx, PartitionTestRecord.getOwnClassInfo(), src + ".0");
        seedRec(tx, repoDAO, 1L, 1);
        seedRec(tx, repoDAO, 2L, 1);
        seedRec(tx, repoDAO, 4L, 2);

        // Seed the RUNTIME journal "<src>" — bucket 1: id 3 ; bucket 2: id 5.
        DAO runtimeDAO = new JDAO(tx, PartitionTestRecord.getOwnClassInfo(), src);
        seedRec(tx, runtimeDAO, 3L, 1);
        seedRec(tx, runtimeDAO, 5L, 2);

        // A fresh JDAO on "<src>" replays BOTH <src>.0 (repo) and <src> (runtime) — the union.
        DAO source = new JDAO(tx, PartitionTestRecord.getOwnClassInfo(), src);
        PartitionedDAO target = newPartitioned(tx);

        Map<String,Long> counts = new SingleToPartitionMigrator().migrate(tx, source, target, new HashMap<String,String>());

        test( counts.size() == 2, "Two partitions written, got " + counts.size() );
        test( counts.get("1") != null && counts.get("1") == 3L,
          "Bucket 1 has 3 records (2 from .0 + 1 runtime), got " + counts.get("1") );
        test( counts.get("2") != null && counts.get("2") == 2L,
          "Bucket 2 has 2 records (1 from .0 + 1 runtime), got " + counts.get("2") );

        Count c1 = (Count) target.getDelegate("1").select(COUNT());
        Count c2 = (Count) target.getDelegate("2").select(COUNT());
        test( c1.getValue() == 3, "Bucket 1 journal has 3 rows, got " + c1.getValue() );
        test( c2.getValue() == 2, "Bucket 2 journal has 2 rows, got " + c2.getValue() );
      `
    },
    {
      name: 'testRunEndToEndAndIdempotent',
      args: 'X x',
      type: 'Void',
      javaCode: `
        X tx = newStorageContext(x);
        Storage storage = (Storage) tx.get(Storage.class);
        String legacy = "legacySrc_" + System.nanoTime();

        // Seed legacy single-file journal: bucket 1 x2, bucket 3 x1.
        DAO writeDAO = new JDAO(tx, PartitionTestRecord.getOwnClassInfo(), legacy);
        seedRec(tx, writeDAO, 10L, 1);
        seedRec(tx, writeDAO, 11L, 1);
        seedRec(tx, writeDAO, 12L, 3);

        SingleToPartitionMigrator m = new SingleToPartitionMigrator();
        PartitionedDAO target = newPartitioned(tx);

        m.run(tx, legacy, target);

        test( storage.get(legacy + ".migrated").exists(),
          "run archived the legacy journal after success" );
        Count p1 = (Count) target.getDelegate("1").select(COUNT());
        Count p3 = (Count) target.getDelegate("3").select(COUNT());
        test( p1.getValue() == 2, "Bucket 1 partition has 2 rows, got " + p1.getValue() );
        test( p3.getValue() == 1, "Bucket 3 partition has 1 row, got " + p3.getValue() );

        // Idempotent re-run: legacy archived -> no-op, no double-write.
        m.run(tx, legacy, target);
        Count p1again = (Count) target.getDelegate("1").select(COUNT());
        test( p1again.getValue() == 2,
          "Re-run does not duplicate (still 2 rows), got " + p1again.getValue() );

        // Simulate redeploy: legacy .0 reappears next to the populated
        // partitions. The pre-flight guard treats this as a partial migration:
        // no re-import (would duplicate under fresh seqNo ids), no archive.
        DAO repoWrite = new JDAO(tx, PartitionTestRecord.getOwnClassInfo(), legacy + ".0");
        seedRec(tx, repoWrite, 10L, 1);
        seedRec(tx, repoWrite, 11L, 1);
        seedRec(tx, repoWrite, 12L, 3);

        m.run(tx, legacy, target);
        Count p1redeploy = (Count) target.getDelegate("1").select(COUNT());
        test( p1redeploy.getValue() == 2,
          "Guard refused re-import (still 2 rows), got " + p1redeploy.getValue() );
        test( ! storage.get(legacy + ".0.migrated").exists(),
          "guard left the reappeared .0 journal unarchived for manual recovery" );
      `
    },
    {
      name: 'testRunUsesWritableStorageNotResourceStorage',
      args: 'X x',
      type: 'Void',
      documentation: 'In production Storage.class is a read-only ResourceStorage; detect/archive must use the writable FileSystemStorage.class. Puts DIFFERENT storages under the two keys to prove run() archives in the writable one.',
      javaCode: `
        String wdir = System.getProperty("java.io.tmpdir") + File.separator + "wmig_" + System.nanoTime();
        String rdir = System.getProperty("java.io.tmpdir") + File.separator + "rmig_" + System.nanoTime();
        new File(wdir).mkdirs();
        new File(rdir).mkdirs();
        FileSystemStorage writable = new FileSystemStorage(wdir);
        FileSystemStorage readOnly = new FileSystemStorage(rdir);
        X tx = x.put(Storage.class, readOnly).put(FileSystemStorage.class, writable);

        String legacy = "splitSrc_" + System.nanoTime();
        DAO writeDAO = new JDAO(tx, PartitionTestRecord.getOwnClassInfo(), legacy);
        seedRec(tx, writeDAO, 20L, 1);
        seedRec(tx, writeDAO, 21L, 1);

        PartitionedDAO target = newPartitioned(tx);
        new SingleToPartitionMigrator().run(tx, legacy, target);

        test( writable.get(legacy + ".migrated").exists(),
          "run archived the legacy journal in the WRITABLE storage" );
        test( ! readOnly.get(legacy + ".migrated").exists(),
          "run did NOT touch the read-only storage" );
        Count p1 = (Count) target.getDelegate("1").select(COUNT());
        test( p1.getValue() == 2, "Bucket 1 partition has 2 rows, got " + p1.getValue() );
      `
    },
    {
      name: 'testNeedsMigrationAndArchive',
      args: 'X x',
      type: 'Void',
      javaCode: `
        X tx = newStorageContext(x);
        Storage storage = (Storage) tx.get(Storage.class);
        SingleToPartitionMigrator m = new SingleToPartitionMigrator();
        String name = "archiveSrc_" + System.nanoTime();

        test( ! m.needsMigration(storage, name),
          "needsMigration false when no legacy journal present" );

        DAO d = new JDAO(tx, PartitionTestRecord.getOwnClassInfo(), name);
        seedRec(tx, d, 1L, 7);
        test( m.needsMigration(storage, name),
          "needsMigration true once legacy journal exists" );

        m.archive(storage, name);
        test( ! m.needsMigration(storage, name),
          "needsMigration false after archive (renamed to .migrated)" );
        test( storage.get(name + ".migrated").exists(),
          "archived runtime journal exists as .migrated" );

        DAO d2 = new JDAO(tx, PartitionTestRecord.getOwnClassInfo(), name);
        seedRec(tx, d2, 2L, 7);
        m.archive(storage, name);
        test( storage.get(name + ".migrated").exists(),
          "re-archive overwrites prior .migrated without error" );
      `
    },
    {
      name: 'testArchiveSkipsDirectory',
      args: 'X x',
      type: 'Void',
      documentation: 'archive must rename journal files but never a directory that shares the journal base name (the nested-partition dir case).',
      javaCode: `
        X tx = newStorageContext(x);
        Storage storage = (Storage) tx.get(Storage.class);
        String name = "dirGuard_" + System.nanoTime();

        // A directory named like the journal (stands in for the nested partition dir).
        File dir = storage.get(name);
        dir.mkdirs();
        test( dir.isDirectory(), "precondition: <name> is a directory" );

        // A real repo journal file <name>.0.
        DAO d = new JDAO(tx, PartitionTestRecord.getOwnClassInfo(), name + ".0");
        seedRec(tx, d, 1L, 5);

        new SingleToPartitionMigrator().archive(storage, name);

        test( storage.get(name).isDirectory(),
          "archive left the directory in place (did not rename it)" );
        test( ! storage.get(name + ".migrated").exists(),
          "archive did NOT create <name>.migrated from the directory" );
        test( storage.get(name + ".0.migrated").exists(),
          "archive renamed the repo journal file <name>.0 to .0.migrated" );
      `
    }
  ]
});
