/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.app',
  name: 'ShutdownWatcher',
  extends: 'foam.core.fs.Watcher',
  javaImplements: [ 'Runnable' ],

  documentation: `Agent, when trigger, will System.exit.
Install example:
p({
  "class": "foam.core.boot.CSpec",
  "name": "shutdownWatcher",
  "lazy": false,
  "serviceClass": "foam.core.app.ShutdownWatcher"
})

Touch SHUTDOWN in watchDir to exit after delay seconds; touch ABORT_SHUTDOWN
during the delay to cancel it. See ShutdownWatcher.md.

Use Runtime.getRuntime().addShutdownHook(Runnable) to register a shutdown hook
`,

  javaImports: [
    'foam.core.logger.Logger',
    'foam.core.logger.Loggers',
    'foam.core.logger.StdoutLogger',
    'foam.dao.DAO',
    'foam.lang.X',
    'foam.util.SafetyUtil',
    'java.io.File',
    'java.io.IOException',
    'java.nio.file.Files',
    'java.nio.file.Path',
    'java.nio.file.Paths',
    'java.nio.file.FileSystems',
    'java.nio.file.WatchEvent',
    'java.nio.file.WatchKey',
    'java.nio.file.WatchService',
    'java.nio.file.StandardWatchEventKinds'
  ],

  properties: [
    {
      documentation: 'Delay between receive shutdown request and System.exit. Value in seconds',
      name: 'delay',
      class: 'Int',
      unitValue: 's',
      value: 30
    },
    {
      documentation: 'The thread waiting out the delay before exit, or null. ABORT_SHUTDOWN interrupts it.',
      name: 'pending',
      class: 'Object',
      javaType: 'Thread',
      visibility: 'HIDDEN',
      networkTransient: true
    }
  ],

  constants: [
    {
      name: 'SHUTDOWN',
      type: 'String',
      value: 'SHUTDOWN'
    },
    {
      name: 'ABORT_SHUTDOWN',
      type: 'String',
      value: 'ABORT_SHUTDOWN'
    }
  ],

  methods: [
    {
      name: 'acceptRequest',
      javaCode: `
        return SHUTDOWN.equals(request) ||
               ABORT_SHUTDOWN.equals(request);
      `
    },
    {
      documentation: 'Request or abort a shutdown. An abort cancels only the shutdown that is waiting.',
      name: 'handleRequest',
      javaCode: `
      Logger logger = Loggers.logger(x, this);
      synchronized ( this ) {
        Thread  pending = getPending();
        boolean waiting = pending != null && pending.isAlive();

        if ( ABORT_SHUTDOWN.equals(request) ) {
          if ( ! waiting ) {
            logger.warning("Shutdown abort requested, no shutdown pending.");
            return;
          }
          logger.warning("Shutdown abort requested.");
          setPending(null);
          pending.interrupt();
          return;
        }

        if ( waiting ) {
          logger.warning("Shutdown requested, already pending.");
          return;
        }

        logger.warning("Shutdown requested.");
        Thread t = new Thread(this);
        t.setName(getClass().getSimpleName());
        t.setDaemon(false);
        setPending(t);
        t.start();
      }
      `
    },
    {
      name: 'preCleanup',
      javaCode: `
      // A file left from before startup is never seen as created, and blocks the next touch.
      for ( String name : new String[] { SHUTDOWN, ABORT_SHUTDOWN } ) {
        try {
          Path existing = Paths.get(getWatchDir(), name);
          Files.deleteIfExists(existing);
          existing.toFile().deleteOnExit();
        } catch ( IOException e) {
          Loggers.logger(x, this).warning("preCleanup", e);
        }
      }
      `
    },
    {
      name: 'run',
      type: 'void',
      javaCode: `
      Logger logger = StdoutLogger.instance();
      StringBuilder sb = new StringBuilder();
      sb.append("Shutdown ");
      if ( getDelay() > 0 ) {
        sb.append("in ");
        sb.append(String.valueOf(getDelay()));
        sb.append(" seconds");
      } else {
        sb.append(" now");
      }
      logger.warning("ShutdownWatcher", sb.toString());
      try {
        Thread.sleep(getDelay() * 1000L);
        synchronized ( this ) {
          // An abort between waking and here clears pending without the interrupt landing in sleep.
          if ( getPending() != Thread.currentThread() ) {
            logger.warning("ShutdownWatcher", "Shutdown aborted");
            return;
          }
        }
        logger.warning("ShutdownWatcher", "Shutdown now");
        System.exit(0);
      } catch (InterruptedException e) {
        logger.warning("ShutdownWatcher", "Shutdown aborted");
      }
      `
    }
  ]
});
