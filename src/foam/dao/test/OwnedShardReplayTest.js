/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.test',
  name: 'OwnedShardReplayTest',
  extends: 'foam.core.test.Test',

  documentation: `A replay through the sharded line (the one F3FileJournal
    picks for a BulkLoadDAO) must produce the same rows as the single apply
    thread it replaces, on a journal built to break a wrong order: every id
    appears five times, spread across batches so its entries are parsed on
    different threads, as create, delta, remove, create again, delta, and a
    seventh of the ids end removed. Also checks that the merge returns the
    merged row itself when the class is unchanged.`,

  javaImports: [
    'foam.core.auth.User',
    'foam.core.fs.FileSystemStorage',
    'foam.core.fs.Storage',
    'foam.dao.BulkLoadDAO',
    'foam.dao.DAO',
    'foam.dao.F3FileJournal',
    'foam.lang.FObject',
    'foam.lang.X',
    'foam.util.concurrent.AssemblyLine',
    'foam.util.concurrent.BatchingAssemblyLine',
    'foam.util.concurrent.SimpleAsyncAssemblyLine',
    'java.io.BufferedWriter',
    'java.io.File',
    'java.io.OutputStreamWriter',
    'java.nio.file.Files',
    'java.util.HashMap',
    'java.util.Map'
  ],

  constants: [
    { name: 'IDS', type: 'int', value: 3000 }
  ],

  javaCode: `
    /** Today's line: parallel parse, one apply thread. The reference. **/
    static class SingleApplyJournal extends F3FileJournal {
      @Override
      public AssemblyLine createReplayLine(X x, DAO dao) {
        return new BatchingAssemblyLine(new SimpleAsyncAssemblyLine(x, "replay"));
      }
    }
  `,

  methods: [
    {
      name: 'runTest',
      javaCode: `
        try {
          File dir = Files.createTempDirectory("owned-shard-replay-").toFile();
          FileSystemStorage storage = new FileSystemStorage(dir.getAbsolutePath());
          X fsX = x.put(FileSystemStorage.class, storage).put(Storage.class, storage);
          writeJournal(storage, "users");

          // Reference rows from the single apply thread.
          BulkLoadDAO single = new BulkLoadDAO(fsX, User.getOwnClassInfo(), 1);
          F3FileJournal ref = new SingleApplyJournal();
          ref.setX(fsX);
          ref.setFilename("users");
          ref.replay(fsX, single);
          test(ref.getFailCount() == 0, "reference replay has no failures");

          // The default line for a BulkLoadDAO, at the default shard count and at an odd one.
          for ( int shards : new int[] { new BulkLoadDAO(fsX, User.getOwnClassInfo()).shards(), 3 } ) {
            BulkLoadDAO owned = new BulkLoadDAO(fsX, User.getOwnClassInfo(), shards);
            F3FileJournal jrl = new F3FileJournal.Builder(fsX).setFilename("users").build();
            jrl.replay(fsX, owned);
            test(jrl.getFailCount() == 0, shards + " shards: no failures");
            test(jrl.getPassCount() == IDS * 5, shards + " shards: every entry applied, " + jrl.getPassCount());
            compare(single.rows(), owned.rows(), shards + " shards");
          }

          // Expected end state, independently of either line.
          Map<Object, FObject> rows = byId(single.rows());
          test(rows.size() == IDS - IDS / 7, "ids removed at the end are absent: " + rows.size());
          User u = (User) rows.get(8L);
          test(u != null && "again8".equals(u.getUserName()) && "t4".equals(u.getJobTitle()),
            "id 8 ends as its second create plus the last delta, not the first create: " + (u == null ? "null" : u.getUserName() + " " + u.getJobTitle()));
          test(rows.get(7L) == null, "id 7 ends removed");

          // The merge returns the merged old row when the class is unchanged.
          User old = new User(); old.setId(1); old.setUserName("a"); old.setJobTitle("x");
          User diff = new User(); diff.setId(1); diff.setJobTitle("y");
          FObject merged = ref.mergeFObject(old, diff);
          test(merged == old, "same class: merge returns the old instance");
          test("a".equals(((User) merged).getUserName()) && "y".equals(((User) merged).getJobTitle()), "merged row carries both sides");

          storage.get("users").delete();
          dir.delete();
        } catch (Exception e) {
          test(false, "unexpected: " + e);
        }
      `
    },
    {
      name: 'writeJournal',
      documentation: 'Five passes over every id, so consecutive entries of one id sit IDS lines apart, across many 128-entry batches.',
      args: 'FileSystemStorage storage, String name',
      javaThrows: [ 'java.io.IOException' ],
      javaCode: `
        try ( BufferedWriter w = new BufferedWriter(new OutputStreamWriter(storage.getOutputStream(name))) ) {
          for ( int pass = 0 ; pass < 5 ; pass++ ) {
            for ( int id = 1 ; id <= IDS ; id++ ) {
              String line;
              switch ( pass ) {
                case 0:  line = "p({class:\\"foam.core.auth.User\\",id:" + id + ",userName:\\"user" + id + "\\",jobTitle:\\"t0\\",enabled:true})"; break;
                case 1:  line = "p({class:\\"foam.core.auth.User\\",id:" + id + ",jobTitle:\\"t1\\"})"; break;
                case 2:  line = "r({class:\\"foam.core.auth.User\\",id:" + id + "})"; break;
                case 3:  line = "p({class:\\"foam.core.auth.User\\",id:" + id + ",userName:\\"again" + id + "\\",jobTitle:\\"t3\\"})"; break;
                default: line = id % 7 == 0
                  ? "r({class:\\"foam.core.auth.User\\",id:" + id + "})"
                  : "p({class:\\"foam.core.auth.User\\",id:" + id + ",jobTitle:\\"t4\\"})";
              }
              w.write(line);
              w.newLine();
            }
          }
        }
      `
    },
    {
      name: 'byId',
      args: 'FObject[] rows',
      type: 'java.util.Map',
      javaCode: `
        Map<Object, FObject> m = new HashMap<>();
        for ( FObject f : rows ) m.put(f.getProperty("id"), f);
        return m;
      `
    },
    {
      name: 'compare',
      args: 'FObject[] expected, FObject[] actual, String label',
      javaCode: `
        Map<Object, FObject> e = byId(expected), a = byId(actual);
        test(e.size() == a.size(), label + ": same row count, " + e.size() + " vs " + a.size());
        // Compare what the journal writes; a whole-object compare trips on
        // array properties whose factory ran on one side and not the other.
        int diff = 0;
        String first = "";
        for ( Map.Entry<Object, FObject> en : e.entrySet() ) {
          User x1 = (User) en.getValue(), x2 = (User) a.get(en.getKey());
          if ( x2 == null || ! x1.getUserName().equals(x2.getUserName()) || ! x1.getJobTitle().equals(x2.getJobTitle()) || x1.getEnabled() != x2.getEnabled() ) {
            if ( diff == 0 ) first = " first: id " + en.getKey() + " expected " + x1.getUserName() + "/" + x1.getJobTitle() + " got " + (x2 == null ? "null" : x2.getUserName() + "/" + x2.getJobTitle());
            diff++;
          }
        }
        test(diff == 0, label + ": every row matches the single-thread row, " + diff + " differ" + first);
      `
    }
  ]
});
