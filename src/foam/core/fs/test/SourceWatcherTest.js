/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.fs.test',
  name: 'SourceWatcherTest',
  extends: 'foam.core.fs.test.WatcherTestBase',

  javaImports: [
    'foam.core.fs.SourceChange',
    'foam.core.fs.SourceWatcher',
    'foam.dao.MDAO',
    'foam.lang.X',
    'foam.mlang.sink.Count',
    'static foam.mlang.MLang.NEQ',
    'java.nio.file.Files',
    'java.nio.file.Path',
    'java.nio.file.attribute.FileTime'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        Path root = null;
        try {
          root = Files.createTempDirectory("sourcewatcher");
          Path file     = root.resolve("a.js");
          Path skipped  = root.resolve("build").resolve("b.js");
          Path other    = root.resolve("c.java");
          Path sentinel = root.resolve("warmup.js");
          Files.writeString(file, "foam.CLASS({ name: 'A' });");
          Files.createDirectories(skipped.getParent());
          Files.writeString(skipped, "x");
          Files.writeString(other, "x");
          Files.writeString(sentinel, "0");

          MDAO dao = new MDAO(SourceChange.getOwnClassInfo());
          X    sx  = x.put("sourceChangeDAO", dao);

          SourceWatcher w = new SourceWatcher.Builder(sx)
            .setWatchDir(root.toString())
            .setPollInterval(50)
            .build();
          Thread t = startWatcher(sx, w);
          try {
            warmup(dao, sentinel);

            long mt = System.currentTimeMillis() + 5000;
            Files.setLastModifiedTime(file,    FileTime.fromMillis(mt));
            Files.setLastModifiedTime(skipped, FileTime.fromMillis(mt));
            Files.setLastModifiedTime(other,   FileTime.fromMillis(mt));
            boolean seen = await(() -> dao.find("/a.js") != null, 2000);
            test(seen, "the changed .js is reported under the root-relative path with a leading slash");

            // warmup's own sentinel (/warmup.js) is still in dao; exclude it by id rather than
            // depending on a remove() that runs concurrently with the watcher's own puts.
            long changes = ((Count) dao.where(NEQ(SourceChange.ID, "/warmup.js")).select(new Count())).getValue();
            test(changes == 1, "one change reported: the .js outside skipDirs, got " + changes);
            test(Files.exists(file), "the source file is not deleted");
          } finally {
            stopWatcher(w, t, 2000);
          }

          SourceWatcher off = new SourceWatcher.Builder(sx).setWatchDir("").build();
          off.start();
          test(! off.getRunning().get(), "start() without core.webroot does not run");
        } catch ( Exception e ) {
          throw new RuntimeException(e);
        } finally {
          if ( root != null ) deleteTree(root);
        }
      `
    },
    {
      documentation: `Repeatedly touch sentinel with a fresh mtime until dao reports its change,
        proving the SourceWatcher's baseline scan has completed and its poll loop is ticking. Leaves
        the row in dao: the caller excludes it by id instead of depending on a remove() racing the
        watcher's own puts.`,
      name: 'warmup',
      args: 'MDAO dao, Path sentinel',
      javaThrows: [ 'Exception' ],
      javaCode: `
        String id       = "/" + sentinel.getFileName().toString();
        long   deadline = System.currentTimeMillis() + 2000;
        while ( dao.find(id) == null ) {
          if ( System.currentTimeMillis() >= deadline ) {
            throw new IllegalStateException("SourceWatcher never became active within 2000ms");
          }
          Files.setLastModifiedTime(sentinel, FileTime.fromMillis(System.currentTimeMillis()));
          Thread.sleep(20);
        }
      `
    }
  ]
});
