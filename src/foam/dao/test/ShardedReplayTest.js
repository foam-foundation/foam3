/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.test',
  name: 'ShardedReplayTest',
  extends: 'foam.core.test.Test',

  documentation: `A replay through the sharded line (the one F3FileJournal
    picks for a BulkLoadDAO) must produce the same rows as the single apply
    thread it replaces, on a journal built to break a wrong order: every id
    appears five times, spread across batches so its entries are parsed on
    different threads, as create, delta, remove, create again, delta, and a
    seventh of the ids end removed. The same check runs on a String-id model
    (Group) and on a compound-id model (GroupPermissionJunction), whose ids
    hash by value.`,

  javaImports: [
    'foam.core.auth.Group',
    'foam.core.auth.GroupPermissionJunction',
    'foam.core.auth.User',
    'foam.lang.ClassInfo',
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
      public AssemblyLine createReplayLine(X x, DAO dao, long bytes) {
        return new BatchingAssemblyLine(new SimpleAsyncAssemblyLine(x, "replay"));
      }
    }

    /** The sharded line at a shard count other than the default. **/
    static class ThreeShardJournal extends F3FileJournal {
      @Override
      public AssemblyLine createReplayLine(X x, DAO dao, long bytes) {
        return new BatchingAssemblyLine(new SimpleAsyncAssemblyLine(x, "replay", Math.max(1, Runtime.getRuntime().availableProcessors() - 1), 3));
      }
    }

    /** F3FileJournal's own line, as for a journal past SHARD_MIN_BYTES: these test journals are smaller. **/
    static class DefaultShardJournal extends F3FileJournal {
      @Override
      public AssemblyLine createReplayLine(X x, DAO dao, long bytes) {
        return super.createReplayLine(x, dao, SHARD_MIN_BYTES);
      }
    }

    /** The line F3FileJournal picks for a BulkLoadDAO, at the default shard count or at 3. **/
    static F3FileJournal sharded(X x, String file, boolean three) {
      F3FileJournal j = three ? new ThreeShardJournal() : new DefaultShardJournal();
      j.setX(x);
      j.setFilename(file);
      return j;
    }
  `,

  methods: [
    {
      name: 'runTest',
      javaCode: `
        try {
          File dir = Files.createTempDirectory("sharded-replay-").toFile();
          FileSystemStorage storage = new FileSystemStorage(dir.getAbsolutePath());
          X fsX = x.put(FileSystemStorage.class, storage).put(Storage.class, storage);
          writeJournal(storage, "users");

          // Reference rows from the single apply thread.
          BulkLoadDAO single = new BulkLoadDAO(fsX, User.getOwnClassInfo());
          F3FileJournal ref = new SingleApplyJournal();
          ref.setX(fsX);
          ref.setFilename("users");
          ref.replay(fsX, single);
          test(ref.getFailCount() == 0, "reference replay has no failures");

          // The default line for a BulkLoadDAO, at the default shard count and at an odd one.
          for ( boolean three : new boolean[] { false, true } ) {
            String        shards = three ? "3" : "default";
            BulkLoadDAO   dao    = new BulkLoadDAO(fsX, User.getOwnClassInfo());
            F3FileJournal jrl    = sharded(fsX, "users", three);
            jrl.replay(fsX, dao);
            test(jrl.getFailCount() == 0, shards + " shards: no failures");
            test(jrl.getPassCount() == IDS * 5, shards + " shards: every entry applied, " + jrl.getPassCount());
            compare(single.rows(), dao.rows(), shards + " shards");
          }

          // Expected end state, independently of either line.
          Map<Object, FObject> rows = byId(single.rows());
          test(rows.size() == IDS - IDS / 7, "ids removed at the end are absent: " + rows.size());
          User u = (User) rows.get(8L);
          test(u != null && "again8".equals(u.getUserName()) && "t4".equals(u.getJobTitle()),
            "id 8 ends as its second create plus the last delta, not the first create: " + (u == null ? "null" : u.getUserName() + " " + u.getJobTitle()));
          test(rows.get(7L) == null, "id 7 ends removed");

          checkStringIds(fsX, storage);
          checkCompoundIds(fsX, storage);

          storage.get("users").delete();
          storage.get("groups").delete();
          storage.get("junctions").delete();
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
      name: 'checkStringIds',
      documentation: 'Group: String ids "g1".."g2000", create, delta, then remove every fifth or a second delta.',
      args: 'X fsX, FileSystemStorage storage',
      javaThrows: [ 'java.io.IOException' ],
      javaCode: `
        try ( BufferedWriter w = new BufferedWriter(new OutputStreamWriter(storage.getOutputStream("groups"))) ) {
          for ( int pass = 0 ; pass < 3 ; pass++ ) {
            for ( int i = 1 ; i <= 2000 ; i++ ) {
              String line = pass == 0 ? "p({class:\\"foam.core.auth.Group\\",id:\\"g" + i + "\\",description:\\"d0\\"})"
                : pass == 1 ? "p({class:\\"foam.core.auth.Group\\",id:\\"g" + i + "\\",description:\\"d1\\"})"
                : i % 5 == 0 ? "r({class:\\"foam.core.auth.Group\\",id:\\"g" + i + "\\"})"
                : "p({class:\\"foam.core.auth.Group\\",id:\\"g" + i + "\\",description:\\"d2\\"})";
              w.write(line);
              w.newLine();
            }
          }
        }
        Map<Object, FObject> rows = replayBoth(fsX, "groups", Group.getOwnClassInfo(), 6000, "description", "String ids");
        test(rows.size() == 1600, "String ids: every fifth group removed, " + rows.size() + " rows");
        Group g = (Group) rows.get("g1");
        test(g != null && "d2".equals(g.getDescription()), "String ids: g1 carries the last delta");
      `
    },
    {
      name: 'checkCompoundIds',
      documentation: 'GroupPermissionJunction: id is (sourceId, targetId); create all, remove every fourth, re-create every eighth.',
      args: 'X fsX, FileSystemStorage storage',
      javaThrows: [ 'java.io.IOException' ],
      javaCode: `
        try ( BufferedWriter w = new BufferedWriter(new OutputStreamWriter(storage.getOutputStream("junctions"))) ) {
          for ( int pass = 0 ; pass < 3 ; pass++ ) {
            for ( int i = 1 ; i <= 2000 ; i++ ) {
              String key = "sourceId:\\"g" + (i % 50) + "\\",targetId:\\"perm" + i + "\\"";
              String line = pass == 0 ? "p({class:\\"foam.core.auth.GroupPermissionJunction\\"," + key + "})"
                : pass == 1 ? ( i % 4 == 0 ? "r({class:\\"foam.core.auth.GroupPermissionJunction\\"," + key + "})" : "" )
                : ( i % 8 == 0 ? "p({class:\\"foam.core.auth.GroupPermissionJunction\\"," + key + "})" : "" );
              if ( line.isEmpty() ) continue;
              w.write(line);
              w.newLine();
            }
          }
        }
        Map<Object, FObject> rows = replayBoth(fsX, "junctions", GroupPermissionJunction.getOwnClassInfo(), 2000 + 500 + 250, "targetId", "compound ids");
        test(rows.size() == 1750, "compound ids: removed every fourth, re-created every eighth, " + rows.size() + " rows");
        boolean has8 = false, has4 = false;
        for ( FObject f : rows.values() ) {
          GroupPermissionJunction j = (GroupPermissionJunction) f;
          if ( "perm8".equals(j.getTargetId()) ) has8 = true;
          if ( "perm4".equals(j.getTargetId()) ) has4 = true;
        }
        test(has8 && ! has4, "compound ids: perm8 came back, perm4 stayed removed");
      `
    },
    {
      name: 'replayBoth',
      documentation: 'Replay one journal through the single apply thread and through the sharded line at the default and at 3 shards; every row must agree on the marker property. Returns the reference rows by id.',
      args: 'X fsX, String file, ClassInfo of, int entries, String marker, String label',
      type: 'java.util.Map',
      javaCode: `
        BulkLoadDAO single = new BulkLoadDAO(fsX, of);
        F3FileJournal ref = new SingleApplyJournal();
        ref.setX(fsX);
        ref.setFilename(file);
        ref.replay(fsX, single);
        test(ref.getFailCount() == 0 && ref.getPassCount() == entries, label + ": reference replay applied " + ref.getPassCount() + " of " + entries);
        Map<Object, FObject> e = byId(single.rows());

        for ( boolean three : new boolean[] { false, true } ) {
          String        shards = three ? "3" : "default";
          BulkLoadDAO   dao    = new BulkLoadDAO(fsX, of);
          F3FileJournal jrl    = sharded(fsX, file, three);
          jrl.replay(fsX, dao);
          test(jrl.getFailCount() == 0 && jrl.getPassCount() == entries, label + ", " + shards + " shards: every entry applied");
          Map<Object, FObject> a = byId(dao.rows());
          int diff = 0;
          for ( Map.Entry<Object, FObject> en : e.entrySet() ) {
            FObject other = a.get(en.getKey());
            if ( other == null || ! String.valueOf(en.getValue().getProperty(marker)).equals(String.valueOf(other.getProperty(marker))) ) diff++;
          }
          test(a.size() == e.size() && diff == 0, label + ", " + shards + " shards: rows match the single-thread line, " + a.size() + " vs " + e.size() + ", " + diff + " differ");
        }
        return e;
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
