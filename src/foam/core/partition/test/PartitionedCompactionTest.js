/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.partition.test',
  name: 'PartitionedCompactionTest',
  extends: 'foam.core.test.Test',

  documentation: `Compaction across a PartitionedDAO.

    A CompactionCmd sent to the partitioned DAO must reach every partition's
    JDAO -- the reason compaction is a command at all. Also guards the two
    things generations changed underneath partitioning: the partition scan must
    not read generation files as partitions, and a String-id partition has a
    sequence DAO between its JDAO and its MDAO.`,

  javaImports: [
    'foam.core.fs.FileSystemStorage',
    'foam.core.fs.Storage',
    'foam.core.partition.PartitionedDAO',
    'foam.dao.ArraySink',
    'foam.dao.DAO',
    'foam.dao.compaction.CompactionCmd',
    'foam.dao.compaction.Compaction',
    'foam.lang.X',
    'java.io.File',
    'java.util.Arrays',
    'static foam.mlang.MLang.EQ'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        testCompactsEveryPartition(x);
        testGenerationsAreNotPartitions(x);
      `
    },

    {
      name: 'testCompactsEveryPartition',
      args: 'X x',
      javaThrows: [ 'Throwable' ],
      javaCode: `
        String root = newStorageDir();
        X      px   = storageContext(x, root);

        PartitionedDAO dao = new PartitionedDAO(
          px, PartitionStrRecord.getOwnClassInfo(), "cmp/", PartitionStrRecord.BUCKET);

        // Three partitions, each with repeat writes so there is something to compact.
        for ( int i = 0 ; i < 3 ; i++ ) {
          for ( int bucket : new int[] { 1, 2, 3 } ) {
            PartitionStrRecord r = new PartitionStrRecord();
            r.setBucket(bucket);
            r.setData("pass" + i);
            dao.put(r);
          }
        }

        String[] before = dao.getPartitions();
        test( before.length == 3, "Three partitions written, got " + Arrays.toString(before));

        CompactionCmd cmd = new CompactionCmd();
        cmd.setServiceName("partitionedCompactionTestDAO");
        // Opt out of the retention default so the cleanup path stays covered.
        Compaction reclaim = new Compaction();
        reclaim.setKeepSupersededGenerations(false);
        cmd.setCompaction(reclaim);
        dao.cmd_(px, cmd);
        // Dispatch is synchronous even though the work is not, so by now the
        // pending count is final and there is nothing to race with.
        test( cmd.awaitCompletion(60000), "Every partition finished within the timeout");

        // The point of the command: it reached every partition, not just one.
        test( cmd.getCompactedCount() == 3,
          "Every partition compacted, got " + cmd.getCompactedCount());
        test( foam.util.SafetyUtil.isEmpty(cmd.getError()), "No partition reported an error");

        // Each partition committed its own snapshot and dropped the generation
        // it superseded.
        for ( String part : before ) {
          File snap = new File(root, "cmp/" + part + "/journal.1.snap.gz");
          test( snap.exists(), "Partition " + part + " has a snapshot");
          test( snap.length() > 0, "Partition " + part + " snapshot has content");
          test( ! new File(root, "cmp/" + part + "/journal.1").exists(),
            "Partition " + part + " superseded generation removed");
          test( ! new File(root, "cmp/" + part + "/journal.1.snap.gz.tmp").exists(),
            "Partition " + part + " temp renamed away");
        }

        // A restart reads the snapshots back: same partitions, same rows.
        PartitionedDAO reloaded = new PartitionedDAO(
          storageContext(x, root), PartitionStrRecord.getOwnClassInfo(),
          "cmp/", PartitionStrRecord.BUCKET);

        String[] after = reloaded.getPartitions();
        test( Arrays.equals(before, after),
          "Partitions unchanged after compaction, got " + Arrays.toString(after));

        int rows = count(reloaded.where(EQ(PartitionStrRecord.BUCKET, 2)));
        test( rows == 3, "Partition 2 replayed its three rows from the snapshot, got " + rows);
      `
    },

    {
      name: 'testGenerationsAreNotPartitions',
      args: 'X x',
      javaThrows: [ 'Throwable' ],
      documentation: `The partition scan strips a journal's own generations.
        Without that, "5.1" and "5.2.snap.gz" become partitions of their own and
        the DAO grows phantom partitions every time one is compacted.`,
      javaCode: `
        String root = newStorageDir();
        new File(root, "gen/5").mkdirs();
        new File(root, "gen/5/journal").createNewFile();
        new File(root, "gen/5/journal.1").createNewFile();
        new File(root, "gen/5/journal.2.gz").createNewFile();
        new File(root, "gen/5/journal.3.snap.gz").createNewFile();
        new File(root, "gen/5/journal.4.snap.gz.tmp").createNewFile();
        // A partition whose own name looks like a generation. Ambiguous when
        // partitions were files beside their generations; a directory now.
        new File(root, "gen/9.1").mkdirs();

        PartitionedDAO dao = new PartitionedDAO(
          storageContext(x, root), PartitionStrRecord.getOwnClassInfo(),
          "gen/", PartitionStrRecord.BUCKET);

        String[] parts = dao.getPartitions();
        test( Arrays.equals(parts, new String[] { "5", "9.1" }),
          "Journal files inside a partition are not partitions, got " + Arrays.toString(parts));
      `
    },

    {
      name: 'count',
      args: 'DAO dao',
      type: 'Int',
      javaCode: 'return ((ArraySink) dao.select(new ArraySink())).getArray().size();'
    },

    {
      name: 'newStorageDir',
      type: 'String',
      documentation: 'Fresh temp dir so journals stay out of the runtime journals dir.',
      javaCode: `
        String dir = System.getProperty("java.io.tmpdir") + File.separator
          + "prtcmp_" + System.nanoTime();
        new File(dir).mkdirs();
        return dir;
      `
    },

    {
      name: 'storageContext',
      args: 'X x, String dir',
      type: 'X',
      javaCode: `
        FileSystemStorage fs = new FileSystemStorage(dir);
        return x.put(Storage.class, fs).put(FileSystemStorage.class, fs);
      `
    }
  ]
});
