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
    End-to-end journal replay benchmark. Writes a real .jrl file, then replays
    it through the full path (file read → getEntry → parse → MDAO put) using
    both FOAM and Jackson parsers. Reports per-phase breakdown.

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
    'foam.dao.ArraySink',
    'foam.dao.MDAO',
    'foam.dao.JacksonJournalParser',
    'foam.lib.json.JSONParser',
    'foam.lib.parse.PooledStringPStream',
    'foam.lib.parse.FastStringPStream',
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
    'java.util.regex.Pattern'
  ],

  javaCode: `
    private static final Pattern COMMENT = Pattern.compile("(/\\\\*([^*]|[\\\\r\\\\n]|(\\\\*+([^*/]|[\\\\r\\\\n])))*\\\\*+/)|(//.*)");
    private static final int NUM_ENTRIES = Integer.getInteger("benchmark.entries", 1000000);

    private double foamWallSec_, jacksonWallSec_, inlinedWallSec_, jacksonInlinedWallSec_,
                   pooledWallSec_, fastPsWallSec_, allOptWallSec_, parallelWallSec_;
  `,

  methods: [
    {
      name: 'runTest',
      javaThrows: ['Exception'],
      javaCode: `
        ClassInfo ci = BenchmarkModel.getOwnClassInfo();

        // ---- Phase 1: Model-level parser selection ----
        checkModelSafety(x, ci);

        // ---- Phase 2: Write a real .jrl file ----
        String jrlPath = writeJournalFile(NUM_ENTRIES);

        try {
          // ---- Phase 3: Warmup with first 10K entries ----
          warmupParsers(x, ci, jrlPath);

          // ---- Phase 4: FOAM parser (baseline) ----
          replayWithFoam(x, ci, jrlPath);

          // ---- Phase 6: Jackson (ceiling) ----
          replayWithJackson(x, ci, jrlPath);

          // ---- Experiment 1: Inlined (no AssemblyLine) ----
          replayInlined(x, ci, jrlPath);

          // ---- Experiment 1b: Jackson + Inlined ----
          replayJacksonInlined(x, ci, jrlPath);

          // ---- Experiment 2: Pooled PStream ----
          replayWithPooledPStream(x, ci, jrlPath);

          // ---- Experiment 2b: FastStringPStream ----
          replayWithFastPStream(x, ci, jrlPath);

          // ---- All optimizations combined ----
          replayAllOptimizations(x, ci, jrlPath);

          // ---- Experiment 3: Parallel file loading ----
          replayParallel(x, ci, jrlPath);

          // ---- Phase 7: Comment check ----
          commentCheckBenchmark();

          // ---- Phase 8: Summary ----
          printSummary();

        } finally {
          new File(jrlPath).delete();
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
      args: 'int count',
      javaCode: `
        String path = System.getProperty("java.io.tmpdir") + "/benchmark_replay_" + count + ".jrl";
        log("Writing " + count + " entries to " + path + " ...");
        long now = System.currentTimeMillis();
        String[] uuids = new String[1000];
        for ( int u = 0 ; u < uuids.length ; u++ ) uuids[u] = java.util.UUID.randomUUID().toString();

        long bytes = 0;
        try ( BufferedWriter w = new BufferedWriter(new FileWriter(path), 4 * 1024 * 1024) ) {
          w.write("v({\\"version\\":\\"\\"})");
          w.newLine();
          // Add some comments like a real journal
          w.write("// Generated benchmark journal");
          w.newLine();

          for ( int i = 0 ; i < count ; i++ ) {
            StringBuilder sb = new StringBuilder(750);
            sb.append("c({seq:").append(i);
            sb.append(",gi:\\"group").append(i % 20).append("\\"");
            sb.append(",ltd:").append(now - i * 1000L);
            sb.append(",cd:").append(now - i * 86400000L);
            sb.append(",sd:").append(now + 86400000L);
            sb.append(",nn:\\"").append(i % 2 == 0 ? "NET_A" : "NET_B").append("\\"");
            sb.append(",crb:\\"6494").append(i % 10000).append("\\"");
            sb.append(",ra:0.0,racb:0.0");
            sb.append(",createdAt:").append(now - i * 500L);
            sb.append(",token:\\"").append(uuids[i % uuids.length]).append("\\"");
            sb.append(",amountStr:\\"").append(100 + i % 9000).append(".").append(i % 100).append("\\"");
            sb.append(",amount:").append(100.0 + i % 9000);
            sb.append(",cc:\\"784\\"");
            sb.append(",ab:").append(1000.0 + i % 50000);
            sb.append(",cchb:\\"784\\"");
            sb.append(",ai:\\"P\\"");
            sb.append(",fee:").append((i % 500) * 0.1);
            sb.append(",ad:\\"{}\\"");
            sb.append(",statusCode:\\"0000\\"");
            sb.append(",accountRef:\\"").append(100000 + i).append(".0\\"");
            sb.append(",entityRef:\\"").append(200000 + i).append(".0\\"");
            sb.append(",acquirerRef:\\"487530\\"");
            sb.append(",merchantId:\\"487530003905858\\"");
            sb.append(",categoryCode:\\"7011\\"");
            sb.append(",merchantName:\\"Test Merchant ").append(i % 100).append("\\"");
            sb.append(",city:\\"SampleCity\\"");
            sb.append(",country:\\"XYZ\\"");
            sb.append(",terminalId:\\"24618256\\"");
            sb.append(",traceNum:\\"").append(100000 + i).append("      \\"");
            sb.append(",retrievalRef:\\"527414").append(100000 + i).append("\\"");
            sb.append(",an:\\"").append(500000 + i % 100000).append("\\"");
            sb.append(",lt:\\"305274513798184\\"");
            sb.append(",rcd:\\"0000\\"");
            sb.append(",reverseRef:\\"").append(i + 1).append(".0\\"");
            sb.append(",rc:").append(i % 3);
            sb.append(",typeCode:\\"100.00.100\\"");
            sb.append(",rbs:\\"20000.0000,14970.4400\\"");
            sb.append(",environment:\\"Standard POS\\"");
            sb.append(",e:\\"00\\"");
            sb.append(",maskedNum:\\"415483______3080\\"");
            sb.append(",cardRef:\\"").append(300000 + i).append(".0\\"");
            sb.append(",gl:\\"").append(i + 2).append(".0\\"");
            sb.append(",baseValue:").append(1000.0 + i % 50000);
            sb.append(",bc:\\"784\\"");
            sb.append(",ia:\\"1\\"");
            sb.append(",em:\\"N\\"");
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
      `
    },
    {
      name: 'replayWithFoam',
      args: 'Context x, ClassInfo ci, String jrlPath',
      javaCode: `
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
        log("=== End-to-End: FOAM Parser [BASELINE] (" + count + " entries, " + (totalBytes/1_000_000) + " MB) ===");
        log(String.format("  Wall time:  %6.2f sec", wallSec));
        log(String.format("  Read:       %6.2f sec  (%4.1f%%)", readSec,  100*readSec/wallSec));
        log(String.format("  Parse:      %6.2f sec  (%4.1f%%)", parseSec, 100*parseSec/wallSec));
        log(String.format("  MDAO put:   %6.2f sec  (%4.1f%%)", putSec,   100*putSec/wallSec));
        log(String.format("  Overhead:   %6.2f sec  (%4.1f%%)", unacctSec, 100*unacctSec/wallSec));
        log(String.format("  Throughput: %.0f entries/sec, %.1f MB/sec", count/wallSec, mbSec));
        log("  Comments skipped: " + comments);

        foamWallSec_ = wallSec;
        test(count == NUM_ENTRIES, "FOAM replay should process all " + NUM_ENTRIES + " entries (got " + count + ")");
      `
    },
    {
      name: 'replayWithJackson',
      javaThrows: ['Exception'],
      args: 'Context x, ClassInfo ci, String jrlPath',
      javaCode: `
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

        jacksonWallSec_ = wallSec;
        test(count == NUM_ENTRIES, "Jackson replay should process all " + NUM_ENTRIES + " entries (got " + count + ")");
      `
    },
    {
      name: 'replayInlined',
      args: 'Context x, ClassInfo ci, String jrlPath',
      javaCode: `
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
          throw new RuntimeException("FOAM inlined replay failed", e);
        }
        long wallNanos = System.nanoTime() - wallStart;

        double wallSec     = wallNanos / 1e9;
        double readSec     = readNanos / 1e9;
        double parseSec    = parseNanos / 1e9;
        double putSec      = putNanos / 1e9;
        double unacctSec   = wallSec - readSec - parseSec - putSec;
        double mbSec       = (totalBytes / 1e6) / wallSec;

        log("");
        log("=== End-to-End: FOAM Inlined (no AssemblyLine) (" + count + " entries, " + (totalBytes/1_000_000) + " MB) ===");
        log(String.format("  Wall time:  %6.2f sec", wallSec));
        log(String.format("  Read:       %6.2f sec  (%4.1f%%)", readSec,  100*readSec/wallSec));
        log(String.format("  Parse:      %6.2f sec  (%4.1f%%)", parseSec, 100*parseSec/wallSec));
        log(String.format("  MDAO put:   %6.2f sec  (%4.1f%%)", putSec,   100*putSec/wallSec));
        log(String.format("  Overhead:   %6.2f sec  (%4.1f%%)", unacctSec, 100*unacctSec/wallSec));
        log(String.format("  Throughput: %.0f entries/sec, %.1f MB/sec", count/wallSec, mbSec));
        log("  Comments skipped: " + comments);

        inlinedWallSec_ = wallSec;
        test(count == NUM_ENTRIES, "FOAM inlined replay should process all " + NUM_ENTRIES + " entries (got " + count + ")");
      `
    },
    {
      name: 'replayJacksonInlined',
      javaThrows: ['Exception'],
      args: 'Context x, ClassInfo ci, String jrlPath',
      javaCode: `
        JacksonJournalParser jacksonParser = new JacksonJournalParser();
        jacksonParser.setTargetClassInfo(ci);
        JSONParser foamParser = new JSONParser();
        foamParser.setX(x);
        Class cls = ci.getObjClass();
        MDAO mdao = new MDAO(ci);
        mdao.setSafeMode(false);

        long readNanos = 0, parseNanos = 0, putNanos = 0;
        int count = 0, comments = 0;
        long totalBytes = 0;
        int jacksonHits = 0, fallbacks = 0;

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
            FObject obj = null;
            try {
              obj = jacksonParser.parseString(body);
              jacksonHits++;
            } catch (Exception e) {
              obj = foamParser.parseString(body, cls);
              fallbacks++;
            }
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
        log("=== End-to-End: Jackson Inlined (no AssemblyLine) (" + count + " entries, " + (totalBytes/1_000_000) + " MB) ===");
        log(String.format("  Wall time:  %6.2f sec", wallSec));
        log(String.format("  Read:       %6.2f sec  (%4.1f%%)", readSec,  100*readSec/wallSec));
        log(String.format("  Parse:      %6.2f sec  (%4.1f%%)", parseSec, 100*parseSec/wallSec));
        log(String.format("  MDAO put:   %6.2f sec  (%4.1f%%)", putSec,   100*putSec/wallSec));
        log(String.format("  Overhead:   %6.2f sec  (%4.1f%%)", unacctSec, 100*unacctSec/wallSec));
        log(String.format("  Throughput: %.0f entries/sec, %.1f MB/sec", count/wallSec, mbSec));
        log("  Jackson hits: " + jacksonHits + ", FOAM fallbacks: " + fallbacks);
        log("  Comments skipped: " + comments);

        jacksonInlinedWallSec_ = wallSec;
        test(count == NUM_ENTRIES, "Jackson inlined replay should process all " + NUM_ENTRIES + " entries (got " + count + ")");
      `
    },
    {
      name: 'replayWithPooledPStream',
      args: 'Context x, ClassInfo ci, String jrlPath',
      javaCode: `
        JSONParser parser = new JSONParser();
        parser.setX(x);
        Class cls = ci.getObjClass();
        MDAO mdao = new MDAO(ci);
        mdao.setSafeMode(false);
        PooledStringPStream pooledPs = PooledStringPStream.create("", 8192);

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
            FObject obj = parser.parseStringPooled(body, cls, pooledPs);
            parseNanos += System.nanoTime() - p0;

            if ( obj != null ) {
              long w0 = System.nanoTime();
              mdao.put_(x, obj);
              putNanos += System.nanoTime() - w0;
              count++;
            }
          }
        } catch (Exception e) {
          throw new RuntimeException("Pooled PStream replay failed", e);
        }
        long wallNanos = System.nanoTime() - wallStart;

        double wallSec     = wallNanos / 1e9;
        double readSec     = readNanos / 1e9;
        double parseSec    = parseNanos / 1e9;
        double putSec      = putNanos / 1e9;
        double unacctSec   = wallSec - readSec - parseSec - putSec;
        double mbSec       = (totalBytes / 1e6) / wallSec;

        log("");
        log("=== End-to-End: FOAM + Pooled PStream (" + count + " entries, " + (totalBytes/1_000_000) + " MB) ===");
        log(String.format("  Wall time:  %6.2f sec", wallSec));
        log(String.format("  Read:       %6.2f sec  (%4.1f%%)", readSec,  100*readSec/wallSec));
        log(String.format("  Parse:      %6.2f sec  (%4.1f%%)", parseSec, 100*parseSec/wallSec));
        log(String.format("  MDAO put:   %6.2f sec  (%4.1f%%)", putSec,   100*putSec/wallSec));
        log(String.format("  Overhead:   %6.2f sec  (%4.1f%%)", unacctSec, 100*unacctSec/wallSec));
        log(String.format("  Throughput: %.0f entries/sec, %.1f MB/sec", count/wallSec, mbSec));
        log("  Comments skipped: " + comments);

        pooledWallSec_ = wallSec;
        test(count == NUM_ENTRIES, "Pooled PStream replay should process all " + NUM_ENTRIES + " entries (got " + count + ")");
      `
    },
    {
      name: 'replayWithFastPStream',
      args: 'Context x, ClassInfo ci, String jrlPath',
      javaCode: `
        JSONParser parser = new JSONParser();
        parser.setX(x);
        Class cls = ci.getObjClass();
        MDAO mdao = new MDAO(ci);
        mdao.setSafeMode(false);
        FastStringPStream fps = new FastStringPStream("");

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
            FObject obj = parser.parseStringFast(body, cls, fps);
            parseNanos += System.nanoTime() - p0;

            if ( obj != null ) {
              long w0 = System.nanoTime();
              mdao.put_(x, obj);
              putNanos += System.nanoTime() - w0;
              count++;
            }
          }
        } catch (Exception e) {
          throw new RuntimeException("FastPStream replay failed", e);
        }
        long wallNanos = System.nanoTime() - wallStart;

        double wallSec     = wallNanos / 1e9;
        double readSec     = readNanos / 1e9;
        double parseSec    = parseNanos / 1e9;
        double putSec      = putNanos / 1e9;
        double unacctSec   = wallSec - readSec - parseSec - putSec;
        double mbSec       = (totalBytes / 1e6) / wallSec;

        log("");
        log("=== End-to-End: FOAM + FastPStream (char[]) (" + count + " entries, " + (totalBytes/1_000_000) + " MB) ===");
        log(String.format("  Wall time:  %6.2f sec", wallSec));
        log(String.format("  Read:       %6.2f sec  (%4.1f%%)", readSec,  100*readSec/wallSec));
        log(String.format("  Parse:      %6.2f sec  (%4.1f%%)", parseSec, 100*parseSec/wallSec));
        log(String.format("  MDAO put:   %6.2f sec  (%4.1f%%)", putSec,   100*putSec/wallSec));
        log(String.format("  Overhead:   %6.2f sec  (%4.1f%%)", unacctSec, 100*unacctSec/wallSec));
        log(String.format("  Throughput: %.0f entries/sec, %.1f MB/sec", count/wallSec, mbSec));
        log("  Comments skipped: " + comments);

        fastPsWallSec_ = wallSec;
        test(count == NUM_ENTRIES, "FastPStream replay should process all " + NUM_ENTRIES + " entries (got " + count + ")");
      `
    },
    {
      name: 'replayAllOptimizations',
      args: 'Context x, ClassInfo ci, String jrlPath',
      javaCode: `
        JacksonJournalParser jacksonParser = new JacksonJournalParser();
        jacksonParser.setTargetClassInfo(ci);
        JSONParser foamParser = new JSONParser();
        foamParser.setX(x);
        Class cls = ci.getObjClass();
        MDAO mdao = new MDAO(ci);
        mdao.setSafeMode(false);
        PooledStringPStream pooledPs = PooledStringPStream.create("", 8192);

        long readNanos = 0, parseNanos = 0, putNanos = 0;
        int count = 0, comments = 0;
        long totalBytes = 0;
        int jacksonHits = 0, fallbacks = 0;

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
            FObject obj = null;
            try {
              obj = jacksonParser.parseString(body);
              jacksonHits++;
            } catch (Exception e) {
              obj = foamParser.parseStringPooled(body, cls, pooledPs);
              fallbacks++;
            }
            parseNanos += System.nanoTime() - p0;

            if ( obj != null ) {
              long w0 = System.nanoTime();
              mdao.put_(x, obj);
              putNanos += System.nanoTime() - w0;
              count++;
            }
          }
        } catch (Exception e2) {
          throw new RuntimeException("All optimizations replay failed", e2);
        }
        long wallNanos = System.nanoTime() - wallStart;

        double wallSec     = wallNanos / 1e9;
        double readSec     = readNanos / 1e9;
        double parseSec    = parseNanos / 1e9;
        double putSec      = putNanos / 1e9;
        double unacctSec   = wallSec - readSec - parseSec - putSec;
        double mbSec       = (totalBytes / 1e6) / wallSec;

        log("");
        log("=== End-to-End: All Optimizations Combined (" + count + " entries, " + (totalBytes/1_000_000) + " MB) ===");
        log(String.format("  Wall time:  %6.2f sec", wallSec));
        log(String.format("  Read:       %6.2f sec  (%4.1f%%)", readSec,  100*readSec/wallSec));
        log(String.format("  Parse:      %6.2f sec  (%4.1f%%)", parseSec, 100*parseSec/wallSec));
        log(String.format("  MDAO put:   %6.2f sec  (%4.1f%%)", putSec,   100*putSec/wallSec));
        log(String.format("  Overhead:   %6.2f sec  (%4.1f%%)", unacctSec, 100*unacctSec/wallSec));
        log(String.format("  Throughput: %.0f entries/sec, %.1f MB/sec", count/wallSec, mbSec));
        log("  Jackson hits: " + jacksonHits + ", FOAM+Pool fallbacks: " + fallbacks);
        log("  Comments skipped: " + comments);

        allOptWallSec_ = wallSec;
        test(count == NUM_ENTRIES, "All optimizations replay should process all " + NUM_ENTRIES + " entries (got " + count + ")");
      `
    },
    {
      name: 'replayParallel',
      javaThrows: ['Exception'],
      args: 'Context x, ClassInfo ci, String jrlPath',
      javaCode: `
        // Step 1: Read all data lines
        List<String> dataLines = new ArrayList<>(NUM_ENTRIES + 10);
        try ( BufferedReader reader = new BufferedReader(new FileReader(jrlPath), 2 * 1024 * 1024) ) {
          String line;
          while ( (line = reader.readLine()) != null ) {
            int len = line.length();
            if ( len == 0 ) continue;
            if ( line.charAt(0) == '/' ) continue;
            if ( len < 3 ) continue;
            char op = line.charAt(0);
            if ( op == 'v' ) continue;
            if ( op != 'c' && op != 'p' && op != 'r' ) continue;
            dataLines.add(line);
          }
        }
        int totalLines = dataLines.size();
        log("");
        log("=== End-to-End: Parallel (" + totalLines + " entries) ===");

        // Step 2: Split into N chunks
        int nThreads = Runtime.getRuntime().availableProcessors();
        int chunkSize = (totalLines + nThreads - 1) / nThreads;
        log("  Threads: " + nThreads + ", chunk size: ~" + chunkSize);

        // Step 3: Create N threads, each with own parsers and MDAO
        MDAO[] mdaos = new MDAO[nThreads];
        Thread[] threads = new Thread[nThreads];
        long[] threadNanos = new long[nThreads];
        int[] threadCounts = new int[nThreads];
        Class cls = ci.getObjClass();

        long parseStart = System.nanoTime();
        for ( int t = 0 ; t < nThreads ; t++ ) {
          final int threadIdx = t;
          final int from = t * chunkSize;
          final int to = Math.min(from + chunkSize, totalLines);
          mdaos[t] = new MDAO(ci);
          mdaos[t].setSafeMode(false);

          threads[t] = new Thread(() -> {
            JacksonJournalParser jp = new JacksonJournalParser();
            jp.setTargetClassInfo(ci);
            JSONParser fp = new JSONParser();
            fp.setX(x);
            PooledStringPStream pooledPs = PooledStringPStream.create("", 8192);
            long t0 = System.nanoTime();
            int cnt = 0;

            for ( int i = from ; i < to ; i++ ) {
              String line = dataLines.get(i);
              String body = line.substring(2, line.length() - 1);
              FObject obj = null;
              try {
                obj = jp.parseString(body);
              } catch (Exception e) {
                obj = fp.parseStringPooled(body, cls, pooledPs);
              }
              if ( obj != null ) {
                mdaos[threadIdx].put_(x, obj);
                cnt++;
              }
            }
            threadNanos[threadIdx] = System.nanoTime() - t0;
            threadCounts[threadIdx] = cnt;
          }, "parallel-replay-" + t);
          threads[t].start();
        }

        // Step 4: Wait for all threads
        for ( int t = 0 ; t < nThreads ; t++ ) {
          threads[t].join();
        }
        long parseDoneNanos = System.nanoTime() - parseStart;

        // Step 5: Merge all MDAOs into one
        long mergeStart = System.nanoTime();
        MDAO merged = new MDAO(ci);
        merged.setSafeMode(false);
        int totalCount = 0;
        for ( int t = 0 ; t < nThreads ; t++ ) {
          ArraySink sink = (ArraySink) mdaos[t].select(new ArraySink());
          List list = sink.getArray();
          for ( int i = 0 ; i < list.size() ; i++ ) {
            merged.put_(x, (FObject) list.get(i));
          }
          totalCount += threadCounts[t];
        }
        long mergeNanos = System.nanoTime() - mergeStart;
        long totalNanos = parseDoneNanos + mergeNanos;

        double parseSec = parseDoneNanos / 1e9;
        double mergeSec = mergeNanos / 1e9;
        double totalSec = totalNanos / 1e9;

        for ( int t = 0 ; t < nThreads ; t++ ) {
          log(String.format("  Thread %2d: %6d entries in %.2f sec", t, threadCounts[t], threadNanos[t] / 1e9));
        }
        log(String.format("  Parallel parse: %.2f sec", parseSec));
        log(String.format("  Merge:          %.2f sec", mergeSec));
        log(String.format("  Total:          %.2f sec", totalSec));
        log(String.format("  Throughput:     %.0f entries/sec", totalCount / totalSec));

        parallelWallSec_ = totalSec;
        test(totalCount == NUM_ENTRIES, "Parallel replay should process all " + NUM_ENTRIES + " entries (got " + totalCount + ")");
      `
    },
    {
      name: 'commentCheckBenchmark',
      javaCode: `
        // Generate 1M lines: 90% data, 10% comments
        int n = 1000000;
        List<String> lines = new ArrayList<>(n);
        for ( int i = 0 ; i < n ; i++ ) {
          if ( i % 10 == 0 ) lines.add("// Modified by user (1) at 2025-10-01T00:00:00Z");
          else lines.add("c({seq:" + i + ",gi:\\"g\\"})");
        }

        // Regex
        long start = System.nanoTime();
        int rm = 0;
        for ( int i = 0 ; i < lines.size() ; i++ ) {
          if ( COMMENT.matcher(lines.get(i)).matches() ) rm++;
        }
        double regexMs = (System.nanoTime() - start) / 1e6;

        // charAt
        start = System.nanoTime();
        int cm = 0;
        for ( int i = 0 ; i < lines.size() ; i++ ) {
          String s = lines.get(i);
          if ( s.length() > 0 && s.charAt(0) == '/' ) cm++;
        }
        double charMs = (System.nanoTime() - start) / 1e6;

        log("");
        log("=== Comment Check: regex vs charAt (1M lines, 10% comments) ===");
        log(String.format("  Regex:   %.1f ms (%d matches)", regexMs, rm));
        log(String.format("  charAt:  %.1f ms (%d matches)", charMs, cm));
        log(String.format("  Speedup: %.1fx", regexMs / charMs));

        test(rm == cm, "Comment check methods should agree");
      `
    },
    {
      name: 'printRow',
      args: 'String label, double wallSec, double baseline',
      javaCode: `
        if ( wallSec <= 0 ) return;
        double entriesPerSec = NUM_ENTRIES / wallSec;
        double speedup = baseline / wallSec;
        log(String.format("%-40s %8.2f %10.0f %7.1fx", label, wallSec, entriesPerSec, speedup));
      `
    },
    {
      name: 'printSummary',
      javaCode: `
        log("");
        log("=== COMPARISON TABLE ===");
        log(String.format("%-40s %8s %10s %8s", "Variant", "Wall(s)", "Entries/s", "vs FOAM"));
        log(String.format("%-40s %8s %10s %8s", "-------", "------", "--------", "-------"));
        double baseline = foamWallSec_;
        printRow("FOAM Parser (baseline)",          foamWallSec_,          baseline);
        printRow("Jackson (ceiling)",               jacksonWallSec_,       baseline);
        printRow("FOAM Inlined (no AssemblyLine)",  inlinedWallSec_,       baseline);
        printRow("Jackson Inlined",                 jacksonInlinedWallSec_,baseline);
        printRow("FOAM + Pooled PStream",           pooledWallSec_,        baseline);
        printRow("FOAM + FastPStream (char[])",     fastPsWallSec_,        baseline);
        printRow("All Optimizations Combined",      allOptWallSec_,        baseline);
        if ( parallelWallSec_ > 0 )
          printRow("Parallel (" + Runtime.getRuntime().availableProcessors() + " threads)", parallelWallSec_, baseline);
      `
    },
    {
      name: 'log',
      args: 'String msg',
      javaCode: `System.out.println(msg);`
    }
  ]
});
