/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.lang.test',
  name: 'DatePropertyBench',
  extends: 'foam.core.test.Test',

  documentation: `Per-operation heap and CPU benchmark for date-typed
    properties, measured over DateTimeTestModel (one Date, one DateTime, one
    DateTimeUTC).

    Operations covered: create, getter reads, fclone, MDAO put, ordered
    select, range predicate select, GROUP_BY on a raw date key, GROUP_BY on a
    date expression, JSON output and JSON parse.

    Run the same command on two builds and diff the BENCH lines. Every line is
    key=value so the phases can be compared mechanically.

    Tunables (system properties):
      -Dbench.n=<records>       default 1000000
      -Dbench.getterPasses=<n>  default 10
      -Dbench.serializeN=<n>    default 100000  (JSON phases only)`,

  javaImports: [
    'foam.dao.ArraySink',
    'foam.dao.DAO',
    'foam.dao.MDAO',
    'foam.lib.json.JSONParser',
    'foam.lib.json.Outputter',
    'foam.mlang.expr.DateToYYYYMMExpr',
    'foam.mlang.sink.GroupBy',
    'java.lang.management.GarbageCollectorMXBean',
    'java.lang.management.ManagementFactory',
    'java.util.ArrayList',
    'java.util.Date',
    'java.util.List',
    'static foam.mlang.MLang.AND',
    'static foam.mlang.MLang.COUNT',
    'static foam.mlang.MLang.GROUP_BY',
    'static foam.mlang.MLang.GTE',
    'static foam.mlang.MLang.LTE'
  ],

  properties: [
    { class: 'Long', name: 'gcCount_', transient: true, hidden: true },
    { class: 'Long', name: 'gcTime_',  transient: true, hidden: true },
    { class: 'Long', name: 'cpu0_',    transient: true, hidden: true },
    { class: 'Long', name: 'wall0_',   transient: true, hidden: true }
  ],

  methods: [
    {
      name: 'settleHeap',
      documentation: 'Force a few collections so a heap reading is comparable.',
      type: 'Long',
      javaCode: `
        for ( int i = 0 ; i < 3 ; i++ ) {
          System.gc();
          try { Thread.sleep(300); } catch ( InterruptedException e ) {}
        }
        Runtime rt = Runtime.getRuntime();
        return rt.totalMemory() - rt.freeMemory();
      `
    },
    {
      name: 'startPhase',
      javaCode: `
        long c = 0, t = 0;
        for ( GarbageCollectorMXBean b : ManagementFactory.getGarbageCollectorMXBeans() ) {
          c += b.getCollectionCount();
          t += b.getCollectionTime();
        }
        setGcCount_(c);
        setGcTime_(t);
        setCpu0_(ManagementFactory.getThreadMXBean().getCurrentThreadCpuTime());
        setWall0_(System.nanoTime());
      `
    },
    {
      name: 'endPhase',
      documentation: 'Emit one BENCH line for the phase started by startPhase.',
      args: 'String phase, String extra',
      javaCode: `
        long wallMs = ( System.nanoTime() - getWall0_() ) / 1000000;
        long cpuMs  = ( ManagementFactory.getThreadMXBean().getCurrentThreadCpuTime()
                        - getCpu0_() ) / 1000000;
        long c = 0, t = 0;
        for ( GarbageCollectorMXBean b : ManagementFactory.getGarbageCollectorMXBeans() ) {
          c += b.getCollectionCount();
          t += b.getCollectionTime();
        }
        System.out.println("BENCH phase=" + phase
          + " wallMs=" + wallMs
          + " cpuMs=" + cpuMs
          + " gcCount=" + ( c - getGcCount_() )
          + " gcTimeMs=" + ( t - getGcTime_() )
          + ( extra == null ? "" : " " + extra ));
      `
    },
    {
      name: 'runTest',
      javaCode: `
        int  n          = Integer.getInteger("bench.n", 1000000);
        int  passes     = Integer.getInteger("bench.getterPasses", 10);
        int  serializeN = Integer.getInteger("bench.serializeN", 100000);
        long base       = 1600000000000L;
        // Spread the records over ~24 months so the GROUP_BY phases build a
        // realistic number of buckets instead of one.
        long spread     = 63072000000L / n;

        System.out.println("BENCH n=" + n + " getterPasses=" + passes
          + " serializeN=" + serializeN
          + " dateProps=3"
          + " maxHeapMB=" + ( Runtime.getRuntime().maxMemory() / 1048576 ));

        // ---- op 1: create (setter path) ----
        long heap0 = settleHeap();
        startPhase();
        List<DateTimeTestModel> list = new ArrayList<>(n);
        for ( int i = 0 ; i < n ; i++ ) {
          DateTimeTestModel o = new DateTimeTestModel();
          long m = base + i * spread;
          o.setId(i + 1);
          o.setEventName("event" + i);
          o.setRegularDateTime(new Date(m));
          o.setUtcDateTime(new Date(m + 1));
          o.setRegularDate(new Date(m + 2));
          list.add(o);
        }
        endPhase("create", "records=" + n);

        long heapList = settleHeap();
        long recordBytes = heapList - heap0;
        System.out.println("BENCH phase=heapRecords heapMB=" + ( recordBytes / 1048576 )
          + " bytesPerRecord=" + ( recordBytes / n )
          + " bytesPerDateField=" + ( recordBytes / n / 3 ));

        // ---- op 2: getter reads ----
        startPhase();
        long sum = 0;
        for ( int p = 0 ; p < passes ; p++ ) {
          for ( int i = 0 ; i < n ; i++ ) {
            DateTimeTestModel o = list.get(i);
            sum += o.getRegularDateTime().getTime();
            sum += o.getUtcDateTime().getTime();
            sum += o.getRegularDate().getTime();
          }
        }
        endPhase("getters", "reads=" + ( (long) n * passes * 3 ) + " checksum=" + sum);

        // ---- op 3: fclone ----
        startPhase();
        long cloneAcc = 0;
        int  cloneMismatches = 0;
        for ( int i = 0 ; i < n ; i++ ) {
          DateTimeTestModel src = list.get(i);
          DateTimeTestModel c   = (DateTimeTestModel) src.fclone();
          if ( c.getRegularDate().getTime() != src.getRegularDate().getTime() ||
               c.getRegularDateTime().getTime() != src.getRegularDateTime().getTime() ) {
            cloneMismatches++;
          }
          cloneAcc += c.getRegularDate().getTime();
        }
        endPhase("fclone", "clones=" + n + " checksum=" + cloneAcc);

        // ---- op 4: MDAO put ----
        DAO dao = new MDAO(DateTimeTestModel.getOwnClassInfo());
        startPhase();
        for ( int i = 0 ; i < n ; i++ ) dao.put(list.get(i));
        endPhase("mdaoPut", "records=" + n);
        long heapDao = settleHeap();
        System.out.println("BENCH phase=heapMdao heapMB="
          + ( ( heapDao - heapList ) / 1048576 ));

        // ---- op 5: date-ordered select ----
        startPhase();
        ArraySink ordered = (ArraySink) dao.select_(getX(), new ArraySink(), 0,
          Long.MAX_VALUE, DateTimeTestModel.REGULAR_DATE, null);
        endPhase("orderedSelect", "rows=" + ordered.getArray().size());

        // ---- op 6: date range predicate select ----
        Date from = new Date(base);
        Date to   = new Date(base + ( spread * n / 2 ));
        startPhase();
        ArraySink ranged = (ArraySink) dao.select_(getX(), new ArraySink(), 0,
          Long.MAX_VALUE, null,
          AND(
            GTE(DateTimeTestModel.REGULAR_DATE, from),
            LTE(DateTimeTestModel.REGULAR_DATE, to)));
        endPhase("rangeSelect", "rows=" + ranged.getArray().size());

        // ---- op 7: GROUP_BY on the raw date key ----
        startPhase();
        GroupBy byDate = (GroupBy) dao.select(
          GROUP_BY(DateTimeTestModel.REGULAR_DATE, COUNT()));
        endPhase("groupByDate", "groups=" + byDate.getGroups().size());

        // ---- op 8: GROUP_BY on a date expression (year/month buckets) ----
        DateToYYYYMMExpr month = new DateToYYYYMMExpr.Builder(getX())
          .setDelegate(DateTimeTestModel.REGULAR_DATE)
          .build();
        startPhase();
        GroupBy byMonth = (GroupBy) dao.select(GROUP_BY(month, COUNT()));
        endPhase("groupByMonthExpr", "groups=" + byMonth.getGroups().size());

        // ---- op 9: JSON output (journal write path) ----
        Outputter out = new Outputter(getX());
        startPhase();
        long jsonChars = 0;
        for ( int i = 0 ; i < serializeN ; i++ ) {
          jsonChars += out.stringify(list.get(i)).length();
        }
        endPhase("jsonOutput", "records=" + serializeN + " chars=" + jsonChars);

        // ---- op 10: JSON parse (journal replay path) ----
        String[] wire = new String[serializeN];
        for ( int i = 0 ; i < serializeN ; i++ ) wire[i] = out.stringify(list.get(i));
        startPhase();
        long parsedAcc = 0;
        for ( int i = 0 ; i < serializeN ; i++ ) {
          DateTimeTestModel o =
            (DateTimeTestModel) new JSONParser().parseString(wire[i]);
          parsedAcc += o.getRegularDate().getTime();
        }
        endPhase("jsonParse", "records=" + serializeN + " checksum=" + parsedAcc);

        // Correctness guards: each phase saw the whole data set and read back
        // the values it was given.
        test(ordered.getArray().size() == n,
          "orderedSelect returned all " + n + " records");
        test(ranged.getArray().size() > 0 && ranged.getArray().size() < n,
          "rangeSelect filtered a strict subset (got " + ranged.getArray().size() + ")");
        test(byDate.getGroups().size() > 1,
          "groupByDate produced multiple day buckets (got " + byDate.getGroups().size() + ")");
        test(byMonth.getGroups().size() > 1,
          "groupByMonthExpr produced multiple month buckets (got "
          + byMonth.getGroups().size() + ")");
        test(cloneMismatches == 0,
          "fclone preserved every date value (" + cloneMismatches + " mismatches)");
        test(parsedAcc != 0, "jsonParse read dates back");
        test(sum != 0, "getter checksum non-zero");
      `
    }
  ]
});
