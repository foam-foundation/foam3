/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.test',
  name: 'JournalGenerationsTest',
  extends: 'foam.core.test.Test',

  documentation: `The journal generation rule is derived from the filesystem,
    so it is tested by creating files and reading the derivation back.`,

  javaImports: [
    'foam.core.fs.FileSystemStorage',
    'foam.core.fs.Storage',
    'foam.dao.JournalGenerations',
    'java.io.File',
    'java.util.List'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
      x = x.put(Storage.class, x.get(FileSystemStorage.class));
      setX(x);

      String base = "jgentest";
      FileSystemStorage storage = (FileSystemStorage) x.get(FileSystemStorage.class);

      // Clean any survivors from an earlier run.
      File dir = storage.get(base).getParentFile();
      for ( File f : dir.listFiles() ) {
        if ( f.getName().startsWith(base) ) f.delete();
      }

      // Nothing on disk: no generations, and a cutover would freeze as .1
      JournalGenerations empty = new JournalGenerations(x, base);
      test( empty.replayOrder().size() == 0, "No generations when nothing is on disk");
      test( empty.nextGeneration() == 1, "First cutover freezes as generation 1");

      touch(storage, base);            // the live journal, never a generation
      touch(storage, base + ".0");     // generation 0 is replayed from the jar
      touch(storage, base + ".1");
      touch(storage, base + ".2.gz");
      touch(storage, base + ".3");
      touch(storage, base + ".4.gz.tmp");
      touch(storage, base + "somethingelse");

      JournalGenerations gens = new JournalGenerations(x, base);
      List<String> order = gens.replayOrder();

      test( order.size() == 3, "Three generations found, got " + order.size());
      test( base.concat(".1").equals(order.get(0)), "Generation 1 replays first");
      test( base.concat(".2.gz").equals(order.get(1)), "Compressed generation keeps its place in the order");
      test( base.concat(".3").equals(order.get(2)), "Generation 3 replays last");
      test( ! order.contains(base), "The live journal is not a generation");
      test( ! order.contains(base + ".0"), "Generation 0 is left to JDAO to replay from the jar");
      test( ! order.contains(base + ".4.gz.tmp"), "A half-written .tmp is ignored");
      test( gens.nextGeneration() == 4, "Next cutover freezes as generation 4, got " + gens.nextGeneration());
      test( gens.superseded().size() == 0, "Nothing is superseded without a snapshot");

      // A snapshot through 2 supersedes generations 1 and 2, but not 3.
      touch(storage, base + ".2.snap.gz");
      JournalGenerations snapped = new JournalGenerations(x, base);
      order = snapped.replayOrder();

      test( snapped.snapshotGeneration() == 2, "Snapshot generation is 2");
      test( order.size() == 2, "Snapshot plus the generation above it, got " + order.size());
      test( base.concat(".2.snap.gz").equals(order.get(0)), "Snapshot replays before later generations");
      test( base.concat(".3").equals(order.get(1)), "Generation above the snapshot still replays");
      test( snapped.superseded().size() == 2, "Two superseded files, got " + snapped.superseded().size());
      test( snapped.superseded().contains(base + ".1"), "Generation below the snapshot is superseded");
      test( snapped.superseded().contains(base + ".2.gz"), "Generation at the snapshot is superseded");
      test( snapped.nextGeneration() == 4, "Numbering continues past the snapshot");

      // A plain .gz claims nothing, so hand-compressing a generation is safe.
      test( ! snapped.superseded().contains(base + ".3"), "A later generation is never superseded");

      for ( File f : dir.listFiles() ) {
        if ( f.getName().startsWith(base) ) f.delete();
      }

      testPartitionedName(x, storage);
      `
    },
    {
      name: 'testPartitionedName',
      args: 'X x, foam.core.fs.FileSystemStorage storage',
      documentation: `A partitioned journal's name carries its directory, while
        a listing yields bare names. Matching one against the other found no
        generations at all, which silently dropped a partition's history.`,
      javaCode: `
      String dirName = "jgenparts";
      File   dir     = storage.get(dirName);
      dir.mkdirs();

      String base = dirName + "/7";
      touch(storage, base);
      touch(storage, base + ".1");
      touch(storage, base + ".2.snap.gz");

      JournalGenerations gens = new JournalGenerations(x, base);
      List<String> order = gens.replayOrder();

      test( order.size() == 1, "Partitioned journal found its generations, got " + order.size());
      test( base.concat(".2.snap.gz").equals(order.size() > 0 ? order.get(0) : ""),
        "Name comes back directory-qualified, ready for Storage, got " + order);
      test( gens.nextGeneration() == 3, "Numbering works under a directory, got " + gens.nextGeneration());
      test( gens.superseded().contains(base + ".1"), "Superseded name is directory-qualified");

      for ( File f : dir.listFiles() ) f.delete();
      dir.delete();
      `
    },
    {
      name: 'touch',
      args: 'foam.core.fs.FileSystemStorage storage, String name',
      javaCode: `
      try {
        File f = storage.get(name);
        f.createNewFile();
      } catch (java.io.IOException e) {
        test( false, "could not create " + name + ": " + e.getMessage());
      }
      `
    }
  ]
});
