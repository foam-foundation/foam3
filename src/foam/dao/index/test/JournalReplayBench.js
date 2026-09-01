/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.index.test',
  name: 'JournalReplayBench',
  extends: 'foam.core.test.PhaseBench',

  documentation: `Replay the same journal file two ways and compare.

    Replaying row by row descends into the index once per entry and clones the
    path it descends, and looks each entry up in the tree first so a repeated id
    can be merged onto the row already there. Staging the rows instead makes both
    of those cheaper: the lookup becomes a hash lookup, and the index is built
    from every row at once when the replay ends.

    The two lanes run in the same JVM off the same file, so nothing but the
    mechanism differs and no second build is needed to compare them. The bulk
    lane is split into the replay and the build so the cost of each is separate.

    The journal is written once and reused, keyed by record count, so only the
    first run pays for it. Both lanes are checked against each other afterwards -
    a lane that lost rows would otherwise read as the fast one.

    Tunables (system properties):
      -Dbench.n=<records>       default 1000000
      -Dbench.replayRepeats=<n> default 3
      -Dbench.rewrite=true      write the journal again even if it is there`,

  javaImports: [
    'foam.core.auth.Subject',
    'foam.core.auth.User',
    'foam.core.fs.FileSystemStorage',
    'foam.core.fs.Storage',
    'foam.dao.ArraySink',
    'foam.dao.F3FileJournal',
    'foam.dao.MDAO',
    'foam.dao.ReadOnlyF3FileJournal',
    'foam.lang.FObject',
    'foam.lang.X',
    'foam.mlang.sink.Count',
    'java.io.File',
    'java.util.Date',
    'java.util.List',
    'static foam.mlang.MLang.COUNT',
    'static foam.mlang.MLang.EQ',
    'static foam.mlang.MLang.GROUP_BY'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        String[] histoMatch = { "foam.dao.index.TreeNode", "java.lang.Long", "java.util.Date" };

        int n       = Integer.getInteger("bench.n", 1000000);
        int repeats = Integer.getInteger("bench.replayRepeats", 3);

        String name = "journalReplayBench-" + n;
        String root = System.getProperty("java.io.tmpdir") + File.separator + "foam-journal-bench";
        new File(root).mkdirs();

        // A journal resolves its file through Storage on replay and through
        // FileSystemStorage on write, so both keys have to be bound, and the
        // writer wants a subject. A user with id 1 keeps comment lines out.
        FileSystemStorage storage = new FileSystemStorage(root);
        User u = new User();
        u.setId(1);
        Subject subject = new Subject();
        subject.setUser(u);

        X jx = x.put(FileSystemStorage.class, storage)
                .put(Storage.class, storage)
                .put("subject", subject);

        System.out.println("BENCH n=" + n
          + " replayRepeats=" + repeats
          + " journal=" + root + File.separator + name
          + " maxHeapMB=" + ( Runtime.getRuntime().maxMemory() / 1048576 ));

        writeJournal(jx, storage, name, n);

        File f = storage.get(name);
        System.out.println("BENCH phase=journalFile bytes=" + ( f == null ? -1 : f.length() )
          + " bytesPerRecord=" + ( f == null ? -1 : f.length() / n ));

        // ---- one of each, sized and fingerprinted --------------------------
        // A DAO of this size is most of the heap, so the two lanes are measured
        // one at a time and released. Holding both would leave the second lane
        // running against a heap the first one filled, which is enough on its own
        // to move a phase by seconds.
        long h0 = settleHeap();
        MDAO perRow = fresh();
        startPhase();
        replay(jx, name, perRow);
        endPhase("replayPerRowSized", "records=" + n);
        long h1 = settleHeap();
        System.out.println("BENCH phase=heapPerRow heapMB=" + ( ( h1 - h0 ) / 1048576 )
          + " bytesPerRecord=" + ( ( h1 - h0 ) / n ));
        classHistogram("replayPerRow", histoMatch);

        String perRowPrint = fingerprint(x, perRow, n);
        perRow = null;

        long h2 = settleHeap();
        MDAO bulk = fresh();
        startPhase();
        bulk.beginBulkLoad();
        replay(jx, name, bulk);
        endPhase("replayBulkStageSized", "records=" + n);

        // What staging costs while it is open: the rows plus the map holding
        // them, with no index built yet. This is the figure the approach has to
        // justify, and it is only visible between the two phases.
        long hStaged = settleHeap();
        System.out.println("BENCH phase=heapStagedPeak heapMB=" + ( ( hStaged - h2 ) / 1048576 )
          + " bytesPerRecord=" + ( ( hStaged - h2 ) / n ));

        startPhase();
        bulk.endBulkLoad();
        endPhase("replayBulkBuildSized", "records=" + n);
        long h3 = settleHeap();
        System.out.println("BENCH phase=heapBulk heapMB=" + ( ( h3 - h2 ) / 1048576 )
          + " bytesPerRecord=" + ( ( h3 - h2 ) / n ));
        classHistogram("replayBulk", histoMatch);

        String bulkPrint = fingerprint(x, bulk, n);
        bulk = null;

        // A lane that lost rows would otherwise read as the fast one.
        test(perRowPrint.startsWith(n + "|"),
          "the row-by-row replay holds every record; got " + perRowPrint);
        test(perRowPrint.equals(bulkPrint),
          "both replays hold the same rows; row-by-row " + perRowPrint + " and staged " + bulkPrint);

        // ---- timed, interleaved, retaining nothing --------------------------
        // The two lanes alternate within a round rather than running one after
        // the other, so whatever the machine is doing over the run - warming up,
        // throttling, another process - lands on both of them equally. Each
        // round starts from a collected heap and drops its DAO at the end.
        for ( int i = 0 ; i <= repeats ; i++ ) {
          MDAO perRowRound = fresh();
          settleHeap();
          startPhase();
          replay(jx, name, perRowRound);
          endPhase("replayPerRow", "iter=" + i + " records=" + n);

          MDAO bulkRound = fresh();
          settleHeap();
          startPhase();
          bulkRound.beginBulkLoad();
          replay(jx, name, bulkRound);
          endPhase("replayBulkStage", "iter=" + i + " records=" + n);

          startPhase();
          bulkRound.endBulkLoad();
          endPhase("replayBulkBuild", "iter=" + i + " records=" + n);
        }
      `
    },

    {
      name: 'writeJournal',
      args: 'X jx, foam.core.fs.FileSystemStorage storage, String name, int n',
      documentation: `Write n entries once. The rows and the DAO the writer needs
        are local to this method so they can be collected before anything is
        measured.`,
      javaCode: `
        File f = storage.get(name);
        if ( f != null && f.exists() && f.length() > 0 && ! Boolean.getBoolean("bench.rewrite") ) {
          System.out.println("BENCH reusing the journal already written for n=" + n);
          return;
        }
        if ( f != null && f.exists() ) f.delete();

        long spread = 63072000000L / n;

        MDAO sink = fresh();
        F3FileJournal w = new F3FileJournal.Builder(jx)
          .setDao(sink)
          .setFilename(name)
          .setCreateFile(true)
          .build();

        startPhase();
        for ( int i = 0 ; i < n ; i++ ) w.put(jx, "", sink, row(i, spread));
        try { w.getWriter().flush(); } catch ( Throwable t ) { t.printStackTrace(); }
        endPhase("writeJournal", "records=" + n);
      `
    },

    {
      name: 'replay',
      args: 'X jx, String name, foam.dao.MDAO into',
      documentation: 'A read-only journal, so replaying opens no writer.',
      javaCode: `
        new ReadOnlyF3FileJournal.Builder(jx).setFilename(name).build().replay(jx, into);
      `
    },

    {
      name: 'fresh',
      type: 'foam.dao.MDAO',
      documentation: 'An MDAO configured the way JDAO configures one for replay.',
      javaCode: `
        MDAO m = new MDAO(IndexKeyRecord.getOwnClassInfo());
        m.setSafeMode(false);
        return m;
      `
    },

    {
      name: 'row',
      args: 'int i, long spread',
      type: 'foam.dao.index.test.IndexKeyRecord',
      javaCode: `
        IndexKeyRecord r = new IndexKeyRecord();
        r.setId(i + 1);
        r.setGroupId(i % 1000);
        r.setName("n" + ( i % 5000 ));
        r.setWhen(new Date(1600000000000L + i * spread));
        return r;
      `
    },

    {
      name: 'fingerprint',
      args: 'X x, foam.dao.MDAO dao, int n',
      type: 'String',
      documentation: `What a replay produced, small enough to keep after the DAO
        is released: the row count, the first page in id order, and a spread of
        ids sampled across the range.`,
      javaCode: `
        StringBuilder sb = new StringBuilder();
        sb.append(((Count) dao.inX(x).select(new Count())).getValue()).append('|');

        List rows = ((ArraySink) dao.inX(x).orderBy(IndexKeyRecord.ID).limit(25)
          .select(new ArraySink())).getArray();
        for ( Object o : rows ) sb.append(((IndexKeyRecord) o).getId()).append(',');

        sb.append('|');
        for ( long id = 1 ; id <= n ; id += 1 + n / 50 ) {
          sb.append(dao.inX(x).find(id) == null ? '.' : '#');
        }
        return sb.toString();
      `
    }
  ]
});
