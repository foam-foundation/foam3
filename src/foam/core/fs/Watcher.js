/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.fs',
  name: 'Watcher',
  abstract: true,
  implements: [
    'foam.lang.ContextAgent',
    'foam.core.COREService'
  ],

  documentation: `Watch a directory for files that appear. Each one's name is a
'request': handleRequest gets it when acceptRequest agrees, then postCleanup
runs, which by default deletes the file. postCleanup runs for a rejected
request too.

watch() is the loop: java.nio.WatchService on watchDir itself, event-driven and
the right tool for one request directory. PollingWatcher overrides it with a
stat poll that can walk a tree.`,

  javaImports: [
    'foam.core.app.AppConfig',
    'foam.core.logger.Logger',
    'foam.core.logger.Loggers',
    'foam.lang.AgencyTimerTask',
    'foam.lang.X',
    'foam.util.SafetyUtil',
    'java.io.File',
    'java.io.IOException',
    'java.nio.file.ClosedWatchServiceException',
    'java.nio.file.FileSystems',
    'java.nio.file.Files',
    'java.nio.file.Path',
    'java.nio.file.Paths',
    'java.nio.file.StandardWatchEventKinds',
    'java.nio.file.WatchEvent',
    'java.nio.file.WatchKey',
    'java.nio.file.WatchService',
    'java.util.Timer',
    'java.util.concurrent.atomic.AtomicBoolean'
  ],

  properties: [
    {
      name: 'tmpDir',
      class: 'String',
      javaFactory: `
      return System.getProperty("java.io.tmpdir", "tmp");
      `
    },
    {
      documentation: 'Create unique tmp directory for this watcher',
      name: 'watchDir',
      class: 'String',
      javaFactory: `
      AppConfig appConfig = (AppConfig) getX().get("appConfig");
      String appName = appConfig.getName().trim().replaceAll(" ","");
      String hostname = System.getProperty("hostname", "localhost");
      if ( hostname.equals("localhost") ) {
        hostname = System.getProperty("user.name", "localhost");
      }
      String name = getClass().getSimpleName().replace("Watcher","").toLowerCase();
      Path path = FileSystems.getDefault().getPath(getTmpDir(), hostname, appName, name);
      return path.toString();
      `
    },
    {
      name: 'initialTimerDelay',
      class: 'Int',
      value: 5000
    },
    {
      name: 'threadPoolName',
      class: 'String',
      value: 'threadPool'
    },
    {
      documentation: 'Store reference to timer so it can be cancelled, and agent restarted.',
      name: 'timer',
      class: 'Object',
      visibility: 'HIDDEN',
      networkTransient: true
    },
    {
      name: 'running',
      class: 'Object',
      javaType: 'java.util.concurrent.atomic.AtomicBoolean',
      javaFactory: 'return new AtomicBoolean();',
      visibility: 'HIDDEN',
      networkTransient: true
    },
    {
      documentation: 'Set by watch() so stop() can close it, which unblocks a WatchService.take() that is currently waiting.',
      name: 'watchService',
      class: 'Object',
      javaType: 'java.nio.file.WatchService',
      visibility: 'HIDDEN',
      networkTransient: true
    }
 ],

  methods: [
    {
      documentation: 'Start as a COREService',
      name: 'start',
      javaCode: `
      if ( SafetyUtil.isEmpty(getWatchDir()) ) {
        Loggers.logger(getX(), this).info("watchDir not set, not watching");
        return;
      }
      getRunning().set(true);
      Timer timer = new Timer(this.getClass().getSimpleName(), true);
      setTimer(timer);
      timer.schedule(
        new AgencyTimerTask(getX(), getThreadPoolName(), this),
        getInitialTimerDelay());
      `
    },
    {
      name: 'stop',
      javaCode: `
      getRunning().set(false);
      if ( getTimer() != null ) ((Timer) getTimer()).cancel();
      if ( getWatchService() != null ) {
        try {
          getWatchService().close();
        } catch (IOException e) {
          // already closing
        }
      }
      `
    },
    {
      name: 'execute',
      args: 'Context x',
      javaCode: `
      Logger logger = Loggers.logger(x, this);
      Path   root   = Paths.get(getWatchDir()).toAbsolutePath().normalize();
      logger.info("execute", root);

      try {
        mkdirs(x, getWatchDir());
        preCleanup(x);
        watch(x, root);
      } finally {
        logger.info("exit");
      }
      `
    },
    {
      documentation: 'The loop: java.nio.WatchService on root, ENTRY_CREATE only. Runs until stop().',
      name: 'watch',
      args: 'X x, Path root',
      javaCode: `
      Logger logger = Loggers.logger(x, this);
      try ( WatchService ws = FileSystems.getDefault().newWatchService() ) {
        setWatchService(ws);
        root.register(ws, StandardWatchEventKinds.ENTRY_CREATE);

        while ( getRunning().get() ) {
          WatchKey key;
          try {
            key = ws.take();
          } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            break;
          } catch (ClosedWatchServiceException e) {
            // stop() closed ws to unblock this take()
            break;
          }
          if ( ! getRunning().get() ) break;

          for ( WatchEvent<?> event : key.pollEvents() ) {
            if ( event.kind() == StandardWatchEventKinds.ENTRY_CREATE ) {
              request(x, event.context().toString());
            }
          }
          key.reset();
        }
      } catch (IOException e) {
        logger.error("watch", e);
      }
      `
    },
    {
      documentation: 'One detected request: handle it when acceptRequest agrees, then postCleanup. A failure in either is logged and the loop goes on.',
      name: 'request',
      args: 'X x, String request',
      javaCode: `
      Logger logger = Loggers.logger(x, this);
      logger.info("Detected", request);
      try {
        if ( acceptRequest(x, request) ) {
          handleRequest(x, request);
        } else {
          logger.warning("Rejected", request);
        }
        postCleanup(x, request);
      } catch (Throwable t) {
        logger.warning(request, t);
      }
      `
    },
    {
      documentation: 'Return true if this agent can process the event',
      name: 'acceptRequest',
      args: 'X x, String request',
      type: 'Boolean',
      javaCode: `
        throw new UnsupportedOperationException("Abstract method not implemented: "+this.getClass().getSimpleName() + ".acceptRequest");
      `
    },
    {
      documentation: 'Process the event',
      name: 'handleRequest',
      args: 'X x, String request',
      javaCode: `
        throw new UnsupportedOperationException("Abstract method not implemented: "+this.getClass().getSimpleName() + ".handleRequest");
      `
    },
    {
      documentation: 'Cleanup on system start.',
      name: 'preCleanup',
      args: 'X x',
      javaCode: `
        // nop
      `
    },
    {
      documentation: 'Cleanup after accepting the request for processing',
      name: 'postCleanup',
      args: 'X x, String request',
      javaCode: `
      try {
        Path existing = Paths.get(getWatchDir(), request);
        Files.deleteIfExists(existing);
        existing.toFile().deleteOnExit();
      } catch ( IOException e) {
        Loggers.logger(x, this).warning(e);
      }
      `
    },
    {
      name: 'mkdirs',
      args: 'X x, String name',
      javaCode: `
      File dir = new File(name);
      if ( ! dir.exists() ) {
        if ( ! dir.mkdirs() ) {
          Loggers.logger(x, this).error("Failed directory creation", name);
          throw new RuntimeException(this.getClass().getSimpleName() + " Failed watch directory creation");
        }
      }
      `
    }
  ]
});
