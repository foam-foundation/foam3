/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.compaction.test',
  name: 'CompactionDAOTest',
  extends: 'foam.core.test.Test',

  javaImports: [
    'foam.lang.X',
    'foam.dao.*',
    'foam.dao.compaction.*',
    'foam.dao.java.JDAO',
    'foam.dao.F3FileJournal',
    'foam.core.fs.FileSystemStorage',
    'foam.core.fs.Storage',
    'foam.core.auth.User',
    'foam.dao.compaction.test.TestRecord',
    'foam.mlang.sink.Count',
    'java.io.File'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
      x = x.put(Storage.class, x.get(FileSystemStorage.class));
      setX(x);
      String serviceName = "compactionTestDAO";

      // Provide a compactionDAO in context for CompactionSink
      DAO compactionDAO = new MDAO(Compaction.getOwnClassInfo());
      x = x.put("compactionDAO", compactionDAO);

      // 1. Create a JDAO with User model
      JDAO jdao = new JDAO(x, User.getOwnClassInfo(), "compactiontest");
      MDAO mdao = (MDAO) jdao.getDelegate();

      // Wrap in ProxyDAO (CompactionDAO.roll() casts to ProxyDAO)
      ProxyDAO proxyDAO = new ProxyDAO.Builder(x).setDelegate(jdao).build();

      // Register the DAO in context so CompactionDAO can find it
      x = x.put(serviceName, proxyDAO);

      // 2. Put multiple updates to the same objects (creates many journal entries)
      for ( int i = 1 ; i <= 5 ; i++ ) {
        User u = new User();
        u.setId(i);
        u.setFirstName("First" + i);
        u.setLastName("Last" + i);
        jdao.put_(x, u);
      }
      // Update the same objects 3 more times (creates delta entries in journal)
      for ( int j = 0 ; j < 3 ; j++ ) {
        for ( int i = 1 ; i <= 5 ; i++ ) {
          User u = (User) jdao.find_(x, (long) i);
          u = (User) u.fclone();
          u.setFirstName("Updated" + j + "_" + i);
          jdao.put_(x, u);
        }
      }

      // Verify MDAO has 5 objects
      Count count = (Count) mdao.select(new Count());
      test( ((Long) count.getValue()) == 5, "MDAO has 5 objects before compaction");

      // Verify original journal file exists and has content
      File originalFile = x.get(Storage.class).get("compactiontest");
      test( originalFile.exists(), "Original journal file exists");
      long originalSize = originalFile.length();
      test( originalSize > 0, "Original journal has content");

      // 3. Run CompactionDAO (which handles roll + compaction)
      try {
        CompactionDAO compactor = new CompactionDAO(x, serviceName);
        compactor.execute(x);
        test( true, "CompactionDAO.execute() completed without error");
      } catch (Throwable t) {
        test( false, "CompactionDAO.execute() failed: " + t.getMessage());
        return;
      }

      // 4. Verify: rolled backup file exists
      File rolledFile = x.get(Storage.class).get("compactiontest.1");
      test( rolledFile.exists(), "Rolled backup file (compactiontest.1) exists");
      test( rolledFile.length() > 0, "Rolled backup file has content");

      // 5. Verify: new journal has content (compacted entries written)
      File newJournal = x.get(Storage.class).get("compactiontest");
      test( newJournal.exists(), "New journal file exists after compaction");
      long newSize = newJournal.length();
      test( newSize > 0, "New journal has compacted entries");

      // 6. Verify: MDAO still has all 5 objects with correct data
      count = (Count) mdao.select(new Count());
      test( ((Long) count.getValue()) == 5, "MDAO still has 5 objects after compaction");
      User u1 = (User) mdao.find_(x, 1L);
      test( u1 != null, "Object 1 still exists in MDAO");
      test( u1.getFirstName().startsWith("Updated"), "Object 1 has latest updated value");

      // 7. Verify: new entries go to the new journal after compaction
      long sizeBeforeNewPut = newJournal.length();
      User newUser = new User();
      newUser.setId(100);
      newUser.setFirstName("PostCompaction");
      newUser.setLastName("User");
      jdao.put_(x, newUser);
      long sizeAfterNewPut = newJournal.length();
      test( sizeAfterNewPut > sizeBeforeNewPut, "New entries written to journal after compaction");
      User fetched = (User) jdao.find_(x, 100L);
      test( fetched != null, "New entry is findable after compaction");
      test( "PostCompaction".equals(fetched.getFirstName()), "New entry has correct data");

      testZeroAwareness(x);
      `
    },
    {
      name: 'testZeroAwareness',
      args: 'foam.lang.X x',
      javaCode: `
      // Uses TestRecord (simple model) for deterministic delta detection.
      // The journal's maybeOutputDelta() handles .0 awareness natively:
      // identical objects produce empty deltas (nothing written),
      // modified objects write only changed properties.

      // 1. Create a .0 file with 5 records (ids 1-5) using F3FileJournal
      F3FileJournal zeroJournal = new F3FileJournal.Builder(x)
        .setFilename("zerotest.0")
        .setCreateFile(true)
        .build();
      DAO nullDAO = new NullDAO(x, TestRecord.getOwnClassInfo());
      for ( int i = 1 ; i <= 5 ; i++ ) {
        TestRecord r = new TestRecord();
        r.setId(i);
        r.setName("ZeroName" + i);
        r.setValue("ZeroVal" + i);
        zeroJournal.put(x, "", nullDAO, r);
      }

      // 2. Create JDAO with filename "zerotest" — it auto-replays zerotest.0 on creation
      JDAO jdao2 = new JDAO(x, TestRecord.getOwnClassInfo(), "zerotest");
      MDAO mdao2 = (MDAO) jdao2.getDelegate();

      // 3. Verify .0 was replayed
      Count count = (Count) mdao2.select(new Count());
      test( ((Long) count.getValue()) == 5, ".0 awareness: MDAO has 5 objects after .0 replay");

      // 4. Modify record 1 at runtime
      TestRecord r1 = (TestRecord) jdao2.find_(x, 1L);
      r1 = (TestRecord) r1.fclone();
      r1.setName("Modified1");
      jdao2.put_(x, r1);

      // 5. Add 2 new records (ids 6, 7) at runtime
      for ( int i = 6 ; i <= 7 ; i++ ) {
        TestRecord r = new TestRecord();
        r.setId(i);
        r.setName("NewName" + i);
        r.setValue("NewVal" + i);
        jdao2.put_(x, r);
      }

      // 6. Remove record 2 at runtime
      jdao2.remove_(x, jdao2.find_(x, 2L));

      // 7. Wrap in ProxyDAO and register in context as "zeroTestDAO"
      ProxyDAO proxy2 = new ProxyDAO.Builder(x).setDelegate(jdao2).build();
      x = x.put("zeroTestDAO", proxy2);

      // 8. Run CompactionDAO
      CompactionDAO compactor = new CompactionDAO(x, "zeroTestDAO");
      try {
        compactor.execute(x);
        test( true, ".0 awareness: CompactionDAO.execute() completed without error");
      } catch ( Throwable t ) {
        test( false, ".0 awareness: CompactionDAO.execute() failed: " + t.getMessage());
        return;
      }

      // 9. Verify results
      // MDAO still has 6 objects (5 original - 1 removed + 2 new)
      count = (Count) mdao2.select(new Count());
      test( ((Long) count.getValue()) == 6, ".0 awareness: MDAO has 6 objects after compaction");

      // Verify report exists
      String report = compactor.getReport();
      test( report != null && report.contains("Compaction Report"), ".0 awareness: report generated");

      // Verify all 6 objects have correct data
      TestRecord check1 = (TestRecord) mdao2.find_(x, 1L);
      test( check1 != null && "Modified1".equals(check1.getName()), ".0 awareness: record 1 has modified name");

      TestRecord check2 = (TestRecord) mdao2.find_(x, 2L);
      test( check2 == null, ".0 awareness: record 2 was removed");

      TestRecord check3 = (TestRecord) mdao2.find_(x, 3L);
      test( check3 != null && "ZeroName3".equals(check3.getName()), ".0 awareness: record 3 unchanged from .0");

      TestRecord check4 = (TestRecord) mdao2.find_(x, 4L);
      test( check4 != null && "ZeroName4".equals(check4.getName()), ".0 awareness: record 4 unchanged from .0");

      TestRecord check5 = (TestRecord) mdao2.find_(x, 5L);
      test( check5 != null && "ZeroName5".equals(check5.getName()), ".0 awareness: record 5 unchanged from .0");

      TestRecord check6 = (TestRecord) mdao2.find_(x, 6L);
      test( check6 != null && "NewName6".equals(check6.getName()), ".0 awareness: record 6 is new runtime record");

      TestRecord check7 = (TestRecord) mdao2.find_(x, 7L);
      test( check7 != null && "NewName7".equals(check7.getName()), ".0 awareness: record 7 is new runtime record");

      // 10. Verify delta writing: re-replay from scratch (simulates server restart)
      // .0 provides base data, runtime journal provides deltas — merged result must be correct
      JDAO jdao3 = new JDAO(x, TestRecord.getOwnClassInfo(), "zerotest");
      MDAO mdao3 = (MDAO) jdao3.getDelegate();
      count = (Count) mdao3.select(new Count());
      test( ((Long) count.getValue()) == 6, ".0 delta replay: MDAO has 6 objects after re-replay");

      TestRecord replay1 = (TestRecord) mdao3.find_(x, 1L);
      test( replay1 != null && "Modified1".equals(replay1.getName()), ".0 delta replay: record 1 has modified name");
      test( replay1 != null && "ZeroVal1".equals(replay1.getValue()), ".0 delta replay: record 1 retains .0 value field");

      TestRecord replay2 = (TestRecord) mdao3.find_(x, 2L);
      test( replay2 == null, ".0 delta replay: record 2 still removed");

      TestRecord replay3 = (TestRecord) mdao3.find_(x, 3L);
      test( replay3 != null && "ZeroName3".equals(replay3.getName()), ".0 delta replay: record 3 unchanged from .0");

      TestRecord replay6 = (TestRecord) mdao3.find_(x, 6L);
      test( replay6 != null && "NewName6".equals(replay6.getName()), ".0 delta replay: record 6 is new runtime record");

      // Clean up test files
      try {
        Storage storage = (Storage) x.get(Storage.class);
        String[] filenames = { "zerotest", "zerotest.0", "zerotest.1", "zerotest.2" };
        for ( String fn : filenames ) {
          File f = storage.get(fn);
          if ( f != null && f.exists() ) f.delete();
        }
      } catch ( Exception e ) {
        // Best-effort cleanup
      }
      `
    }
  ]
});
