/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.fs.test',
  name: 'WatcherTestBase',
  extends: 'foam.core.test.Test',
  abstract: true,

  documentation: 'What a Watcher test needs: run a watcher on its own thread and stop it, wait for a condition on that thread, and delete the temp tree it watched.',

  javaImports: [
    'foam.core.fs.Watcher',
    'foam.lang.X',
    'java.io.IOException',
    'java.nio.file.FileVisitResult',
    'java.nio.file.Files',
    'java.nio.file.Path',
    'java.nio.file.SimpleFileVisitor',
    'java.nio.file.attribute.BasicFileAttributes',
    'java.util.function.BooleanSupplier'
  ],

  methods: [
    {
      documentation: 'Run w.execute(x) on a new thread, bypassing start() and its Timer. The caller stops it with stopWatcher.',
      name: 'startWatcher',
      args: 'X x, Watcher w',
      javaType: 'Thread',
      javaCode: `
        w.getRunning().set(true);
        Thread t = new Thread(() -> w.execute(x));
        t.start();
        return t;
      `
    },
    {
      documentation: 'stop() the watcher and wait for its thread to end.',
      name: 'stopWatcher',
      args: 'Watcher w, Thread t, long joinMs',
      javaThrows: [ 'InterruptedException' ],
      javaCode: `
        w.stop();
        t.join(joinMs);
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
