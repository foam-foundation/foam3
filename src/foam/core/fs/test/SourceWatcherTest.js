/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.fs.test',
  name: 'SourceWatcherTest',
  extends: 'foam.core.test.Test',

  javaImports: [
    'foam.core.fs.SourceChange',
    'foam.core.fs.SourceWatcher',
    'foam.dao.ArraySink',
    'foam.dao.MDAO',
    'foam.lang.X',
    'java.io.IOException',
    'java.nio.file.FileVisitResult',
    'java.nio.file.Files',
    'java.nio.file.Path',
    'java.nio.file.SimpleFileVisitor',
    'java.nio.file.attribute.BasicFileAttributes',
    'java.nio.file.attribute.FileTime',
    'java.util.function.BooleanSupplier'
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
          w.getRunning().set(true);
          Thread t = new Thread(() -> w.execute(sx));
          t.start();
          try {
            warmup(dao, sentinel);

            long mt = System.currentTimeMillis() + 5000;
            Files.setLastModifiedTime(file,    FileTime.fromMillis(mt));
            Files.setLastModifiedTime(skipped, FileTime.fromMillis(mt));
            Files.setLastModifiedTime(other,   FileTime.fromMillis(mt));
            boolean seen = await(() -> dao.find("/a.js") != null, 2000);

            // warmup's own sentinel (/warmup.js) may still be in dao, or may have been detected
            // a second time under load before its mtime settled; it is not part of what this
            // assertion is proving, so exclude it by id rather than depending on exactly-once
            // detection or a remove() that runs concurrently with the watcher's own puts.
            ArraySink sink = (ArraySink) dao.select(new ArraySink());
            long changes = sink.getArray().stream()
              .filter(o -> ! "/warmup.js".equals(((SourceChange) o).getId()))
              .count();
            test(seen && changes == 1, "one change reported: the .js outside skipDirs, got " + changes);

            SourceChange c = (SourceChange) dao.find("/a.js");
            test(c != null, "id is the root-relative path with a leading slash");
            test(c != null && c.getModified() != null, "modified is set");
            test(Files.exists(file), "the source file is not deleted");
          } finally {
            w.stop();
            t.join(2000);
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
      documentation: 'Poll cond every 20ms until it is true or timeoutMs elapses.',
      name: 'await',
      args: 'BooleanSupplier cond, long timeoutMs',
      type: 'Boolean',
      javaThrows: [ 'InterruptedException' ],
      javaCode: `
        long deadline = System.currentTimeMillis() + timeoutMs;
        while ( ! cond.getAsBoolean() ) {
          if ( System.currentTimeMillis() >= deadline ) return false;
          Thread.sleep(20);
        }
        return true;
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
    },
    {
      documentation: 'Recursively delete a temp directory tree used by this test.',
      name: 'deleteTree',
      args: 'Path root',
      javaThrows: [ 'IOException' ],
      javaCode: `
        if ( ! Files.exists(root) ) return;
        Files.walkFileTree(root, new SimpleFileVisitor<Path>() {
          @Override
          public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) throws IOException {
            Files.deleteIfExists(file);
            return FileVisitResult.CONTINUE;
          }
          @Override
          public FileVisitResult postVisitDirectory(Path dir, IOException exc) throws IOException {
            Files.deleteIfExists(dir);
            return FileVisitResult.CONTINUE;
          }
        });
      `
    }
  ]
});
