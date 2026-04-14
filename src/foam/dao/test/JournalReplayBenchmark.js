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
    'foam.dao.MDAO',
    'foam.dao.JacksonJournalParser',
    'foam.lib.json.JSONParser',
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

        test(count == NUM_ENTRIES, "Jackson inlined replay should process all " + NUM_ENTRIES + " entries (got " + count + ")");
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
      name: 'printSummary',
      javaCode: `
        log("");
        log("=== Summary ===");
        log("  Model-level parser selection: inspect ClassInfo properties once per DAO.");
        log("  If all properties are simple scalars → Jackson fast path.");
        log("  If any Enum/FObject/Array/Map/Reference → FOAM parser (no change).");
        log("  The check runs once at replay start, zero per-entry cost.");
      `
    },
    {
      name: 'log',
      args: 'String msg',
      javaCode: `System.out.println(msg);`
    }
  ]
});
