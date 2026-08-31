/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.test',
  name: 'JournalReplayBenchmark',
  extends: 'foam.core.test.Test',
  flags: ['java'],

  documentation: `
    Re-baseline of journal replay on the current tree. Writes a real .jrl
    file, then replays it four ways and prints a comparison table:
      - FOAM parser, single thread (parse + MDAO put, the parser cost)
      - Jackson, single thread (reference ceiling only, not a replay path)
      - Jackson + SimpleAsyncAssemblyLine (the ceiling on the same multi-core
        pipeline the production path uses)
      - FOAM + SimpleAsyncAssemblyLine (parallel parse, serial put)
      - F3FileJournal.replay (the production pipeline exactly as booted)

    Run: ./build.sh -W9090 --flags:test server-tests:JournalReplayBenchmark
    Options:
      -Dbenchmark.entries=1000000  (default 1000000)
  `,

  javaImports: [
    'foam.lang.ClassInfo',
    'foam.lang.FObject',
    'foam.lang.PropertyInfo',
    'foam.lang.AbstractEnumPropertyInfo',
    'foam.lang.AbstractFObjectPropertyInfo',
    'foam.lang.AbstractFObjectArrayPropertyInfo',
    'foam.lang.AbstractArrayPropertyInfo',
    'foam.lang.AbstractMapPropertyInfo',
    'foam.lang.AbstractObjectPropertyInfo',
    'foam.lang.AbstractClassPropertyInfo',
    'foam.lang.AbstractListPropertyInfo',
    'foam.dao.MDAO',
    'foam.dao.JacksonJournalParser',
    'foam.lib.json.JSONParser',
    'foam.lib.json.StringParser',
    'foam.util.concurrent.AbstractAssembly',
    'foam.util.concurrent.AssemblyLine',
    'foam.util.concurrent.SimpleAsyncAssemblyLine',
    'java.io.BufferedReader',
    'java.io.BufferedWriter',
    'java.io.File',
    'java.io.FileReader',
    'java.io.FileWriter',
    'java.util.ArrayList',
    'java.util.HashMap',
    'java.util.Iterator',
    'java.util.List',
    'java.util.Map',
    'java.util.concurrent.atomic.AtomicInteger',
    'java.util.concurrent.atomic.AtomicLong',
    'foam.dao.F3FileJournal',
    'foam.core.fs.FileSystemStorage',
    'foam.core.fs.Storage'
  ],

  javaCode: `
    private static final int NUM_ENTRIES = Integer.getInteger("benchmark.entries", 1000000);

    private final List<Object[]> rows_ = new ArrayList<>();
    // Pins the variant's MDAO across the retained-heap measurement.
    private Object retain_;
    private double baselineWallSec_;
    private String jrlName_;
    private FileSystemStorage storage_;

    /** Force collection, then report used heap in MB. */
    private static double usedHeapMB() {
      Runtime rt = Runtime.getRuntime();
      for ( int i = 0 ; i < 3 ; i++ ) {
        System.gc();
        try { Thread.sleep(150); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
      }
      return (rt.totalMemory() - rt.freeMemory()) / 1e6;
    }

    private void record(String label, double wallSec, double retainedMB, long peakMB) {
      rows_.add(new Object[] { label, wallSec, retainedMB, peakMB });
    }

    /** Counts String references, identity-distinct instances, and value-distinct strings reachable from the loaded rows. */
    private void stringGraphStats(String label, MDAO mdao, ClassInfo ci) {
      try {
        java.util.IdentityHashMap<String, Boolean> instances = new java.util.IdentityHashMap<>();
        java.util.HashSet<String> values = new java.util.HashSet<>();
        long refs = 0;
        List props = ci.getAxiomsByClass(PropertyInfo.class);
        foam.dao.ArraySink sink = (foam.dao.ArraySink) mdao.select(new foam.dao.ArraySink());
        for ( Object o : sink.getArray() ) {
          FObject fo = (FObject) o;
          for ( Object pobj : props ) {
            PropertyInfo pi = (PropertyInfo) pobj;
            Object v = pi.get(fo);
            if ( v instanceof String ) { refs++; instances.put((String) v, Boolean.TRUE); values.add((String) v); }
            else if ( v instanceof String[] ) {
              for ( String e : (String[]) v ) { refs++; instances.put(e, Boolean.TRUE); values.add(e); }
            }
          }
        }
        long instBytes = 0;
        for ( String k : instances.keySet() ) instBytes += 44 + k.length();
        log(String.format("STRGRAPH %-46s refs=%d instances=%d distinctValues=%d approxInstanceMB=%d",
          label, refs, instances.size(), values.size(), instBytes / 1_000_000));
      } catch (Throwable t) {
        log("STRGRAPH failed: " + t);
      }
    }

    private static String dedupLabel(int mode) {
      switch ( mode ) {
        case 5:  return ", weak interner";
        case 6:  return ", weak + second-sight";
        case 0:  return ", no dedup";
        case 2:  return ", StringInterner";
        case 3:  return ", StringInterner 2-way";
        case 4:  return ", StringInterner shared";
        default: return "";
      }
    }

    /** Samples used heap every 100 ms so each variant reports its PEAK, not just what survives GC. */
    static class HeapSampler extends Thread {
      final java.util.List<long[]> samples = new java.util.ArrayList<>();
      volatile boolean stop_;
      final long t0 = System.nanoTime();
      HeapSampler() { setDaemon(true); }
      public void run() {
        Runtime rt = Runtime.getRuntime();
        while ( ! stop_ ) {
          samples.add(new long[] { (System.nanoTime() - t0) / 1_000_000, (rt.totalMemory() - rt.freeMemory()) / 1_000_000, rssMB() });
          try { Thread.sleep(200); } catch (InterruptedException e) { return; }
        }
      }

      /** Resident set size of this JVM in MB, via ps (macOS/Linux). */
      static long rssMB() {
        try {
          Process p = new ProcessBuilder("ps", "-o", "rss=", "-p", String.valueOf(ProcessHandle.current().pid())).start();
          try ( java.io.BufferedReader r = new java.io.BufferedReader(new java.io.InputStreamReader(p.getInputStream())) ) {
            String line = r.readLine();
            return line == null ? -1 : Long.parseLong(line.trim()) / 1024;
          }
        } catch (Exception e) { return -1; }
      }
      long stopAndGetPeakMB() {
        stop_ = true;
        try { join(); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
        long m = 0;
        for ( long[] smp : samples ) m = Math.max(m, smp[1]);
        return m;
      }
    }
  `,

  methods: [
    {
      name: 'runTest',
      javaThrows: ['Exception'],
      javaCode: `
        ClassInfo ci = BenchmarkModel.getOwnClassInfo();

        checkModelSafety(x, ci);

        String jrlPath = writeJournalFile(x, NUM_ENTRIES);

        try {
          warmupParsers(x, ci, jrlPath);

          // -Dbenchmark.mode=N runs a single dedup mode in its own JVM so
          // process-level RSS is attributable — production variant only, so a
          // tight -Xmx measures the replay, not the rest of the suite.
          int only = Integer.getInteger("benchmark.mode", -1);
          if ( only >= 0 ) {
            replayWithF3FileJournal(x, ci, only);
          } else {
            replayWithJackson(x, ci, jrlPath);
            replayJacksonAsyncLine(x, ci, jrlPath);
            for ( int mode : new int[] { 1, 5, 6 } ) {
              replayWithFoam(x, ci, jrlPath, mode);
              replayWithSimpleAsyncLine(x, ci, jrlPath, mode);
              replayWithF3FileJournal(x, ci, mode);
            }
          }

          printSummary();
        } finally {
          File f = new File(jrlPath);
          f.delete();
          f.getParentFile().delete();
        }
      `
    },
    {
      name: 'checkModelSafety',
      args: 'Context x, ClassInfo ci',
      javaCode: `
        log("=== Property Type Coverage ===");
        List props = ci.getAxiomsByClass(PropertyInfo.class);
        Iterator iter = props.iterator();
        java.util.TreeMap<String, Integer> typeCounts = new java.util.TreeMap<>();
        while ( iter.hasNext() ) {
          PropertyInfo pi = (PropertyInfo) iter.next();
          Class c = pi.getClass();
          String typeName = c.getSimpleName();
          while ( c != null ) {
            if ( c.getSimpleName().startsWith("Abstract") && c.getSimpleName().endsWith("PropertyInfo") ) {
              typeName = c.getSimpleName().replace("Abstract","").replace("PropertyInfo","");
              break;
            }
            c = c.getSuperclass();
          }
          typeCounts.merge(typeName, 1, Integer::sum);
        }
        log("  BenchmarkModel properties (" + props.size() + " total):");
        for ( Map.Entry<String, Integer> e : typeCounts.entrySet() ) {
          log("    " + e.getKey() + ": " + e.getValue());
        }
        log("");
      `
    },
    {
      name: 'writeJournalFile',
      type: 'String',
      args: 'Context x, int count',
      javaThrows: ['Exception'],
      javaCode: `
        File dir = java.nio.file.Files.createTempDirectory("replay-bench-").toFile();
        storage_ = new FileSystemStorage(dir.getAbsolutePath());
        FileSystemStorage storage = storage_;
        jrlName_ = "benchmark_replay_" + count;
        String path = storage.get(jrlName_).getAbsolutePath();
        // getOutputStream opens CREATE+APPEND; drop any leftover from an aborted run
        new File(path).delete();
        log("Writing " + count + " entries to " + path + " ...");
        long now = System.currentTimeMillis();
        String[] uuids = new String[1000];
        for ( int u = 0 ; u < uuids.length ; u++ ) uuids[u] = java.util.UUID.randomUUID().toString();

        long bytes = 0;
        try ( BufferedWriter w = new BufferedWriter(new java.io.OutputStreamWriter(storage.getOutputStream(jrlName_)), 4 * 1024 * 1024) ) {
          w.write("v({\\"version\\":\\"\\"})");
          w.newLine();
          // Add some comments like a real journal
          w.write("// Generated benchmark journal");
          w.newLine();

          for ( int i = 0 ; i < count ; i++ ) {
            StringBuilder sb = new StringBuilder(750);
            sb.append("c({seq:").append(i);
            sb.append(",p1:\\"group").append(i % 20).append("\\"");
            sb.append(",t1:").append(now - i * 1000L);
            sb.append(",t2:").append(now - i * 86400000L);
            sb.append(",t3:").append(now + 86400000L);
            sb.append(",p2:\\"").append(i % 2 == 0 ? "NET_A" : "NET_B").append("\\"");
            sb.append(",p3:\\"1000").append(i % 10000).append("\\"");
            sb.append(",n1:0.0,n2:0.0");
            sb.append(",createdAt:").append(now - i * 500L);
            sb.append(",token:\\"").append(uuids[i % uuids.length]).append("\\"");
            sb.append(",amountStr:\\"").append(100 + i % 9000).append(".").append(i % 100).append("\\"");
            sb.append(",amount:").append(100.0 + i % 9000);
            sb.append(",p4:\\"999\\"");
            sb.append(",n3:").append(1000.0 + i % 50000);
            sb.append(",p5:\\"999\\"");
            sb.append(",p6:\\"P\\"");
            sb.append(",fee:").append((i % 500) * 0.1);
            sb.append(",p7:\\"{}\\"");
            sb.append(",statusCode:\\"0000\\"");
            sb.append(",accountRef:\\"").append(100000 + i).append(".0\\"");
            sb.append(",entityRef:\\"").append(200000 + i).append(".0\\"");
            sb.append(",acquirerRef:\\"100001\\"");
            sb.append(",merchantId:\\"100001000000001\\"");
            sb.append(",categoryCode:\\"5999\\"");
            sb.append(",merchantName:\\"Test Merchant ").append(i % 100).append("\\"");
            sb.append(",city:\\"SampleCity\\"");
            sb.append(",country:\\"XYZ\\"");
            sb.append(",terminalId:\\"10000001\\"");
            sb.append(",traceNum:\\"").append(100000 + i).append("      \\"");
            sb.append(",retrievalRef:\\"100000").append(100000 + i).append("\\"");
            sb.append(",p8:\\"").append(500000 + i % 100000).append("\\"");
            sb.append(",p9:\\"100000000000001\\"");
            sb.append(",p10:\\"0000\\"");
            sb.append(",reverseRef:\\"").append(i + 1).append(".0\\"");
            sb.append(",n4:").append(i % 3);
            sb.append(",typeCode:\\"1.0.1\\"");
            sb.append(",rbs:\\"1000.0000,999.9900\\"");
            sb.append(",environment:\\"TERMINAL\\"");
            sb.append(",p15:\\"00\\"");
            sb.append(",maskedNum:\\"400000______0001\\"");
            sb.append(",cardRef:\\"").append(300000 + i).append(".0\\"");
            sb.append(",p14:\\"").append(i + 2).append(".0\\"");
            sb.append(",baseValue:").append(1000.0 + i % 50000);
            sb.append(",p11:\\"999\\"");
            sb.append(",p12:\\"1\\"");
            sb.append(",p13:\\"N\\"");
            sb.append(",refSeq:0");
            sb.append(",reconValue:").append(1000.0 + i % 50000);
            sb.append(",holdValue:").append((i % 100) * 0.01);
            sb.append(",sourceId:1752");
            sb.append(",filePath:\\"data/2025/10/01/sample.zip\\"");
            // Complex types: Enum (ordinal), Reference (long id), Boolean, Int, StringArray
            sb.append(",active:true");
            sb.append(",priority:").append(i % 10);
            sb.append(",lifecycleState:").append(i % 4);
            sb.append(",createdBy:").append(1000 + i % 50);
            sb.append(",tags:[\\"tag").append(i % 5).append("\\",\\"tag").append(i % 3).append("\\"]");
            sb.append("})");
            String line = sb.toString();
            w.write(line);
            w.newLine();
            bytes += line.length();
          }
        } catch (Exception e) {
          throw new RuntimeException("Failed to write journal", e);
        }
        log("Written " + (bytes / 1_000_000) + " MB, " + count + " entries");
        return path;
      `
    },
    {
      name: 'warmupParsers',
      javaThrows: ['Exception'],
      args: 'Context x, ClassInfo ci, String jrlPath',
      javaCode: `
        log("Warming up parsers with 10K entries...");
        StringParser.DEDUP = 0;
        JSONParser foamParser = new JSONParser();
        foamParser.setX(x);
        Class cls = ci.getObjClass();
        JacksonJournalParser jacksonParser = new JacksonJournalParser();
        jacksonParser.setTargetClassInfo(ci);
        int warmed = 0;

        try ( BufferedReader reader = new BufferedReader(new FileReader(jrlPath), 2 * 1024 * 1024) ) {
          String line;
          while ( (line = reader.readLine()) != null && warmed < 10000 ) {
            if ( line.length() < 3 ) continue;
            char op = line.charAt(0);
            if ( op != 'c' && op != 'p' && op != 'r' ) continue;
            String body = line.substring(2, line.length() - 1);
            foamParser.parseString(body, cls);
            jacksonParser.parseString(body);
            warmed++;
          }
        }
        log("Warmup done (" + warmed + " entries).");
        StringParser.DEDUP = 1;
      `
    },
    {
      name: 'replayWithFoam',
      args: 'Context x, ClassInfo ci, String jrlPath, int dedup',
      javaCode: `
        String label = "FOAM parser, single thread" + dedupLabel(dedup);
        foam.util.StringInterner.reset();
        StringParser.DEDUP = dedup;
        double heapBefore = usedHeapMB();
        HeapSampler sampler_ = new HeapSampler();
        sampler_.start();
        JSONParser parser = new JSONParser();
        parser.setX(x);
        Class cls = ci.getObjClass();
        MDAO mdao = new MDAO(ci);
        mdao.setSafeMode(false);

        long readNanos = 0, parseNanos = 0, putNanos = 0;
        int count = 0, comments = 0;
        long totalBytes = 0;

        long wallStart = System.nanoTime();
        try ( BufferedReader reader = new BufferedReader(new FileReader(jrlPath), 2 * 1024 * 1024) ) {
          for ( ; ; ) {
            long t0 = System.nanoTime();
            String line = reader.readLine();
            readNanos += System.nanoTime() - t0;
            if ( line == null ) break;

            int len = line.length();
            if ( len == 0 ) continue;
            if ( line.charAt(0) == '/' ) { comments++; continue; }
            if ( len < 3 ) continue;
            char op = line.charAt(0);
            if ( op == 'v' ) continue; // version line
            if ( op != 'c' && op != 'p' && op != 'r' ) continue;

            String body = line.substring(2, len - 1);
            totalBytes += body.length();

            long p0 = System.nanoTime();
            FObject obj = parser.parseString(body, cls);
            parseNanos += System.nanoTime() - p0;

            if ( obj != null ) {
              long w0 = System.nanoTime();
              mdao.put_(x, obj);
              putNanos += System.nanoTime() - w0;
              count++;
            }
          }
        } catch (Exception e) {
          throw new RuntimeException("FOAM replay failed", e);
        }
        long wallNanos = System.nanoTime() - wallStart;

        double wallSec     = wallNanos / 1e9;
        double readSec     = readNanos / 1e9;
        double parseSec    = parseNanos / 1e9;
        double putSec      = putNanos / 1e9;
        double unacctSec   = wallSec - readSec - parseSec - putSec;
        double mbSec       = (totalBytes / 1e6) / wallSec;

        log("");
        log("=== End-to-End: " + label + " (" + count + " entries, " + (totalBytes/1_000_000) + " MB) ===");
        log(String.format("  Wall time:  %6.2f sec", wallSec));
        log(String.format("  Read:       %6.2f sec  (%4.1f%%)", readSec,  100*readSec/wallSec));
        log(String.format("  Parse:      %6.2f sec  (%4.1f%%)", parseSec, 100*parseSec/wallSec));
        log(String.format("  MDAO put:   %6.2f sec  (%4.1f%%)", putSec,   100*putSec/wallSec));
        log(String.format("  Overhead:   %6.2f sec  (%4.1f%%)", unacctSec, 100*unacctSec/wallSec));
        log(String.format("  Throughput: %.0f entries/sec, %.1f MB/sec", count/wallSec, mbSec));
        log("  Comments skipped: " + comments);
        stringGraphStats(label, mdao, ci);
        long peakMB = sampler_.stopAndGetPeakMB();
        for ( long[] smp : sampler_.samples ) log("HEAPTS," + label + "," + smp[0] + "," + smp[1]);
        long rssNow = HeapSampler.rssMB();
        long rssPeak = 0;
        for ( long[] smp : sampler_.samples ) if ( smp.length > 2 ) rssPeak = Math.max(rssPeak, smp[2]);
        log(String.format("  Peak heap:  %6d MB during run; RSS %d MB peak, %d MB after GC", peakMB, rssPeak, rssNow));
        retain_ = mdao;
        double heapAfter  = usedHeapMB();
        double retainedMB = heapAfter - heapBefore;
        retain_ = null;
        log(String.format("  Heap:       %6.0f MB before, %6.0f MB after (used, post-GC)", heapBefore, heapAfter));
        log(String.format("  Retained:   %6.0f MB (MDAO + parsed values)", retainedMB));
        StringParser.DEDUP = 1;

        if ( dedup == 1 ) baselineWallSec_ = wallSec;
        record(label, wallSec, retainedMB, peakMB);
        test(count == NUM_ENTRIES, "FOAM replay should process all " + NUM_ENTRIES + " entries (got " + count + ")");
      `
    },
    {
      name: 'replayWithJackson',
      javaThrows: ['Exception'],
      args: 'Context x, ClassInfo ci, String jrlPath',
      javaCode: `
        double heapBefore = usedHeapMB();
        HeapSampler sampler_ = new HeapSampler();
        sampler_.start();
        String label = "Jackson, single thread (ceiling)";
        JacksonJournalParser jacksonParser = new JacksonJournalParser();
        jacksonParser.setTargetClassInfo(ci);
        MDAO mdao = new MDAO(ci);
        mdao.setSafeMode(false);

        long readNanos = 0, parseNanos = 0, putNanos = 0;
        int count = 0, comments = 0;
        long totalBytes = 0;

        long wallStart = System.nanoTime();
        try ( BufferedReader reader = new BufferedReader(new FileReader(jrlPath), 2 * 1024 * 1024) ) {
          for ( ; ; ) {
            long t0 = System.nanoTime();
            String line = reader.readLine();
            readNanos += System.nanoTime() - t0;
            if ( line == null ) break;

            int len = line.length();
            if ( len == 0 ) continue;
            if ( line.charAt(0) == '/' ) { comments++; continue; }
            if ( len < 3 ) continue;
            char op = line.charAt(0);
            if ( op == 'v' ) continue;
            if ( op != 'c' && op != 'p' && op != 'r' ) continue;

            String body = line.substring(2, len - 1);
            totalBytes += body.length();

            long p0 = System.nanoTime();
            FObject obj = jacksonParser.parseString(body);
            parseNanos += System.nanoTime() - p0;

            if ( obj != null ) {
              long w0 = System.nanoTime();
              mdao.put_(x, obj);
              putNanos += System.nanoTime() - w0;
              count++;
            }
          }
        }
        long wallNanos = System.nanoTime() - wallStart;

        double wallSec     = wallNanos / 1e9;
        double readSec     = readNanos / 1e9;
        double parseSec    = parseNanos / 1e9;
        double putSec      = putNanos / 1e9;
        double unacctSec   = wallSec - readSec - parseSec - putSec;
        double mbSec       = (totalBytes / 1e6) / wallSec;

        log("");
        log("=== End-to-End: Jackson [CEILING] (" + count + " entries, " + (totalBytes/1_000_000) + " MB) ===");
        log(String.format("  Wall time:  %6.2f sec", wallSec));
        log(String.format("  Read:       %6.2f sec  (%4.1f%%)", readSec,  100*readSec/wallSec));
        log(String.format("  Parse:      %6.2f sec  (%4.1f%%)", parseSec, 100*parseSec/wallSec));
        log(String.format("  MDAO put:   %6.2f sec  (%4.1f%%)", putSec,   100*putSec/wallSec));
        log(String.format("  Overhead:   %6.2f sec  (%4.1f%%)", unacctSec, 100*unacctSec/wallSec));
        log(String.format("  Throughput: %.0f entries/sec, %.1f MB/sec", count/wallSec, mbSec));
        log("  Comments skipped: " + comments);
        stringGraphStats(label, mdao, ci);
        long peakMB = sampler_.stopAndGetPeakMB();
        for ( long[] smp : sampler_.samples ) log("HEAPTS," + label + "," + smp[0] + "," + smp[1]);
        long rssNow = HeapSampler.rssMB();
        long rssPeak = 0;
        for ( long[] smp : sampler_.samples ) if ( smp.length > 2 ) rssPeak = Math.max(rssPeak, smp[2]);
        log(String.format("  Peak heap:  %6d MB during run; RSS %d MB peak, %d MB after GC", peakMB, rssPeak, rssNow));
        retain_ = mdao;
        double heapAfter  = usedHeapMB();
        double retainedMB = heapAfter - heapBefore;
        retain_ = null;
        log(String.format("  Heap:       %6.0f MB before, %6.0f MB after (used, post-GC)", heapBefore, heapAfter));
        log(String.format("  Retained:   %6.0f MB (MDAO + parsed values, Jackson never interns)", retainedMB));

        record(label, wallSec, retainedMB, peakMB);
        test(count == NUM_ENTRIES, "Jackson replay should process all " + NUM_ENTRIES + " entries (got " + count + ")");
      `
    },
    {
      name: 'replayWithSimpleAsyncLine',
      javaThrows: ['Exception'],
      args: 'Context x, ClassInfo ci, String jrlPath, int dedup',
      documentation: `
        Same pattern as SyncAssemblyLine benchmark, but uses SimpleAsyncAssemblyLine.
        executeJob runs in parallel on a worker pool, endJob runs serially on a
        dedicated end thread. Each pool thread gets its own JSONParser because
        JSONParser is not thread-safe.
      `,
      javaCode: `
        String label = "FOAM + SimpleAsyncAssemblyLine" + dedupLabel(dedup);
        foam.util.StringInterner.reset();
        StringParser.DEDUP = dedup;
        double heapBefore = usedHeapMB();
        HeapSampler sampler_ = new HeapSampler();
        sampler_.start();
        final Class cls = ci.getObjClass();
        final MDAO mdao = new MDAO(ci);
        mdao.setSafeMode(false);
        final AssemblyLine line = new SimpleAsyncAssemblyLine(x, "bench");

        // Per-thread parser because JSONParser isn't thread-safe.
        final ThreadLocal<JSONParser> tlParser = ThreadLocal.withInitial(() -> {
          JSONParser p = new JSONParser();
          p.setX(x);
          return p;
        });

        // Concurrent accumulators: parse runs on many threads, endJob on one.
        final AtomicLong parseNanos = new AtomicLong();
        final AtomicLong putNanos   = new AtomicLong();
        final AtomicInteger count   = new AtomicInteger();
        long readNanos = 0;
        int comments = 0;
        long totalBytes = 0;

        long wallStart = System.nanoTime();
        try ( BufferedReader reader = new BufferedReader(new FileReader(jrlPath), 2 * 1024 * 1024) ) {
          for ( ; ; ) {
            long t0 = System.nanoTime();
            String line1 = reader.readLine();
            readNanos += System.nanoTime() - t0;
            if ( line1 == null ) break;

            int len = line1.length();
            if ( len == 0 ) continue;
            if ( line1.charAt(0) == '/' ) { comments++; continue; }
            if ( len < 3 ) continue;
            char op = line1.charAt(0);
            if ( op == 'v' ) continue;
            if ( op != 'c' && op != 'p' && op != 'r' ) continue;

            final String body = line1.substring(2, len - 1);
            totalBytes += body.length();

            line.enqueue(new AbstractAssembly() {
              FObject obj;
              public void executeJob() {
                long p0 = System.nanoTime();
                obj = tlParser.get().parseString(body, cls);
                parseNanos.addAndGet(System.nanoTime() - p0);
              }
              public void endJob(boolean isLast) {
                if ( obj == null ) return;
                long w0 = System.nanoTime();
                mdao.put_(x, obj);
                putNanos.addAndGet(System.nanoTime() - w0);
                count.incrementAndGet();
              }
            });
          }
        } catch (Exception e) {
          throw new RuntimeException("SimpleAsyncAssemblyLine replay failed", e);
        } finally {
          // shutdown blocks until every enqueued job has been drained through endJob
          line.shutdown();
        }
        long wallNanos = System.nanoTime() - wallStart;

        double wallSec   = wallNanos / 1e9;
        double readSec   = readNanos / 1e9;
        double parseSec  = parseNanos.get() / 1e9;  // sum across worker threads, can exceed wall
        double putSec    = putNanos.get() / 1e9;
        double mbSec     = (totalBytes / 1e6) / wallSec;
        int processed    = count.get();
        int threads      = Runtime.getRuntime().availableProcessors();

        log("");
        log("=== End-to-End: " + label + " (" + processed + " entries, " + (totalBytes/1_000_000) + " MB, " + (threads - 1) + " parse threads) ===");
        log(String.format("  Wall time:        %6.2f sec", wallSec));
        log(String.format("  Read:             %6.2f sec  (%4.1f%%)", readSec,  100*readSec/wallSec));
        log(String.format("  Parse (CPU sum):  %6.2f sec  (%4.1fx wall — parallelism)", parseSec, parseSec/wallSec));
        log(String.format("  MDAO put (serial):%6.2f sec  (%4.1f%%)", putSec, 100*putSec/wallSec));
        log(String.format("  Throughput:       %.0f entries/sec, %.1f MB/sec", processed/wallSec, mbSec));
        log("  Comments skipped: " + comments);
        stringGraphStats(label, mdao, ci);
        long peakMB = sampler_.stopAndGetPeakMB();
        for ( long[] smp : sampler_.samples ) log("HEAPTS," + label + "," + smp[0] + "," + smp[1]);
        long rssNow = HeapSampler.rssMB();
        long rssPeak = 0;
        for ( long[] smp : sampler_.samples ) if ( smp.length > 2 ) rssPeak = Math.max(rssPeak, smp[2]);
        log(String.format("  Peak heap:  %6d MB during run; RSS %d MB peak, %d MB after GC", peakMB, rssPeak, rssNow));
        retain_ = mdao;
        double heapAfter  = usedHeapMB();
        double retainedMB = heapAfter - heapBefore;
        retain_ = null;
        log(String.format("  Heap:       %6.0f MB before, %6.0f MB after (used, post-GC)", heapBefore, heapAfter));
        log(String.format("  Retained:         %6.0f MB (MDAO + parsed values)", retainedMB));
        StringParser.DEDUP = 1;

        record(label, wallSec, retainedMB, peakMB);
        test(processed == NUM_ENTRIES, "SimpleAsyncAssemblyLine replay should process all " + NUM_ENTRIES + " entries (got " + processed + ")");
      `
    },
    {
      name: 'replayJacksonAsyncLine',
      javaThrows: ['Exception'],
      args: 'Context x, ClassInfo ci, String jrlPath',
      documentation: `
        Jackson on the same pipeline as replayWithSimpleAsyncLine: parse on the
        worker pool, put serially on the end thread. One JacksonJournalParser
        per worker thread because the instance carries the property map.
      `,
      javaCode: `
        String label = "Jackson + SimpleAsyncAssemblyLine (ceiling)";
        double heapBefore = usedHeapMB();
        HeapSampler sampler_ = new HeapSampler();
        sampler_.start();
        final MDAO mdao = new MDAO(ci);
        mdao.setSafeMode(false);
        final AssemblyLine line = new SimpleAsyncAssemblyLine(x, "bench-jackson");

        final ThreadLocal<JacksonJournalParser> tlParser = ThreadLocal.withInitial(() -> {
          JacksonJournalParser p = new JacksonJournalParser();
          p.setTargetClassInfo(ci);
          return p;
        });

        final AtomicLong parseNanos = new AtomicLong();
        final AtomicLong putNanos   = new AtomicLong();
        final AtomicInteger count   = new AtomicInteger();
        long readNanos = 0;
        int comments = 0;
        long totalBytes = 0;

        long wallStart = System.nanoTime();
        try ( BufferedReader reader = new BufferedReader(new FileReader(jrlPath), 2 * 1024 * 1024) ) {
          for ( ; ; ) {
            long t0 = System.nanoTime();
            String line1 = reader.readLine();
            readNanos += System.nanoTime() - t0;
            if ( line1 == null ) break;

            int len = line1.length();
            if ( len == 0 ) continue;
            if ( line1.charAt(0) == '/' ) { comments++; continue; }
            if ( len < 3 ) continue;
            char op = line1.charAt(0);
            if ( op == 'v' ) continue;
            if ( op != 'c' && op != 'p' && op != 'r' ) continue;

            final String body = line1.substring(2, len - 1);
            totalBytes += body.length();

            line.enqueue(new AbstractAssembly() {
              FObject obj;
              public void executeJob() {
                long p0 = System.nanoTime();
                obj = tlParser.get().parseString(body);
                parseNanos.addAndGet(System.nanoTime() - p0);
              }
              public void endJob(boolean isLast) {
                if ( obj == null ) return;
                long w0 = System.nanoTime();
                mdao.put_(x, obj);
                putNanos.addAndGet(System.nanoTime() - w0);
                count.incrementAndGet();
              }
            });
          }
        } finally {
          line.shutdown();
        }
        long wallNanos = System.nanoTime() - wallStart;

        double wallSec   = wallNanos / 1e9;
        double readSec   = readNanos / 1e9;
        double parseSec  = parseNanos.get() / 1e9;
        double putSec    = putNanos.get() / 1e9;
        double mbSec     = (totalBytes / 1e6) / wallSec;
        int processed    = count.get();
        int threads      = Runtime.getRuntime().availableProcessors();

        log("");
        log("=== End-to-End: " + label + " (" + processed + " entries, " + (totalBytes/1_000_000) + " MB, " + (threads - 1) + " parse threads) ===");
        log(String.format("  Wall time:        %6.2f sec", wallSec));
        log(String.format("  Read:             %6.2f sec  (%4.1f%%)", readSec,  100*readSec/wallSec));
        log(String.format("  Parse (CPU sum):  %6.2f sec  (%4.1fx wall — parallelism)", parseSec, parseSec/wallSec));
        log(String.format("  MDAO put (serial):%6.2f sec  (%4.1f%%)", putSec, 100*putSec/wallSec));
        log(String.format("  Throughput:       %.0f entries/sec, %.1f MB/sec", processed/wallSec, mbSec));
        log("  Comments skipped: " + comments);
        stringGraphStats(label, mdao, ci);
        long peakMB = sampler_.stopAndGetPeakMB();
        for ( long[] smp : sampler_.samples ) log("HEAPTS," + label + "," + smp[0] + "," + smp[1]);
        long rssNow = HeapSampler.rssMB();
        long rssPeak = 0;
        for ( long[] smp : sampler_.samples ) if ( smp.length > 2 ) rssPeak = Math.max(rssPeak, smp[2]);
        log(String.format("  Peak heap:  %6d MB during run; RSS %d MB peak, %d MB after GC", peakMB, rssPeak, rssNow));
        retain_ = mdao;
        double heapAfter  = usedHeapMB();
        double retainedMB = heapAfter - heapBefore;
        retain_ = null;
        log(String.format("  Heap:       %6.0f MB before, %6.0f MB after (used, post-GC)", heapBefore, heapAfter));
        log(String.format("  Retained:         %6.0f MB (MDAO + parsed values, Jackson never interns)", retainedMB));

        record(label, wallSec, retainedMB, peakMB);
        test(processed == NUM_ENTRIES, "Jackson async replay should process all " + NUM_ENTRIES + " entries (got " + processed + ")");
      `
    },
    {
      name: 'replayWithF3FileJournal',
      javaThrows: ['Exception'],
      args: 'Context x, ClassInfo ci, int dedup',
      documentation: `
        The production path: F3FileJournal.replay over the same file, so the
        BatchingAssemblyLine + SimpleAsyncAssemblyLine + find/merge/put endJob
        run exactly as at boot. Storage is bound to FileSystemStorage the way
        JDAO does it.
      `,
      javaCode: `
        String label = "F3FileJournal.replay (production path)" + dedupLabel(dedup);
        foam.util.StringInterner.reset();
        StringParser.DEDUP = dedup;
        double heapBefore = usedHeapMB();
        HeapSampler sampler_ = new HeapSampler();
        sampler_.start();
        foam.lang.X fsX = x.put(FileSystemStorage.class, storage_).put(Storage.class, storage_);
        MDAO mdao = new MDAO(ci);
        mdao.setSafeMode(false);
        F3FileJournal journal = new F3FileJournal.Builder(fsX)
          .setFilename(jrlName_)
          .build();

        long wallStart = System.nanoTime();
        journal.replay(fsX, mdao);
        long wallNanos = System.nanoTime() - wallStart;

        double wallSec = wallNanos / 1e9;
        long processed = journal.getPassCount();

        log("");
        log("=== End-to-End: " + label + " (" + processed + " entries) ===");
        log(String.format("  Wall time:  %6.2f sec", wallSec));
        log(String.format("  Throughput: %.0f entries/sec", processed/wallSec));
        log("  Failed entries: " + journal.getFailCount());
        stringGraphStats(label, mdao, ci);
        long peakMB = sampler_.stopAndGetPeakMB();
        for ( long[] smp : sampler_.samples ) log("HEAPTS," + label + "," + smp[0] + "," + smp[1]);
        long rssNow = HeapSampler.rssMB();
        long rssPeak = 0;
        for ( long[] smp : sampler_.samples ) if ( smp.length > 2 ) rssPeak = Math.max(rssPeak, smp[2]);
        log(String.format("  Peak heap:  %6d MB during run; RSS %d MB peak, %d MB after GC", peakMB, rssPeak, rssNow));
        retain_ = mdao;
        double heapAfter  = usedHeapMB();
        double retainedMB = heapAfter - heapBefore;
        retain_ = null;
        log(String.format("  Heap:       %6.0f MB before, %6.0f MB after (used, post-GC)", heapBefore, heapAfter));
        log(String.format("  Retained:   %6.0f MB (MDAO + parsed values)", retainedMB));
        StringParser.DEDUP = 1;

        record(label, wallSec, retainedMB, peakMB);
        test(processed == NUM_ENTRIES, "F3FileJournal.replay should process all " + NUM_ENTRIES + " entries (got " + processed + ")");
      `
    },
    {
      name: 'printRow',
      args: 'String label, double wallSec, double retainedMB, long peakMB',
      javaCode: `
        double speedup = baselineWallSec_ / wallSec;
        log(String.format("%-52s %8.2f %10.0f %7.1fx %10.0f %8d", label, wallSec, NUM_ENTRIES / wallSec, speedup, retainedMB, peakMB));
      `
    },
    {
      name: 'printSummary',
      javaCode: `
        log("");
        log("=== COMPARISON TABLE ===");
        log(String.format("%-52s %8s %10s %8s %10s %8s", "Variant", "Wall(s)", "Entries/s", "vs FOAM", "Retained MB", "Peak MB"));
        log(String.format("%-52s %8s %10s %8s %10s %8s", "-------", "------", "--------", "-------", "-----------", "-------"));
        for ( Object[] row : rows_ ) {
          printRow((String) row[0], (Double) row[1], (Double) row[2], (Long) row[3]);
        }
      `
    },
    {
      name: 'log',
      args: 'String msg',
      javaCode: `System.out.println(msg);`
    }
  ]
});
