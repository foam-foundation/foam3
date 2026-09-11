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

  documentation: `Watch a directory for files that appear or change. Each one's
path relative to watchDir is a 'request': handleRequest gets it when
acceptRequest agrees, then postCleanup runs, which by default deletes the file.

Two modes, chosen by recursive. recursive: false, the default and every existing
subclass before SourceWatcher, runs watch(): java.nio.WatchService on watchDir
itself, event-driven and the right tool for one request directory; this is the
original implementation and its behaviour is kept as-is for backward
compatibility, including that postCleanup runs for a rejected request too, not
only an accepted one. recursive: true, SourceWatcher only, runs poll(): a stat
poll instead, because on macOS WatchService is sun.nio.fs.PollingWatchService,
10s per directory by default, and registering one per directory on a
3245-directory source tree measured 19.5% of one core against 5% for a stat of
the 5715 known files every 500ms. poll() never deletes a rejected file, since
acceptRequest is applied at scan time and a rejected file is never tracked.`,

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
    'java.nio.file.FileVisitResult',
    'java.nio.file.Files',
    'java.nio.file.Path',
    'java.nio.file.Paths',
    'java.nio.file.SimpleFileVisitor',
    'java.nio.file.StandardWatchEventKinds',
    'java.nio.file.WatchEvent',
    'java.nio.file.WatchKey',
    'java.nio.file.WatchService',
    'java.nio.file.attribute.BasicFileAttributes',
    'java.util.Arrays',
    'java.util.HashMap',
    'java.util.HashSet',
    'java.util.Iterator',
    'java.util.Map',
    'java.util.Set',
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
      documentation: 'Walk subdirectories of watchDir, and switch execute() from the legacy watch() to the stat-poll poll(). See the class documentation.',
      name: 'recursive',
      class: 'Boolean'
    },
    {
      documentation: 'Directory names not walked when recursive. Applies to poll() (recursive: true) only.',
      name: 'skipDirs',
      class: 'StringArray'
    },
    {
      documentation: 'skipDirs as a set, built once instead of per scan().',
      name: 'skipDirSet',
      class: 'Object',
      javaType: 'java.util.Set<String>',
      javaFactory: 'return new HashSet<>(Arrays.asList(getSkipDirs()));',
      visibility: 'HIDDEN',
      networkTransient: true
    },
    {
      documentation: 'Milliseconds between stats of the known files. Applies to poll() (recursive: true) only.',
      name: 'pollInterval',
      class: 'Long',
      value: 500
    },
    {
      documentation: 'Milliseconds between walks of watchDir that pick up new and deleted files. 0 walks every tick. Applies to poll() (recursive: true) only.',
      name: 'rescanInterval',
      class: 'Long'
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
      documentation: 'Set by watch() (recursive: false) so stop() can close it, which unblocks a WatchService.take() that is currently waiting. Unused, stays null, in poll() (recursive: true).',
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

        if ( getRecursive() ) {
          poll(x, root);
        } else {
          watch(x, root);
        }
      } catch (Throwable t) {
        throw t;
      } finally {
        logger.info("exit");
      }
      `
    },
    {
      documentation: 'Stat-poll mode (recursive: true, SourceWatcher only). See the class documentation for why this is a poll and not a WatchService per directory.',
      name: 'poll',
      args: 'X x, Path root',
      javaCode: `
      Map<String, Long> known    = scan(x, root);
      long              lastScan = System.currentTimeMillis();

      while ( getRunning().get() ) {
        try {
          Thread.sleep(getPollInterval());
        } catch (InterruptedException e) {
          Thread.currentThread().interrupt();
          break;
        }

        if ( System.currentTimeMillis() - lastScan >= getRescanInterval() ) {
          Map<String, Long> fresh = scan(x, root);
          for ( Map.Entry<String, Long> e : fresh.entrySet() ) {
            if ( known.putIfAbsent(e.getKey(), e.getValue()) == null ) {
              request(x, e.getKey());
            }
          }
          known.keySet().retainAll(fresh.keySet());
          lastScan = System.currentTimeMillis();
        }

        Iterator<Map.Entry<String, Long>> it = known.entrySet().iterator();
        while ( it.hasNext() ) {
          Map.Entry<String, Long> e = it.next();
          long mt = root.resolve(e.getKey()).toFile().lastModified();
          if ( mt == 0 ) {
            // gone: postCleanup deleted it, or the user did
            it.remove();
            continue;
          }
          if ( mt == e.getValue() ) continue;
          e.setValue(mt);
          request(x, e.getKey());
        }
      }
      `
    },
    {
      documentation: 'The original implementation (recursive: false, the default; every existing subclass before SourceWatcher). java.nio.WatchService on root, ENTRY_CREATE only; unlike request(), postCleanup runs for a rejected request too -- the legacy behaviour, kept as-is for backward compatibility.',
      name: 'watch',
      args: 'X x, Path root',
      javaCode: `
      Logger logger = Loggers.logger(x, this);
      try {
        WatchService ws = FileSystems.getDefault().newWatchService();
        setWatchService(ws);
        try {
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
                String request = event.context().toString();
                logger.info("Detected", request);
                try {
                  if ( acceptRequest(x, request) ) {
                    handleRequest(x, request);
                  } else {
                    logger.warning("Rejected", request);
                  }
                  postCleanup(x, request);
                } catch (Throwable t) {
                  logger.warning(t);
                }
              }
            }
            key.reset();
          }
        } finally {
          try {
            ws.close();
          } catch (IOException e) {
            // already closing
          }
        }
      } catch (IOException e) {
        logger.error("watch", e);
      }
      `
    },
    {
      documentation: 'mtime of every accepted file under root, keyed by its request string; subdirectories only when recursive, never skipDirs.',
      name: 'scan',
      args: 'X x, Path root',
      javaType: 'Map<String, Long>',
      javaCode: `
      Map<String, Long> files = new HashMap<>();
      Set<String>       skip  = getSkipDirSet();
      try {
        Files.walkFileTree(root, new SimpleFileVisitor<Path>() {
          @Override
          public FileVisitResult preVisitDirectory(Path dir, BasicFileAttributes attrs) {
            if ( dir.equals(root) ) return FileVisitResult.CONTINUE;
            return getRecursive() && ! skip.contains(dir.getFileName().toString())
              ? FileVisitResult.CONTINUE
              : FileVisitResult.SKIP_SUBTREE;
          }
          @Override
          public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) {
            String req = toRequest(root, file);
            if ( acceptRequest(x, req) ) {
              files.put(req, attrs.lastModifiedTime().toMillis());
            }
            return FileVisitResult.CONTINUE;
          }
          @Override
          public FileVisitResult visitFileFailed(Path file, IOException e) {
            Loggers.logger(x, this).debug("scan visitFileFailed", file, e);
            return FileVisitResult.CONTINUE;
          }
        });
      } catch (IOException e) {
        Loggers.logger(x, this).warning("scan", root, e);
      }
      return files;
      `
    },
    {
      documentation: 'The request string for a file: its path relative to root with forward slashes.',
      name: 'toRequest',
      args: 'Path root, Path file',
      type: 'String',
      javaCode: `
      return root.relativize(file).toString().replace(File.separatorChar, '/');
      `
    },
    {
      documentation: 'Handle one detected file, then clean it up. A failure in either is logged and the loop goes on.',
      name: 'request',
      args: 'X x, String request',
      javaCode: `
      Logger logger = Loggers.logger(x, this);
      logger.info("Detected", request);
      try {
        handleRequest(x, request);
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
