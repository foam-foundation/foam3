/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.compaction.test',
  name: 'CompactionLifecycleDeletedTest',
  extends: 'foam.core.test.Test',

  documentation: `A LifecycleAware row that ships in .0 and is deleted at
    runtime must stay deleted after compaction and a restart.

    LifecycleAwareDAO.remove_ saves the row as DELETED rather than removing it,
    so the journal does record the delete. Compaction then drops DELETED rows
    from the snapshot (discardLifecycleDeleted), writes no remove for them
    because the row is still in the MDAO, and deletes the generation that held
    the DELETED put. On the next replay .0 is the only record of the row.`,

  javaImports: [
    'foam.core.auth.LifecycleState',
    'foam.core.auth.User',
    'foam.core.fs.FileSystemStorage',
    'foam.core.fs.Storage',
    'foam.dao.*',
    'foam.dao.compaction.*',
    'foam.dao.java.JDAO',
    'foam.lang.X',
    'java.io.File'
  ],

  constants: [
    { name: 'JOURNAL', type: 'String', value: 'lifecycledeletedtest' }
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
      x = x.put(Storage.class, x.get(FileSystemStorage.class));
      x = x.put("compactionDAO", new MDAO(Compaction.getOwnClassInfo()));
      cleanup(x);

      // 1. .0 ships user 42, ACTIVE
      F3FileJournal zero = new F3FileJournal.Builder(x)
        .setFilename(JOURNAL + ".0")
        .setCreateFile(true)
        .build();
      User shipped = new User();
      shipped.setId(42);
      shipped.setFirstName("Shipped");
      shipped.setLifecycleState(LifecycleState.ACTIVE);
      zero.put(x, "", new NullDAO(x, User.getOwnClassInfo()), shipped);
      zero.getWriter().flush();

      // 2. Delete it at runtime the way LifecycleAwareDAO.remove_ does
      JDAO jdao = new JDAO(x, User.getOwnClassInfo(), JOURNAL);
      User deleted = (User) ((User) jdao.find_(x, 42L)).fclone();
      deleted.setLifecycleState(LifecycleState.DELETED);
      jdao.put_(x, deleted);

      // The journal did record the delete: a restart before compaction keeps it
      User beforeCompaction = (User) new JDAO(x, User.getOwnClassInfo(), JOURNAL).find_(x, 42L);
      test( beforeCompaction != null && beforeCompaction.getLifecycleState() == LifecycleState.DELETED,
        "Restart before compaction: user 42 is DELETED, got " + describe(beforeCompaction));

      // 3. Compact with the default config (discardLifecycleDeleted = true)
      DAO proxy = new ProxyDAO.Builder(x).setDelegate(jdao).build();
      CompactionCmd cmd = new CompactionCmd();
      cmd.setServiceName("lifecycleDeletedTestDAO");
      proxy.cmd_(x, cmd);
      test( cmd.awaitCompletion(60000), "Compaction finished");
      test( foam.util.SafetyUtil.isEmpty(cmd.getError()), "Compaction reported no error: " + cmd.getError());

      // 4. Restart after compaction: user 42 must still be deleted
      User afterCompaction = (User) new JDAO(x, User.getOwnClassInfo(), JOURNAL).find_(x, 42L);
      test( afterCompaction == null || afterCompaction.getLifecycleState() == LifecycleState.DELETED,
        "Restart after compaction: user 42 stays deleted, got " + describe(afterCompaction));

      cleanup(x);
      `
    },
    {
      name: 'describe',
      args: 'User u',
      type: 'String',
      javaCode: 'return u == null ? "no row" : u.getLifecycleState().getName();'
    },
    {
      name: 'cleanup',
      args: 'X x',
      javaCode: `
      Storage storage = (Storage) x.get(Storage.class);
      String[] names = { JOURNAL, JOURNAL + ".0", JOURNAL + ".1", JOURNAL + ".1.snap.gz", JOURNAL + ".1.snap.gz.tmp" };
      for ( String n : names ) {
        File f = storage.get(n);
        if ( f != null && f.exists() ) f.delete();
      }
      `
    }
  ]
});
