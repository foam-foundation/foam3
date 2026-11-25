/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.app.test',
  name: 'ShutdownWatcherTest',
  extends: 'foam.core.test.Test',

  documentation: `ShutdownWatcher requests, called directly with a one hour delay so
nothing exits: ABORT_SHUTDOWN cancels only the waiting shutdown, a later SHUTDOWN
still runs, a repeat SHUTDOWN is ignored, and preCleanup removes leftover files.`,

  javaImports: [
    'foam.core.app.ShutdownWatcher',
    'java.nio.file.Files',
    'java.nio.file.Path'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        Path dir = null;
        ShutdownWatcher w = null;
        try {
          dir = Files.createTempDirectory("shutdownwatcher");
          w = new ShutdownWatcher.Builder(x)
            .setWatchDir(dir.toString())
            .setDelay(3600)
            .build();

          test(w.acceptRequest(x, ShutdownWatcher.SHUTDOWN) &&
               w.acceptRequest(x, ShutdownWatcher.ABORT_SHUTDOWN) &&
               ! w.acceptRequest(x, "DOWN"),
            "accepts SHUTDOWN and ABORT_SHUTDOWN only");

          w.handleRequest(x, ShutdownWatcher.SHUTDOWN);
          Thread first = w.getPending();
          test(first != null && first.isAlive(), "SHUTDOWN starts a waiting shutdown");

          w.handleRequest(x, ShutdownWatcher.SHUTDOWN);
          test(w.getPending() == first, "a repeat SHUTDOWN while one waits is ignored");

          w.handleRequest(x, ShutdownWatcher.ABORT_SHUTDOWN);
          first.join(2000);
          test(! first.isAlive() && w.getPending() == null, "ABORT_SHUTDOWN ends the waiting shutdown at once");

          w.handleRequest(x, ShutdownWatcher.ABORT_SHUTDOWN);
          test(w.getPending() == null, "ABORT_SHUTDOWN with nothing waiting does nothing");

          w.handleRequest(x, ShutdownWatcher.SHUTDOWN);
          Thread second = w.getPending();
          test(second != null && second != first && second.isAlive(),
            "SHUTDOWN after an abort starts a new waiting shutdown");

          w.handleRequest(x, ShutdownWatcher.ABORT_SHUTDOWN);
          second.join(2000);
          test(! second.isAlive(), "the second shutdown can be aborted too");

          Path shutdown = dir.resolve(ShutdownWatcher.SHUTDOWN);
          Path abort    = dir.resolve(ShutdownWatcher.ABORT_SHUTDOWN);
          Files.createFile(shutdown);
          Files.createFile(abort);
          w.preCleanup(x);
          test(! Files.exists(shutdown) && ! Files.exists(abort),
            "preCleanup removes leftover SHUTDOWN and ABORT_SHUTDOWN");
        } catch ( Exception e ) {
          test(false, "unexpected " + e);
        } finally {
          // Never leave a waiting shutdown behind: it would exit the test JVM.
          if ( w != null && w.getPending() != null ) w.getPending().interrupt();
          if ( dir != null ) {
            try {
              Files.deleteIfExists(dir.resolve(ShutdownWatcher.SHUTDOWN));
              Files.deleteIfExists(dir.resolve(ShutdownWatcher.ABORT_SHUTDOWN));
              Files.deleteIfExists(dir);
            } catch ( Exception e ) { }
          }
        }
      `
    }
  ]
});
