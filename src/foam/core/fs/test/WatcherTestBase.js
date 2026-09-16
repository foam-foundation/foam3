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

  documentation: 'What a Watcher test needs: wait for a condition on another thread, and delete the temp tree it watched.',

  javaImports: [
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
