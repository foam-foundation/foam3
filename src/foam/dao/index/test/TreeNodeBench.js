/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.index.test',
  name: 'TreeNodeBench',
  extends: 'foam.core.test.PhaseBench',

  documentation: `Per-operation heap and CPU benchmark for the MDAO tree index.

    An index holds one node per record per index, and each node used to retain a
    boxed copy of the record's key. Sizing that means counting the nodes and the
    boxes, not reading a heap total: a class histogram gives instance count and
    retained bytes per class directly, so the node change can be attributed
    rather than inferred.

    Read the paged-select phase as the one that matters for latency. A full scan
    of a million rows is not something a UI does; a table asks for a page.

    Run the same command on two builds and diff the BENCH and HISTO lines. Every
    BENCH line is key=value so the phases compare mechanically. Select phases
    repeat because the first pass is compilation noise and can reverse the sign
    of a small difference.

    Tunables (system properties):
      -Dbench.n=<records>       default 1000000
      -Dbench.selectRepeats=<n> default 8
      -Dbench.pageSize=<rows>   default 25`,

  javaImports: [
    'foam.dao.ArraySink',
    'foam.dao.MDAO',
    'foam.lang.FObject',
    'foam.mlang.sink.Count',
    'foam.mlang.sink.GroupBy',
    'java.util.ArrayList',
    'java.util.Date',
    'java.util.List',
    'static foam.mlang.MLang.COUNT',
    'static foam.mlang.MLang.EQ',
    'static foam.mlang.MLang.GROUP_BY',
    'static foam.mlang.MLang.GTE',
    'static foam.mlang.MLang.LTE'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        // The classes worth counting: the nodes themselves, the boxed keys a
        // node used to retain, and Dates for the same reason.
        String[] histoMatch = { "foam.dao.index.TreeNode", "java.lang.Long", "java.util.Date" };

        int n       = Integer.getInteger("bench.n", 1000000);
        int repeats = Integer.getInteger("bench.selectRepeats", 8);
        int page    = Integer.getInteger("bench.pageSize", 25);

        // Spread the dates over roughly two years so a range predicate and a
        // group-by build real buckets instead of one.
        long spread = 63072000000L / n;

        System.out.println("BENCH n=" + n
          + " selectRepeats=" + repeats
          + " pageSize=" + page
          + " maxHeapMB=" + ( Runtime.getRuntime().maxMemory() / 1048576 ));

        // ---- records only, no index -------------------------------------
        long h0 = settleHeap();
        startPhase();
        List<IndexKeyRecord> rows = new ArrayList<IndexKeyRecord>(n);
        for ( int i = 0 ; i < n ; i++ ) {
          IndexKeyRecord r = new IndexKeyRecord();
          r.setId(i + 1);
          r.setGroupId(i % 1000);
          r.setName("n" + ( i % 5000 ));
          r.setWhen(new Date(1600000000000L + i * spread));
          rows.add(r);
        }
        endPhase("create", "records=" + n);
        long h1 = settleHeap();
        System.out.println("BENCH phase=heapRecords heapMB=" + ( ( h1 - h0 ) / 1048576 )
          + " bytesPerRecord=" + ( ( h1 - h0 ) / n ));

        // ---- primary index only -----------------------------------------
        MDAO primary = null;
        for ( int i = 0 ; i <= repeats ; i++ ) {
          MDAO m = new MDAO(IndexKeyRecord.getOwnClassInfo());
          startPhase();
          for ( int j = 0 ; j < n ; j++ ) m.put_(x, rows.get(j));
          endPhase("putPrimary", "iter=" + i + " records=" + n);
          if ( primary == null ) primary = m;
        }
        long h2 = settleHeap();
        System.out.println("BENCH phase=heapPrimaryIndex heapMB=" + ( ( h2 - h1 ) / 1048576 )
          + " bytesPerNode=" + ( ( h2 - h1 ) / n ));
        classHistogram("primaryIndex", histoMatch);

        // ---- a secondary index on a low-cardinality Long ----------------
        // Built repeats+1 times: the first is measured cold alongside the heap
        // reading, the rest give the write cost a settled figure.
        MDAO secondary = null;
        for ( int i = 0 ; i <= repeats ; i++ ) {
          MDAO m = new MDAO(IndexKeyRecord.getOwnClassInfo());
          m.addIndex(IndexKeyRecord.GROUP_ID);
          startPhase();
          for ( int j = 0 ; j < n ; j++ ) m.put_(x, rows.get(j));
          endPhase("putSecondary", "iter=" + i + " records=" + n);
          if ( secondary == null ) secondary = m;
        }
        long h3 = settleHeap();
        System.out.println("BENCH phase=heapSecondaryIndex heapMB=" + ( ( h3 - h2 ) / 1048576 ));
        classHistogram("secondaryIndex", histoMatch);

        // ---- reads, repeated: first pass is compilation noise ------------
        for ( int i = 0 ; i < repeats ; i++ ) {
          startPhase();
          long found = 0;
          for ( int j = 1 ; j <= n ; j += 97 ) {
            if ( primary.inX(x).find((long) j) != null ) found++;
          }
          endPhase("findById", "iter=" + i + " found=" + found);
        }

        for ( int i = 0 ; i < repeats ; i++ ) {
          startPhase();
          ArraySink sink = (ArraySink) primary.inX(x)
            .orderBy(IndexKeyRecord.WHEN).select(new ArraySink());
          endPhase("orderedSelect", "iter=" + i + " rows=" + sink.getArray().size());
        }

        // The access pattern a table actually uses.
        for ( int i = 0 ; i < repeats ; i++ ) {
          startPhase();
          ArraySink first = (ArraySink) primary.inX(x)
            .orderBy(IndexKeyRecord.WHEN).limit(page).select(new ArraySink());
          ArraySink deep  = (ArraySink) primary.inX(x)
            .orderBy(IndexKeyRecord.WHEN).skip(n / 2).limit(page).select(new ArraySink());
          endPhase("pagedSelect", "iter=" + i
            + " firstPage=" + first.getArray().size()
            + " deepPage=" + deep.getArray().size());
        }

        Date lo = new Date(1600000000000L + ( n / 4 ) * spread);
        Date hi = new Date(1600000000000L + ( 3L * n / 4 ) * spread);
        for ( int i = 0 ; i < repeats ; i++ ) {
          startPhase();
          Count c = (Count) primary.inX(x)
            .where(foam.mlang.MLang.AND(GTE(IndexKeyRecord.WHEN, lo), LTE(IndexKeyRecord.WHEN, hi)))
            .select(new Count());
          endPhase("rangeSelect", "iter=" + i + " rows=" + c.getValue());
        }

        for ( int i = 0 ; i < repeats ; i++ ) {
          startPhase();
          GroupBy g = (GroupBy) secondary.inX(x)
            .select(GROUP_BY(IndexKeyRecord.GROUP_ID, COUNT()));
          endPhase("groupByIndexed", "iter=" + i + " groups=" + g.getGroups().size());
        }

        for ( int i = 0 ; i < repeats ; i++ ) {
          startPhase();
          long hits = 0;
          for ( int j = 0 ; j < 1000 ; j++ ) {
            Count c = (Count) secondary.inX(x)
              .where(EQ(IndexKeyRecord.GROUP_ID, (long) j)).select(new Count());
            hits += c.getValue();
          }
          endPhase("eqOnSecondary", "iter=" + i + " hits=" + hits);
        }

        // ---- removal: the path that substitutes a key between nodes ------
        for ( int i = 0 ; i < repeats ; i++ ) {
          MDAO m = new MDAO(IndexKeyRecord.getOwnClassInfo());
          m.addIndex(IndexKeyRecord.GROUP_ID);
          for ( int j = 0 ; j < n ; j++ ) m.put_(x, rows.get(j));
          startPhase();
          for ( int j = 0 ; j < n ; j += 2 ) m.inX(x).remove(rows.get(j));
          endPhase("removeHalf", "iter=" + i + " removed=" + ( ( n + 1 ) / 2 ));
        }
        startPhase();
        for ( int i = 0 ; i < n ; i += 2 ) secondary.inX(x).remove(rows.get(i));
        endPhase("removeHalfMeasuredHeap", "removed=" + ( ( n + 1 ) / 2 ));
        long h4 = settleHeap();
        System.out.println("BENCH phase=heapAfterRemove heapMB=" + ( ( h4 - h3 ) / 1048576 ));
        classHistogram("afterRemove", histoMatch);

        // The bench doubles as a smoke test: a wrong tree would show up here
        // rather than as a plausible-looking timing.
        long remaining = ((Count) secondary.inX(x).select(new Count())).getValue();
        test(remaining == n - ( n + 1 ) / 2,
          "removeHalf left the expected row count; got " + remaining);
        test(((Count) primary.inX(x).select(new Count())).getValue() == n,
          "the primary index still holds every row");
      `
    }
  ]
});
