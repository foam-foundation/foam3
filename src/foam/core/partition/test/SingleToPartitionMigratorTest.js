/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.partition.test',
  name: 'SingleToPartitionMigratorTest',
  extends: 'foam.core.test.Test',

  documentation: 'Tests SingleToPartitionMigrator: routing, counts, archive, idempotent re-run.',

  javaImports: [
    'foam.core.fs.FileSystemStorage',
    'foam.core.fs.Storage',
    'foam.core.partition.PartitionedDAO',
    'foam.core.partition.SingleToPartitionMigrator',
    'foam.dao.DAO',
    'foam.dao.java.JDAO',
    'foam.lang.X',
    'foam.mlang.Constant',
    'foam.mlang.sink.Count',
    'java.io.File',
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

        Map<String,Long> counts = new SingleToPartitionMigrator().migrate(tx, source, target);

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

        // Simulate redeploy: legacy .0 reappears with the SAME records.
        DAO repoWrite = new JDAO(tx, PartitionTestRecord.getOwnClassInfo(), legacy + ".0");
        seedRec(tx, repoWrite, 10L, 1);
        seedRec(tx, repoWrite, 11L, 1);
        seedRec(tx, repoWrite, 12L, 3);

        m.run(tx, legacy, target);
        Count p1redeploy = (Count) target.getDelegate("1").select(COUNT());
        test( p1redeploy.getValue() == 2,
          "Re-migrating same ids upserts (still 2 rows), got " + p1redeploy.getValue() );
        test( storage.get(legacy + ".0.migrated").exists(),
          "redeploy .0 journal archived to .0.migrated" );
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
