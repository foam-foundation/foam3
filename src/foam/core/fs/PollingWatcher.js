/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.fs',
  name: 'PollingWatcher',
  extends: 'foam.core.fs.Watcher',
  abstract: true,

  documentation: `A Watcher whose loop is a stat poll instead of a WatchService,
so it can watch a whole tree: a request is a file's path relative to watchDir,
and a change of mtime is a request too, not only a new file.

On macOS WatchService is sun.nio.fs.PollingWatchService, 10s per directory by
default, so one per directory on a source tree costs more than a stat of every
known file each tick; doc/guides/LiveReload.md has the measurements.
acceptRequest is applied at scan time, so a rejected file is never tracked and
never cleaned up.`,

  javaImports: [
    'foam.core.logger.Logger',
    'foam.core.logger.Loggers',
    'foam.lang.X',
    'java.io.File',
    'java.io.IOException',
    'java.nio.file.FileVisitResult',
    'java.nio.file.Files',
    'java.nio.file.Path',
    'java.nio.file.SimpleFileVisitor',
    'java.nio.file.attribute.BasicFileAttributes',
    'java.util.Arrays',
    'java.util.HashMap',
    'java.util.HashSet',
    'java.util.Iterator',
    'java.util.Map',
    'java.util.Set'
  ],

  properties: [
    {
      documentation: 'Walk subdirectories of watchDir.',
      name: 'recursive',
      class: 'Boolean'
    },
    {
      documentation: 'Directory names not walked when recursive. A name starting with "." is never walked.',
      name: 'skipDirs',
      class: 'StringArray'
    },
    {
      documentation: 'Milliseconds between stats of the known files.',
      name: 'pollInterval',
      class: 'Long',
      value: 500
    },
    {
      documentation: 'Milliseconds between walks of watchDir that pick up new and deleted files. 0 walks every tick.',
      name: 'rescanInterval',
      class: 'Long'
    }
  ],

  methods: [
    {
      documentation: 'The loop: scan once for the baseline, then every pollInterval stat the known files, and every rescanInterval walk the tree again. Runs until stop().',
      name: 'watch',
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

        tick(x, root, known);
      }
      `
    },
    {
      documentation: 'One poll: stat every known file, drop the ones that are gone, and raise a request for each whose mtime moved.',
      name: 'tick',
      args: [
        { name: 'x',     type: 'Context' },
        { name: 'root',  javaType: 'java.nio.file.Path' },
        { name: 'known', javaType: 'java.util.Map<String, Long>' }
      ],
      javaCode: `
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
      `
    },
    {
      documentation: 'mtime of every accepted file under root, keyed by its request string; subdirectories only when recursive, never a skipDirs entry or a dot-directory.',
      name: 'scan',
      args: 'X x, Path root',
      javaType: 'Map<String, Long>',
      javaCode: `
      Map<String, Long> files = new HashMap<>();
      Set<String>       skip  = new HashSet<>(Arrays.asList(getSkipDirs()));
      try {
        Files.walkFileTree(root, new SimpleFileVisitor<Path>() {
          @Override
          public FileVisitResult preVisitDirectory(Path dir, BasicFileAttributes attrs) {
            if ( dir.equals(root) ) return FileVisitResult.CONTINUE;
            String name = dir.getFileName().toString();
            return getRecursive() && ! name.startsWith(".") && ! skip.contains(name)
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
    }
  ]
});
