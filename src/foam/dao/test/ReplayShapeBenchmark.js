/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.test',
  name: 'ReplayShapeBenchmark',
  extends: 'foam.core.test.Test',
  flags: ['java'],

  documentation: `
    Model-shape matrix for journal-entry parse cost: attributes parsing cost
    per property type (String/Long/Double/Int/Boolean/Date/DateTime/Enum/
    Reference/StringArray/nested FObjectProperty) and per value shape
    (string length, cardinality, escapes, nulls), separately from
    JournalReplayBenchmark's single 50-property model / production-pipeline
    comparison.

    For each (model, cell) it pre-generates a fixed set of entry bodies via
    ReplayJournalGenerator, warms up, then times single-threaded
    foam.lib.json.JSONParser.parseString(body, cls) — parse only, no MDAO
    put — over every body, with foam.lib.json.StringParser.INTERN both on
    and off.

    Run: ./build.sh -W9090 --flags:test server-tests:ReplayShapeBenchmark
    Options:
      -Dbenchmark.shape.entries=200000  (default 200000)
  `,

  javaImports: [
    'foam.lang.ClassInfo',
    'foam.lang.FObject',
    'foam.lib.json.JSONParser',
    'foam.lib.json.StringParser',
    'java.util.ArrayList',
    'java.util.List'
  ],

  javaCode: `
    private static final int NUM_ENTRIES = Integer.getInteger("benchmark.shape.entries", 200000);
    private static final int WARMUP      = Math.min(5000, NUM_ENTRIES);

    private final List<Object[]> rows_ = new ArrayList<>();

    private void log(String msg) {
      System.out.println(msg);
    }
  `,

  methods: [
    {
      name: 'runTest',
      javaCode: `
        ReplayJournalGenerator.Options def = new ReplayJournalGenerator.Options();
        runCell(x, BenchmarkModel.getOwnClassInfo(),      "default", def);
        runCell(x, ReplaySmallModel.getOwnClassInfo(),    "default", def);
        runCell(x, ReplayStringModel.getOwnClassInfo(),   "default", def);
        runCell(x, ReplayDateModel.getOwnClassInfo(),     "default", def);
        runCell(x, ReplayNumericModel.getOwnClassInfo(),  "default", def);
        runCell(x, ReplayEnumModel.getOwnClassInfo(),     "default", def);
        runCell(x, ReplayNestedModel.getOwnClassInfo(),   "default", def);

        ReplayJournalGenerator.Options unique = new ReplayJournalGenerator.Options();
        unique.uniqueStrings = true;
        runCell(x, ReplayStringModel.getOwnClassInfo(), "unique-strings", unique);

        ReplayJournalGenerator.Options longStr = new ReplayJournalGenerator.Options();
        longStr.longStrings = true;
        runCell(x, ReplayStringModel.getOwnClassInfo(), "long-strings", longStr);

        ReplayJournalGenerator.Options escapes = new ReplayJournalGenerator.Options();
        escapes.someEscapes = true;
        runCell(x, ReplayStringModel.getOwnClassInfo(), "escaped-strings", escapes);

        ReplayJournalGenerator.Options nulls = new ReplayJournalGenerator.Options();
        nulls.someNulls = true;
        runCell(x, BenchmarkModel.getOwnClassInfo(), "some-nulls", nulls);

        printTable();
      `
    },
    {
      name: 'runCell',
      documentation: `
        Generates NUM_ENTRIES bodies for ci under opts, then times a single
        JSONParser.parseString pass over all of them, once with
        StringParser.INTERN on and once off. Appends one row per intern
        state to rows_.
      `,
      args: 'Context x, ClassInfo ci, String cell, ReplayJournalGenerator.Options opts',
      javaCode: `
        String model = ci.getObjClass().getSimpleName();

        ReplayJournalGenerator gen = new ReplayJournalGenerator();
        String[] bodies = new String[NUM_ENTRIES];
        long totalBytes = 0;
        for ( int i = 0 ; i < NUM_ENTRIES ; i++ ) {
          bodies[i] = gen.generateBody(ci, i, false, opts);
          totalBytes += bodies[i].length();
        }

        timeParse(x, model, cell, ci, bodies, totalBytes, true);
        timeParse(x, model, cell, ci, bodies, totalBytes, false);
      `
    },
    {
      name: 'timeParse',
      args: 'Context x, String model, String cell, ClassInfo ci, String[] bodies, long totalBytes, boolean internOn',
      javaCode: `
        java.lang.Class cls = ci.getObjClass();
        StringParser.DEDUP = internOn ? 1 : 0;

        JSONParser p = new JSONParser();
        p.setX(x);

        for ( int i = 0 ; i < WARMUP ; i++ ) {
          p.parseString(bodies[i], cls);
        }

        int count = 0;
        long start = System.nanoTime();
        for ( int i = 0 ; i < bodies.length ; i++ ) {
          FObject obj = p.parseString(bodies[i], cls);
          if ( obj != null ) count++;
        }
        long elapsed = System.nanoTime() - start;

        StringParser.DEDUP = 1;

        double wallSec       = elapsed / 1e9;
        double entriesPerSec = count / wallSec;
        double nsPerEntry    = ((double) elapsed) / bodies.length;
        double mbPerSec      = (totalBytes / 1e6) / wallSec;

        rows_.add(new Object[] { model, cell, internOn ? "on" : "off", entriesPerSec, nsPerEntry, mbPerSec });

        test(count == bodies.length, model + "/" + cell + (internOn ? "" : ",no-intern")
          + ": all " + bodies.length + " bodies should parse (got " + count + ")");
      `
    },
    {
      name: 'printTable',
      javaCode: `
        log("");
        log("| Model | Cell | Intern | Entries/s | ns/entry | MB/s |");
        log("|---|---|---|---|---|---|");
        for ( Object[] row : rows_ ) {
          log(String.format("| %s | %s | %s | %.0f | %.1f | %.2f |",
            row[0], row[1], row[2], (Double) row[3], (Double) row[4], (Double) row[5]));
        }
      `
    }
  ]
});
