/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.fs.test',
  name: 'SourceWatcherBenchmark',
  extends: 'foam.core.bench.Benchmark',

  documentation: `One SourceWatcher poll tick over project.home: a stat of every
    known .js. The reported operations per second is ticks per second; one
    tick's share of a core at the default 500ms pollInterval is
    (1000 / ops) / 500. Run with ./build.sh javaBenchmarks:SourceWatcherBenchmark.`,

  javaImports: [
    'foam.core.bench.BenchmarkResult',
    'foam.core.fs.SourceWatcher',
    'java.nio.file.Path',
    'java.nio.file.Paths',
    'java.util.Map'
  ],

  javaCode: `
    SourceWatcher     watcher_;
    Path              root_;
    Map<String, Long> known_;
  `,

  methods: [
    {
      name: 'setup',
      args: 'Context x, BenchmarkResult br',
      javaCode: `
        root_    = Paths.get(System.getProperty("project.home", ".")).toAbsolutePath().normalize();
        watcher_ = new SourceWatcher.Builder(x).setWatchDir(root_.toString()).build();
        known_   = watcher_.scan(x, root_);
      `
    },
    {
      name: 'execute',
      args: 'Context x',
      javaCode: `
        watcher_.tick(x, root_, known_);
      `
    }
  ]
});
