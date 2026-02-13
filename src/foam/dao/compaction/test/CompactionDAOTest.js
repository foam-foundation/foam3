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
    'foam.core.fs.FileSystemStorage',
    'foam.core.fs.Storage',
    'foam.core.auth.User',
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
      `
    }
  ]
});
