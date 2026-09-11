/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.fs.test',
  name: 'WatcherTest',
  extends: 'foam.core.test.Test',

  javaImports: [
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
        Path dir  = null;
        Path root = null;
        Path root2 = null;
        Path legacyDir = null;
        try {
          // poll() (recursive: true) on a flat directory: a new file is a request, handled by name, then deleted
          dir = Files.createTempDirectory("watcher");
          Path sentinel = dir.resolve("warmup");
          Path req1     = dir.resolve("req1");
          Path skipTxt  = dir.resolve("skip.txt");
          Files.writeString(sentinel, "0");
          RecordingWatcher w = new RecordingWatcher.Builder(x)
            .setWatchDir(dir.toString())
            .setRecursive(true)
            .setPollInterval(50)
            .build();
          w.getRunning().set(true);
          Thread t = new Thread(() -> w.execute(x));
          t.start();
          try {
            warmup(w, sentinel);
            Files.writeString(req1, "1");
            Files.writeString(skipTxt, "junk");
            // postCleanup runs after handleRequest, so wait for both: otherwise the file-deleted
            // assertion below can run in the gap between the two.
            boolean seen = await(() -> ! w.getHandled().isEmpty() && ! Files.exists(req1), 2000);
            test(seen && w.getHandled().size() == 1 && "req1".equals(w.getHandled().get(0)),
              "a file appearing in watchDir is handled by name, got " + w.getHandled());
            test(! Files.exists(req1), "postCleanup deleted the handled file");
            test(Files.exists(skipTxt), "a file acceptRequest rejects is left alone");
          } finally {
            w.stop();
            t.join(2000);
          }
          test(! t.isAlive(), "stop() ends the poll loop");

          // recursive: relative path with forward slashes, skipDirs honoured, a modify is a request
          root = Files.createTempDirectory("watcher-tree");
          Path nested = root.resolve("a").resolve("b");
          Path built  = root.resolve("build");
          Files.createDirectories(nested);
          Files.createDirectories(built);
          Path inner        = nested.resolve("inner.js");
          Path out          = built.resolve("out.js");
          Path rootSentinel = root.resolve("warmup");
          Files.writeString(inner, "1");
          Files.writeString(out, "1");
          Files.writeString(rootSentinel, "0");
          RecordingWatcher r = new RecordingWatcher.Builder(x)
            .setWatchDir(root.toString())
            .setRecursive(true)
            .setSkipDirs(new String[] { "build" })
            .setPollInterval(50)
            .setRescanInterval(60000)
            .build();
          r.getRunning().set(true);
          Thread rt = new Thread(() -> r.execute(x));
          rt.start();
          try {
            warmup(r, rootSentinel);
            long mt = System.currentTimeMillis() + 5000;
            Files.setLastModifiedTime(inner, FileTime.fromMillis(mt));
            Files.setLastModifiedTime(out,   FileTime.fromMillis(mt));
            boolean seen = await(() -> ! r.getHandled().isEmpty(), 2000);
            test(seen && r.getHandled().size() == 1 && "a/b/inner.js".equals(r.getHandled().get(0)),
              "a modified file under a subdirectory is reported by its relative path and build/ is skipped, got " + r.getHandled());
          } finally {
            r.stop();
            rt.join(2000);
          }

          // recursive with rescan every tick: a file created in a subdirectory is a request
          root2 = Files.createTempDirectory("watcher-tree2");
          Path nested2       = root2.resolve("a");
          Path root2Sentinel = root2.resolve("warmup");
          Files.createDirectories(nested2);
          Files.writeString(root2Sentinel, "0");
          RecordingWatcher n = new RecordingWatcher.Builder(x)
            .setWatchDir(root2.toString())
            .setRecursive(true)
            .setPollInterval(50)
            .build();
          n.getRunning().set(true);
          Thread nt = new Thread(() -> n.execute(x));
          nt.start();
          try {
            warmup(n, root2Sentinel);
            Files.writeString(nested2.resolve("new.js"), "1");
            boolean seen = await(() -> ! n.getHandled().isEmpty(), 2000);
            test(seen && n.getHandled().size() == 1 && "a/new.js".equals(n.getHandled().get(0)),
              "a rescan picks up a file created in a subdirectory, got " + n.getHandled());
          } finally {
            n.stop();
            nt.join(2000);
          }

          // legacy watch() (recursive unset, the default): java.nio.WatchService: a new file is detected and deleted, and so is a rejected one -- the old behaviour
          legacyDir = Files.createTempDirectory("watcher-legacy");
          Path legacyReq1 = legacyDir.resolve("req1");
          Path legacySkip = legacyDir.resolve("skip.txt");
          RecordingWatcher lw = new RecordingWatcher.Builder(x)
            .setWatchDir(legacyDir.toString())
            .build();
          lw.getRunning().set(true);
          Thread lt = new Thread(() -> lw.execute(x));
          lt.start();
          try {
            // watch() has no observable "ready" signal like the poller's baseline scan warmup() waits on --
            // give the WatchService registration time to complete before writing.
            Thread.sleep(500);
            Files.writeString(legacyReq1, "1");
            Files.writeString(legacySkip, "junk");
            // macOS WatchService (PollingWatchService) default sensitivity is ~10s; Linux inotify is effectively instant.
            // Wait for the full end state (handled AND both files gone), not just handled: postCleanup
            // runs after handleRequest, so checking handled alone can race the gap between the two.
            boolean seen = await(() ->
              lw.getHandled().contains("req1") && ! Files.exists(legacyReq1) && ! Files.exists(legacySkip), 15000);
            test(seen, "the legacy WatchService path detects a new file by name, got " + lw.getHandled());
            test(! Files.exists(legacyReq1), "postCleanup deleted the accepted file");
            test(! Files.exists(legacySkip), "postCleanup deletes a rejected file too -- the legacy behaviour");
          } finally {
            lw.stop();
            lt.join(3000);
          }
          test(! lt.isAlive(), "stop() closes the WatchService so a blocked take() returns and the loop ends");
        } catch ( Exception e ) {
          throw new RuntimeException(e);
        } finally {
          if ( dir       != null ) deleteTree(dir);
          if ( root      != null ) deleteTree(root);
          if ( root2     != null ) deleteTree(root2);
          if ( legacyDir != null ) deleteTree(legacyDir);
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
      documentation: `Repeatedly touch sentinel with a fresh mtime until w reports it handled,
        proving w's baseline scan has completed and its poll loop is ticking, then clear handled
        so the caller's own assertions start from an empty list.`,
      name: 'warmup',
      args: 'RecordingWatcher w, Path sentinel',
      javaThrows: [ 'Exception' ],
      javaCode: `
        long deadline = System.currentTimeMillis() + 2000;
        while ( w.getHandled().isEmpty() ) {
          if ( System.currentTimeMillis() >= deadline ) {
            throw new IllegalStateException("watcher never became active within 2000ms");
          }
          // writeString, not setLastModifiedTime: postCleanup may have
          // deleted sentinel between the isEmpty() check above and here
          // (it is a normal accepted request too, handled and cleaned up
          // like any other), and setLastModifiedTime throws
          // NoSuchFileException on a missing file where a write recreates it.
          Files.writeString(sentinel, "0");
          Thread.sleep(20);
        }
        w.getHandled().clear();
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
