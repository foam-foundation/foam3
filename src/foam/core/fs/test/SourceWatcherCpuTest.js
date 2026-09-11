/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.fs.test',
  name: 'SourceWatcherCpuTest',
  extends: 'foam.core.test.Test',

  documentation: `Measures what SourceWatcher costs while it idles over the checkout the tests run in (project.home). Prints the JVM's CPU seconds for an idle window and for a watching window of the same length, so CI logs carry the number next to a developer's. Fails only on a gross regression: the watcher's own share above a quarter of one core.`,

  javaImports: [
    'com.sun.management.OperatingSystemMXBean',
    'foam.core.fs.SourceChange',
    'foam.core.fs.SourceWatcher',
    'foam.dao.MDAO',
    'foam.lang.X',
    'java.lang.management.ManagementFactory',
    'java.nio.file.Files',
    'java.nio.file.Path',
    'java.nio.file.Paths'
  ],

  constants: [
    { name: 'WINDOW_MS', type: 'long', value: 15000 }
  ],

  methods: [
    {
      name: 'cpuSeconds',
      type: 'double',
      javaCode: `
        return ((OperatingSystemMXBean) ManagementFactory.getOperatingSystemMXBean()).getProcessCpuTime() / 1e9;
      `
    },
    {
      name: 'runTest',
      javaCode: `
        String root = System.getProperty("project.home");
        if ( root == null || ! Files.isDirectory(Paths.get(root)) ) {
          test(false, "project.home is not a directory: " + root);
          return;
        }
        try {
          double idle0 = cpuSeconds();
          Thread.sleep(WINDOW_MS);
          double idle = cpuSeconds() - idle0;

          X sx = x.put("sourceChangeDAO", new MDAO(SourceChange.getOwnClassInfo()));
          SourceWatcher w = new SourceWatcher.Builder(sx).setWatchDir(root).build();
          w.getRunning().set(true);
          Thread t = new Thread(() -> w.execute(sx));
          t.start();
          Thread.sleep(2000); // first scan
          double watch0 = cpuSeconds();
          Thread.sleep(WINDOW_MS);
          double watching = cpuSeconds() - watch0;
          w.stop();
          t.join(3000);

          double secs  = WINDOW_MS / 1000.0;
          double share = (watching - idle) / secs * 100;
          // The numbers ride on the assertion message so CI logs show them.
          test(share < 25, String.format("SourceWatcher over %s: idle %.2f cpu-s, watching %.2f cpu-s per %.0fs, watcher share %.1f%% of one core (limit 25%%)", root, idle, watching, secs, share));
        } catch ( InterruptedException e ) {
          test(false, "interrupted");
        }
      `
    }
  ]
});
