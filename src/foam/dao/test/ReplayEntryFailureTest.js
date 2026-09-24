/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.test',
  name: 'ReplayEntryFailureTest',
  extends: 'foam.core.test.Test',

  documentation: `A replay batches its entries 128 at a time. An entry that
    throws must fail on its own: the other entries of its batch still apply.`,

  javaImports: [
    'foam.core.auth.User',
    'foam.core.fs.FileSystemStorage',
    'foam.core.fs.Storage',
    'foam.dao.F3FileJournal',
    'foam.dao.MapDAO',
    'foam.lang.ClassInfo',
    'foam.lang.FObject',
    'foam.lang.X',
    'foam.mlang.sink.Count',
    'foam.util.concurrent.AbstractAssembly',
    'foam.util.concurrent.AssemblyLine',
    'foam.util.concurrent.BatchingAssemblyLine',
    'foam.util.concurrent.SimpleAsyncAssemblyLine',
    'java.io.BufferedWriter',
    'java.io.File',
    'java.io.OutputStreamWriter',
    'java.nio.file.Files',
    'java.util.concurrent.atomic.AtomicInteger'
  ],

  constants: [
    { name: 'ENTRIES', type: 'int', value: 200 },
    { name: 'BAD_ID',  type: 'long', value: 5 }
  ],

  javaCode: `
    /** Throws on the put of one id, as a decorator rejecting one journal row would. **/
    static class FailOneDAO extends MapDAO {
      FailOneDAO(X x, ClassInfo of) {
        super(x, of);
      }

      @Override
      public FObject put_(X x, FObject obj) {
        if ( ((Long) obj.getProperty("id")) == BAD_ID ) throw new RuntimeException("rejected id " + BAD_ID);
        return super.put_(x, obj);
      }
    }
  `,

  methods: [
    {
      name: 'runTest',
      javaCode: `
        try {
          checkReplay(x);
        } catch (Exception e) {
          test(false, "unexpected: " + e);
        }
        checkExecuteJob(x);
      `
    },
    {
      name: 'checkReplay',
      documentation: 'A put that throws on one entry loses only that entry.',
      args: 'X x',
      javaThrows: [ 'java.io.IOException' ],
      javaCode: `
        File dir = Files.createTempDirectory("replay-entry-failure-").toFile();
        FileSystemStorage storage = new FileSystemStorage(dir.getAbsolutePath());
        X fsX = x.put(FileSystemStorage.class, storage).put(Storage.class, storage);

        try ( BufferedWriter w = new BufferedWriter(new OutputStreamWriter(storage.getOutputStream("users"))) ) {
          for ( int id = 1 ; id <= ENTRIES ; id++ ) {
            w.write("p({class:\\"foam.core.auth.User\\",id:" + id + ",userName:\\"user" + id + "\\"})");
            w.newLine();
          }
        }

        FailOneDAO dao = new FailOneDAO(fsX, User.getOwnClassInfo());
        F3FileJournal journal = new F3FileJournal();
        journal.setX(fsX);
        journal.setFilename("users");
        journal.replay(fsX, dao);

        long rows = ((Count) dao.select(new Count())).getValue();
        test(rows == ENTRIES - 1, "every entry but the rejected one applied: " + rows + " of " + ENTRIES);
        test(dao.find(BAD_ID + 1) != null, "the entry after the rejected one, in the same batch, applied");

        storage.get("users").delete();
        dir.delete();
      `
    },
    {
      name: 'checkExecuteJob',
      documentation: 'An executeJob that throws on one job of a batch does not skip the executeJob of the jobs after it.',
      args: 'X x',
      javaCode: `
        AtomicInteger executed = new AtomicInteger();
        AtomicInteger ended    = new AtomicInteger();
        AssemblyLine  line     = new BatchingAssemblyLine(new SimpleAsyncAssemblyLine(x, "ReplayEntryFailureTest"));

        for ( int i = 0 ; i < 10 ; i++ ) {
          final int job = i;
          line.enqueue(new AbstractAssembly() {
            public void executeJob() {
              if ( job == 2 ) throw new RuntimeException("job 2 failed");
              executed.incrementAndGet();
            }

            public void endJob(boolean isLast) {
              ended.incrementAndGet();
            }
          });
        }
        line.shutdown();

        test(executed.get() == 9, "every job but the failed one executed: " + executed.get() + " of 10");
        test(ended.get() == 10, "every job ended: " + ended.get() + " of 10");
      `
    }
  ]
});
