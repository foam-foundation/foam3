/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.benchmark',
  name: 'F3ReplayPipelineBenchmark',
  extends: 'foam.core.bench.Benchmark',

  documentation: `Replay wall and CPU time per apply-stage shape, on the
    staging target a JDAO replays into (BulkLoadDAO), across four axes:

    - line: simple (parallel parse, one apply thread, the line before this
      change), sharded (parallel parse, one apply thread per id shard, the
      line F3FileJournal now picks for a BulkLoadDAO), parseOnly (a NullDAO
      target: the parse pipeline with nothing to apply). parseThreads and
      shards set the thread counts.
    - merge: old (merge, then a second full copyFrom pass) or new (return
      the merged row when the class is unchanged).
    - shape: the share of entries that are updates: unique (0%), half-dup
      (50%, every id twice), or updNN for NN% (upd80: every id five times).
      An update is a delta that merges into the row its id already has.
    - model: narrow (5 properties), user (foam.core.auth.User, ~15 of 80
      set), wide (50 properties, all set).

    Each execution is one pass over the matrix in rotated order; every round
    prints medians so far with the spread. cpu/wall is the parallelism
    reached. Every cell checks the row count and that a merged row still
    carries its first entry's values.

    Run: ./build.sh -W9090 --log-level:INFO '-EJAVA_OPTS:-Xms5g -Xmx5g' java-benchmarks:F3ReplayPipelineBenchmarkRunner`,

  javaImports: [
    'foam.core.auth.User',
    'foam.core.bench.BenchmarkResult',
    'foam.core.bench.BenchmarkRunner',
    'foam.core.fs.FileSystemStorage',
    'foam.core.fs.Storage',
    'foam.dao.BulkLoadDAO',
    'foam.dao.DAO',
    'foam.dao.F3FileJournal',
    'foam.dao.NullDAO',
    'foam.lang.ClassInfo',
    'foam.lang.FObject',
    'foam.lang.PropertyInfo',
    'foam.lang.X',
    'foam.util.concurrent.AssemblyLine',
    'foam.util.concurrent.BatchingAssemblyLine',
    'foam.util.concurrent.SimpleAsyncAssemblyLine',
    'java.io.BufferedWriter',
    'java.io.File',
    'java.io.OutputStreamWriter',
    'java.lang.management.ManagementFactory',
    'java.lang.management.ThreadMXBean',
    'java.nio.file.Files',
    'java.util.ArrayList',
    'java.util.Arrays',
    'java.util.List'
  ],

  properties: [
    {
      class: 'Int',
      name: 'entryCount',
      value: 500000
    },
    {
      class: 'String',
      name: 'lines',
      documentation: 'Lines to compare, comma-separated: simple, sharded, parseOnly.',
      value: 'simple,sharded'
    },
    {
      class: 'Int',
      name: 'parseThreads',
      documentation: 'Parse threads on every line; 0 means cores - 1.'
    },
    {
      class: 'Int',
      name: 'shards',
      documentation: 'Apply threads on the sharded line; 0 means the same as parseThreads.'
    },
    {
      class: 'String',
      name: 'shapes',
      documentation: 'unique, half-dup, or updNN for NN percent updates.',
      value: 'unique,half-dup'
    },
    {
      class: 'String',
      name: 'models',
      value: 'user,wide'
    },
    {
      class: 'String',
      name: 'merges',
      value: 'old,new'
    }
  ],

  javaCode: `
    protected FileSystemStorage storage_;
    protected File              dir_;
    protected String[]          lineNames_;
    protected String[]          shapeNames_;
    protected String[]          modelNames_;
    protected List<long[]>      wall_   = new ArrayList<>();
    protected List<long[]>      cpu_    = new ArrayList<>();
    protected List<long[]>      reader_ = new ArrayList<>();
    protected boolean[]         oldMerge_;

    int threads() {
      return getParseThreads() > 0 ? getParseThreads() : Math.max(1, Runtime.getRuntime().availableProcessors() - 1);
    }

    int shardCount() {
      return getShards() > 0 ? getShards() : threads();
    }

    class VariantF3FileJournal extends F3FileJournal {
      final String  line_;
      final boolean oldMerge_;

      VariantF3FileJournal(String line, boolean oldMerge) {
        line_     = line;
        oldMerge_ = oldMerge;
      }

      @Override
      public AssemblyLine createReplayLine(X x, DAO dao) {
        if ( "sharded".equals(line_) ) return new BatchingAssemblyLine(new SimpleAsyncAssemblyLine(x, "replay", threads(), shardCount()));
        return new BatchingAssemblyLine(new SimpleAsyncAssemblyLine(x, "replay", threads()));
      }

      // The merge before this change: a second full copyFrom pass after the merge.
      @Override
      public FObject mergeFObject(FObject old, FObject diff) {
        if ( ! oldMerge_ ) return super.mergeFObject(old, diff);
        List props = old.getClassInfo().getAxiomsByClass(PropertyInfo.class);
        for ( Object o : props ) mergeProperty(old, diff, (PropertyInfo) o);
        return diff.copyFrom(old);
      }
    }

    static long[] sorted(List<long[]> rounds, int cell) {
      long[] c = new long[rounds.size()];
      for ( int i = 0 ; i < c.length ; i++ ) c[i] = rounds.get(i)[cell];
      Arrays.sort(c);
      return c;
    }

    static long median(List<long[]> rounds, int cell) {
      long[] c = sorted(rounds, cell);
      int n = c.length;
      return n % 2 == 1 ? c[n / 2] : (c[n / 2 - 1] + c[n / 2]) / 2;
    }

    /** Distinct ids in a journal of n entries for a shape: the rest of the entries are updates. **/
    static int uniqueIds(String shape, int n) {
      if ( "unique".equals(shape) ) return n;
      if ( "half-dup".equals(shape) ) return n / 2;
      int pct = Integer.parseInt(shape.substring(3));
      return Math.max(1, (int) (n * (100 - pct) / 100L));
    }

    static String[] split(String csv) {
      return Arrays.stream(csv.split(",")).map(String::trim).toArray(String[]::new);
    }

    // cell = ((line * merges + merge) * shapes + shape) * models + model
    int cells()               { return lineNames_.length * oldMerge_.length * shapeNames_.length * modelNames_.length; }
    String modelOf(int cell)  { return modelNames_[cell % modelNames_.length]; }
    String shapeOf(int cell)  { return shapeNames_[(cell / modelNames_.length) % shapeNames_.length]; }
    boolean oldOf(int cell)   { return oldMerge_[(cell / (modelNames_.length * shapeNames_.length)) % oldMerge_.length]; }
    String lineOf(int cell)   { return lineNames_[cell / (modelNames_.length * shapeNames_.length * oldMerge_.length)]; }
    String label(int cell)    { return String.format("%-11s %-5s %-8s %-6s", lineOf(cell), oldOf(cell) ? "old" : "new", shapeOf(cell), modelOf(cell)); }
    String fileOf(int cell)   { return modelOf(cell) + "_" + shapeOf(cell); }

    static ClassInfo classOf(String model) {
      switch ( model ) {
        case "narrow": return ReplayNarrowModel.getOwnClassInfo();
        case "wide":   return ReplayWideModel.getOwnClassInfo();
        default:       return User.getOwnClassInfo();
      }
    }

    /** The property the first entry sets to "user<id>", checked after a merge. **/
    static String markerOf(String model) {
      switch ( model ) {
        case "narrow": return "label";
        case "wide":   return "token";
        default:       return "userName";
      }
    }
  `,

  methods: [
    {
      name: 'setup',
      args: 'X x, BenchmarkResult br',
      javaCode: `
        lineNames_  = split(getLines());
        shapeNames_ = split(getShapes());
        modelNames_ = split(getModels());
        String[] merges = split(getMerges());
        oldMerge_ = new boolean[merges.length];
        for ( int i = 0 ; i < merges.length ; i++ ) oldMerge_[i] = "old".equals(merges[i]);
        try {
          dir_     = Files.createTempDirectory("f3-replay-pipeline-").toFile();
          storage_ = new FileSystemStorage(dir_.getAbsolutePath());
          for ( String model : modelNames_ ) {
            for ( String shape : shapeNames_ ) {
              String name = model + "_" + shape;
              writeJournal(name, model, getEntryCount(), uniqueIds(shape, getEntryCount()));
              System.out.println(String.format("wrote %-16s %7.1f MB", name, storage_.get(name).length() / 1048576.0));
            }
          }
        } catch (java.io.IOException e) {
          throw new RuntimeException(e);
        }
        System.out.println(String.format("F3ReplayPipelineBenchmark: %d entries, %d cells, %d cores, max heap %d MB",
          getEntryCount(), cells(), Runtime.getRuntime().availableProcessors(), Runtime.getRuntime().maxMemory() / 1048576));
      `
    },
    {
      name: 'writeJournal',
      args: 'String name, String model, int entries, int uniqueIds',
      javaThrows: [ 'java.io.IOException' ],
      javaCode: `
        String[] first = { "Ada", "Grace", "Linus", "Barbara", "Dennis", "Margaret", "Ken", "Frances" };
        String[] last  = { "Lovelace", "Hopper", "Torvalds", "Liskov", "Ritchie", "Hamilton", "Thompson", "Allen" };
        String[] title = { "Engineer", "Analyst", "Manager", "Director", "Associate", "Consultant" };
        String cls = classOf(model).getId();
        long now = System.currentTimeMillis();
        try ( BufferedWriter w = new BufferedWriter(new OutputStreamWriter(storage_.getOutputStream(name)), 4 * 1024 * 1024) ) {
          StringBuilder sb = new StringBuilder(1024);
          for ( int i = 1 ; i <= entries ; i++ ) {
            int     id   = ((i - 1) % uniqueIds) + 1;
            boolean full = i <= uniqueIds;   // first appearance: a full row; later: a delta
            sb.setLength(0);
            sb.append("p({class:\\"").append(cls).append("\\",id:").append(id);
            switch ( model ) {
              case "narrow":
                if ( full ) {
                  sb.append(",label:\\"user").append(id).append("\\"");
                  sb.append(",code:\\"").append(title[i % title.length]).append("\\"");
                }
                sb.append(",amount:").append(100.0 + i % 9000);
                sb.append(",at:").append(now - i * 500L);
                break;
              case "wide":
                if ( full ) {
                  sb.append(",token:\\"user").append(id).append("\\"");
                  for ( int k = 1 ; k <= 20 ; k++ ) sb.append(",s").append(k).append(":\\"").append(k <= 10 ? first[(i + k) % first.length] : Integer.toString(100000 + (i * k) % 900000)).append("\\"");
                  for ( int k = 1 ; k <= 10 ; k++ ) sb.append(",d").append(k).append(":").append((i % 9000) * 0.1 * k);
                  for ( int k = 1 ; k <= 6 ; k++ )  sb.append(",l").append(k).append(":").append(1000L * k + i);
                  sb.append(",t1:").append(now - i * 1000L).append(",t2:").append(now - i * 2000L);
                  sb.append(",t3:").append(now - i * 86400000L).append(",t4:").append(now + 86400000L);
                  sb.append(",b1:").append(i % 2 == 0).append(",b2:").append(i % 3 == 0);
                  sb.append(",i1:").append(i % 10).append(",i2:").append(i % 100);
                  sb.append(",state:").append(i % 4);
                  sb.append(",owner:").append(1000 + i % 50);
                  sb.append(",tags:[\\"tag").append(i % 5).append("\\",\\"tag").append(i % 3).append("\\"]");
                } else {
                  sb.append(",s3:\\"").append(title[(i + 1) % title.length]).append("\\"");
                  sb.append(",d1:").append((i % 9000) * 0.2);
                  sb.append(",state:").append((i + 1) % 4);
                }
                break;
              default:
                if ( full ) {
                  sb.append(",userName:\\"user").append(id).append("\\"");
                  sb.append(",firstName:\\"").append(first[i % first.length]).append("\\"");
                  sb.append(",middleName:\\"").append(first[(i / 8) % first.length]).append("\\"");
                  sb.append(",lastName:\\"").append(last[(i / 3) % last.length]).append("\\"");
                  sb.append(",email:\\"user").append(id).append("@example.com\\"");
                  sb.append(",phoneNumber:\\"+1555").append(1000000 + i % 9000000).append("\\"");
                  sb.append(",organization:\\"Organization ").append(i % 50).append("\\"");
                  sb.append(",businessName:\\"Business ").append(i % 500).append(" Ltd\\"");
                  sb.append(",department:\\"Department ").append(i % 20).append("\\"");
                  sb.append(",jobTitle:\\"").append(title[i % title.length]).append("\\"");
                  sb.append(",note:\\"Row ").append(i).append(" of a generated journal; the text pads the entry toward the width of a processor record.\\"");
                  sb.append(",enabled:").append(i % 7 != 0);
                  sb.append(",created:").append(now - i * 1000L);
                } else {
                  sb.append(",jobTitle:\\"").append(title[(i + 1) % title.length]).append("\\"");
                  sb.append(",enabled:").append(i % 5 != 0);
                }
                sb.append(",lastModified:").append(now - i * 500L);
            }
            sb.append("})");
            w.write(sb.toString());
            w.newLine();
          }
        }
      `
    },
    {
      name: 'execute',
      args: 'X x',
      javaCode: `
        Integer execution = (Integer) x.get(BenchmarkRunner.EXECUTION);
        int round = execution == null ? 0 : execution;
        X fsX = x.put(FileSystemStorage.class, storage_).put(Storage.class, storage_);
        int cells = cells();
        long[] wall   = new long[cells];
        long[] cpu    = new long[cells];
        long[] reader = new long[cells];
        com.sun.management.OperatingSystemMXBean os = (com.sun.management.OperatingSystemMXBean) ManagementFactory.getOperatingSystemMXBean();
        ThreadMXBean threads = ManagementFactory.getThreadMXBean();

        System.out.println();
        System.out.println(String.format("--- round %d ---", round + 1));
        System.out.println(String.format("%-11s %-5s %-8s %-6s %8s %8s %6s %8s", "line", "merge", "shape", "model", "wall ms", "cpu ms", "cpu/w", "reader"));
        for ( int i = 0 ; i < cells ; i++ ) {
          int cell = (i + round * 7) % cells;
          boolean   parseOnly = "parseOnly".equals(lineOf(cell));
          ClassInfo of        = classOf(modelOf(cell));
          DAO dao;
          if ( parseOnly ) {
            NullDAO n = new NullDAO();
            n.setOf(of);
            dao = n;
          } else {
            dao = new BulkLoadDAO(getX(), of);
          }
          F3FileJournal journal = new VariantF3FileJournal(parseOnly ? "simple" : lineOf(cell), oldOf(cell));
          journal.setX(fsX);
          journal.setFilename(fileOf(cell));

          System.gc();
          long c0 = os.getProcessCpuTime();
          long r0 = threads.getCurrentThreadCpuTime();
          long t0 = System.nanoTime();
          journal.replay(fsX, dao);
          wall[cell]   = System.nanoTime() - t0;
          reader[cell] = threads.getCurrentThreadCpuTime() - r0;
          cpu[cell]    = os.getProcessCpuTime() - c0;

          if ( journal.getPassCount() != getEntryCount() || journal.getFailCount() != 0 )
            throw new RuntimeException(label(cell) + ": passed " + journal.getPassCount() + " failed " + journal.getFailCount());
          if ( ! parseOnly ) {
            int expectRows = uniqueIds(shapeOf(cell), getEntryCount());
            int rows = ((BulkLoadDAO) dao).rows().length;
            if ( rows != expectRows ) throw new RuntimeException(label(cell) + ": " + rows + " rows, expected " + expectRows);
            // A merged row must still carry the first entry's values.
            FObject row = dao.find(1L);
            if ( row == null || ! "user1".equals(row.getProperty(markerOf(modelOf(cell)))) )
              throw new RuntimeException(label(cell) + ": row 1 lost its first entry");
          }
          System.out.println(String.format("%s %8.0f %8.0f %6.1f %8.0f", label(cell), wall[cell] / 1e6, cpu[cell] / 1e6, (double) cpu[cell] / wall[cell], reader[cell] / 1e6));
        }
        wall_.add(wall);
        cpu_.add(cpu);
        reader_.add(reader);
        printSummary();
      `
    },
    {
      name: 'printSummary',
      javaCode: `
        int cells = cells();
        System.out.println();
        System.out.println(String.format("=== %d rounds, %d entries; wall: min, median, delta vs simple/old of the same shape and model; cpu: min, median, delta; cpu/wall; reader cpu ===", wall_.size(), getEntryCount()));
        System.out.println(String.format("%-11s %-5s %-8s %-6s | %7s %7s %7s | %7s %7s %7s | %5s %7s", "line", "merge", "shape", "model", "w min", "w med", "delta", "cpu min", "cpu med", "delta", "cpu/w", "reader"));
        for ( int cell = 0 ; cell < cells ; cell++ ) {
          int base = -1;
          for ( int b = 0 ; b < cells ; b++ )
            if ( "simple".equals(lineOf(b)) && oldOf(b) && shapeOf(b).equals(shapeOf(cell)) && modelOf(b).equals(modelOf(cell)) ) base = b;
          double wMin = sorted(wall_, cell)[0] / 1e6, wMed = median(wall_, cell) / 1e6;
          double cMin = sorted(cpu_, cell)[0] / 1e6,  cMed = median(cpu_, cell) / 1e6;
          double wBase = base < 0 ? 0 : sorted(wall_, base)[0] / 1e6;
          double cBase = base < 0 ? 0 : sorted(cpu_, base)[0] / 1e6;
          System.out.println(String.format("%s | %7.0f %7.0f %+6.1f%% | %7.0f %7.0f %+6.1f%% | %5.1f %7.0f", label(cell),
            wMin, wMed, wBase == 0 ? 0 : 100 * (wMin - wBase) / wBase,
            cMin, cMed, cBase == 0 ? 0 : 100 * (cMin - cBase) / cBase,
            cMed / wMed, median(reader_, cell) / 1e6));
        }
      `
    },
    {
      name: 'teardown',
      args: 'X x, BenchmarkResult br',
      javaCode: `
        for ( String model : modelNames_ )
          for ( String shape : shapeNames_ ) storage_.get(model + "_" + shape).delete();
        dir_.delete();
      `
    }
  ]
});
