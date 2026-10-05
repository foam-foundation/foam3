/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.fs.test',
  name: 'WatcherTest',
  extends: 'foam.core.fs.test.WatcherTestBase',

  javaImports: [
    'foam.core.fs.Watcher',
    'foam.lang.X',
    'java.nio.file.Files',
    'java.nio.file.Path',
    'java.nio.file.attribute.FileTime',
    'java.util.List',
    'java.util.concurrent.CopyOnWriteArrayList'
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
          // PollingWatcher on a flat directory: a new file is a request, handled by name and left in place
          dir = Files.createTempDirectory("watcher");
          Path sentinel = dir.resolve("warmup");
          Path req1     = dir.resolve("req1");
          Path skipTxt  = dir.resolve("skip.txt");
          Files.writeString(sentinel, "0");
          RecordingWatcher w = new RecordingWatcher.Builder(x)
            .setWatchDir(dir.toString())
            .setPollInterval(50)
            .build();
          Thread t = startWatcher(x, w);
          try {
            warmup(w, sentinel);
            Files.writeString(req1, "1");
            Files.writeString(skipTxt, "junk");
            boolean seen = await(() -> ! w.getHandled().isEmpty(), 2000);
            test(seen && w.getHandled().size() == 1 && "req1".equals(w.getHandled().get(0)),
              "a file appearing in watchDir is handled by name, got " + w.getHandled());
            test(Files.exists(req1), "a polled file is watched in place: postCleanup deletes nothing");
            test(Files.exists(skipTxt), "a file acceptRequest rejects is left alone");
          } finally {
            stopWatcher(w, t, 2000);
          }
          test(! t.isAlive(), "stop() ends the poll loop");

          // recursive: relative path with forward slashes, skipDirs and dot-directories skipped, a modify is a request
          root = Files.createTempDirectory("watcher-tree");
          Path nested = root.resolve("a").resolve("b");
          Path built  = root.resolve("build");
          Path hidden = root.resolve(".cache");
          Files.createDirectories(nested);
          Files.createDirectories(built);
          Files.createDirectories(hidden);
          Path inner        = nested.resolve("inner.js");
          Path out          = built.resolve("out.js");
          Path cached       = hidden.resolve("cached.js");
          Path rootSentinel = root.resolve("warmup");
          Files.writeString(inner, "1");
          Files.writeString(out, "1");
          Files.writeString(cached, "1");
          Files.writeString(rootSentinel, "0");
          RecordingWatcher r = new RecordingWatcher.Builder(x)
            .setWatchDir(root.toString())
            .setRecursive(true)
            .setSkipDirs(new String[] { "build" })
            .setPollInterval(50)
            .setRescanInterval(60000)
            .build();
          Thread rt = startWatcher(x, r);
          try {
            warmup(r, rootSentinel);
            long mt = System.currentTimeMillis() + 5000;
            Files.setLastModifiedTime(inner,  FileTime.fromMillis(mt));
            Files.setLastModifiedTime(out,    FileTime.fromMillis(mt));
            Files.setLastModifiedTime(cached, FileTime.fromMillis(mt));
            boolean seen = await(() -> ! r.getHandled().isEmpty(), 2000);
            test(seen && r.getHandled().size() == 1 && "a/b/inner.js".equals(r.getHandled().get(0)),
              "a modified file under a subdirectory is reported by its relative path; build/ and .cache/ are skipped, got " + r.getHandled());
          } finally {
            stopWatcher(r, rt, 2000);
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
          Thread nt = startWatcher(x, n);
          try {
            warmup(n, root2Sentinel);
            Files.writeString(nested2.resolve("new.js"), "1");
            boolean seen = await(() -> ! n.getHandled().isEmpty(), 2000);
            test(seen && n.getHandled().size() == 1 && "a/new.js".equals(n.getHandled().get(0)),
              "a rescan picks up a file created in a subdirectory, got " + n.getHandled());
          } finally {
            stopWatcher(n, nt, 2000);
          }

          // Watcher itself: java.nio.WatchService: a new file is detected and deleted, and so is a rejected one
          legacyDir = Files.createTempDirectory("watcher-legacy");
          Path legacyReq1 = legacyDir.resolve("req1");
          Path legacySkip = legacyDir.resolve("skip.txt");
          List<String> legacyHandled = new CopyOnWriteArrayList<>();
          Watcher lw = new Watcher(x) {
            public boolean acceptRequest(X x, String request) { return ! request.startsWith("skip"); }
            public void handleRequest(X x, String request) { legacyHandled.add(request); }
          };
          lw.setWatchDir(legacyDir.toString());
          Thread lt = startWatcher(x, lw);
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
              legacyHandled.contains("req1") && ! Files.exists(legacyReq1) && ! Files.exists(legacySkip), 15000);
            test(seen, "the WatchService path detects a new file by name, got " + legacyHandled);
            test(! Files.exists(legacyReq1), "postCleanup deleted the accepted file");
            test(! Files.exists(legacySkip), "postCleanup deletes a rejected file too");
          } finally {
            stopWatcher(lw, lt, 3000);
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
          Files.setLastModifiedTime(sentinel, FileTime.fromMillis(System.currentTimeMillis()));
          Thread.sleep(20);
        }
        w.getHandled().clear();
      `
    }
  ]
});
