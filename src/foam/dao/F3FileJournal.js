/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao',
  name: 'F3FileJournal',
  extends: 'foam.dao.AbstractF3FileJournal',
  flags: ['java'],

  implements: [
    'foam.dao.Journal'
  ],

  javaImports: [
    'foam.lang.FObject',
    'foam.lib.json.JSONParser',
    'foam.core.pm.PM',
    'foam.util.concurrent.AssemblyLine',
    'foam.util.SafetyUtil',
    'java.io.BufferedReader',
    'java.time.Duration',
    'java.util.concurrent.atomic.AtomicInteger',
    'org.json.JSONObject'
  ],

  properties: [
    {
      class: 'foam.dao.DAOProperty',
      name: 'dao'
    },
    {
      documentation: 'Report of successfully processed lines during last replay',
      class: 'Int',
      name: 'passCount'
    },
    {
      documentation: 'Report of unsuccessfully processed lines during last replay',
      class: 'Int',
      name: 'failCount'
    },
    {
      class: 'String',
      name: 'lastReplayVersion',
      documentation: 'Last recorded version in journal file used by jdao after replay to check against current version'
    }
  ],

  methods: [
    {
      name: 'replay',
      documentation: 'Replays the journal file',
      args: 'Context x, foam.dao.DAO dao',
      javaCode: `
        // count number of entries successfully read
        AtomicInteger passCount = new AtomicInteger();
        AtomicInteger failCount = new AtomicInteger();

        // Per-phase timing accumulators. Plain long[] holders are safe
        // because SyncAssemblyLine runs executeJob/endJob on the caller
        // thread. Switch to LongAdder if replay ever moves to an async line.
        final long[] entryNanos     = new long[1];
        final long[] parseNanos     = new long[1];
        final long[] findMergeNanos = new long[1];
        final long[] daoWriteNanos  = new long[1];
        final long[] opCreate       = new long[1];
        final long[] opPut          = new long[1];
        final long[] opPutMerged    = new long[1];
        final long[] opRemove       = new long[1];
        long commentsSkipped = 0;

        String lastVersion = "";

        getLogger().info("Replay starting");

        // Pre-compute the parser X context once per replay. When the target
        // ClassInfo has no backing Java class (getObjClass() is null), thread
        // the ClassInfo itself through X so the parser can instantiate via
        // ci.newInstance() for entries that omit the class: prefix.
        final foam.lang.X parseX;
        if ( dao.getOf().getObjClass() == null ) {
          getLogger().warning("Class not found for of, falling back to defaultClassInfo", dao.getOf().getId());
          parseX = x.put("defaultClassInfo", dao.getOf());
        } else {
          parseX = x;
        }

        // NOTE: explicitly calling PM constructor as create only creates
        // a percentage of PMs, but we want all replay statistics
        PM pm = new PM(dao.getOf(), "replay." + getFilename());
        AssemblyLine assemblyLine = new foam.util.concurrent.SyncAssemblyLine();

        try ( BufferedReader reader = getReader() ) {
          if ( reader == null ) {
            return;
          }
          for ( ; ; ) {
            long entryStart = System.nanoTime();
            CharSequence entry = getEntry(reader);
            entryNanos[0] += System.nanoTime() - entryStart;
            if ( entry == null ) break;

            int length = entry.length();
            if ( length == 0 ) continue;
            // Fast comment check: every comment starts with '/', which is
            // never the first char of a data entry ('c', 'p', 'r', 'v').
            // Superset-safe for the block/line comment regex in AbstractF3FileJournal.
            if ( entry.charAt(0) == '/' ) { commentsSkipped++; continue; }
            if ( length < 3 ) {
              // Don't bother reporting lines with just spaces
              if ( entry.toString().trim().length() != 0 ) {
                getLogger().warning("Malformed journal entry", entry);
              }
              continue;
            }
            try {
              final char operation = entry.charAt(0);
              final String strEntry = entry.subSequence(2, length - 1).toString();

              if ( operation == OP_VERSION ) {
                JSONObject obj = new JSONObject(strEntry);
                lastVersion = (String) obj.get("version");
                continue;
              }

              assemblyLine.enqueue(new foam.util.concurrent.AbstractAssembly() {
                FObject obj;

                public void executeJob() {
                  long p0 = System.nanoTime();
                  obj = getParser(parseX).parseString(strEntry, dao.getOf().getObjClass());
                  parseNanos[0] += System.nanoTime() - p0;
                }

                public void endJob(boolean isLast) {
                  if ( obj == null ) {
                    getLogger().error("Parse error in the journal", getParsingErrorMessage(strEntry), "entry Object is: ", strEntry);
                    failCount.incrementAndGet();
                    return;
                  }
                  switch ( operation ) {
                    case OP_CREATE: // Workaround: treat c as p so that duplicate IDs
                                    // across journals are merged instead of silently dropped.
                                    // Real fix: make honorCreate configurable at EasyDAO level.
                    case OP_PUT: {
                      long f0 = System.nanoTime();
                      foam.lang.FObject old = dao.find(obj.getProperty("id"));
                      foam.lang.FObject toWrite = old != null ? mergeFObject(old.fclone(), obj) : obj;
                      findMergeNanos[0] += System.nanoTime() - f0;
                      long w0 = System.nanoTime();
                      dao.put(toWrite);
                      daoWriteNanos[0] += System.nanoTime() - w0;
                      if ( operation == OP_CREATE ) opCreate[0]++;
                      else if ( old != null )       opPutMerged[0]++;
                      else                          opPut[0]++;
                      break;
                    }

                    case OP_REMOVE: {
                      long w0 = System.nanoTime();
                      dao.remove(obj);
                      daoWriteNanos[0] += System.nanoTime() - w0;
                      opRemove[0]++;
                      break;
                    }
                  }
                  long pass = passCount.incrementAndGet();
                  // Provide some feedback on long running replays
                  if ( pass % 10000 == 0 ) {
                    getLogger().info("Replay progress", "processed", pass, "in", Duration.ofMillis(pm.getTime()));
                    if ( Thread.currentThread().isInterrupted() ) {
                      getLogger().info("Replay interrupted");
                      return;
                    }
                  }
                }
              });
            } catch ( Throwable t ) {
              getLogger().error("Error replaying journal", dao.getOf().getId(), entry, t);
            }
          }
        } catch ( Throwable t) {
          getLogger().error("Failed to read journal", dao.getOf().getId(), t);
        } finally {
          setLastReplayVersion(lastVersion);
          setPassCount(passCount.get());
          setFailCount(failCount.get());
          assemblyLine.shutdown();
          pm.log(x);
          logPhasePm_(x, dao, "getEntry",  entryNanos[0]);
          logPhasePm_(x, dao, "parse",     parseNanos[0]);
          logPhasePm_(x, dao, "findMerge", findMergeNanos[0]);
          logPhasePm_(x, dao, "daoWrite",  daoWriteNanos[0]);
          if ( getFailCount() == 0 ) {
            getLogger().info("Replay complete",
              "processed", passCount.get(),
              "of", failCount.get()+passCount.get(),
              "in", Duration.ofMillis(pm.getTime()),
              "opCreate=" + opCreate[0],
              "opPut=" + opPut[0],
              "opPutMerged=" + opPutMerged[0],
              "opRemove=" + opRemove[0],
              "commentsSkipped=" + commentsSkipped);
          } else {
            getLogger().warning("Replay complete",
              "processed", passCount.get(),
              "of", failCount.get()+passCount.get(),
              "in", Duration.ofMillis(pm.getTime()),
              "opCreate=" + opCreate[0],
              "opPut=" + opPut[0],
              "opPutMerged=" + opPutMerged[0],
              "opRemove=" + opRemove[0],
              "commentsSkipped=" + commentsSkipped);
          }
        }
      `
    },
    {
      name: 'logPhasePm_',
      visibility: 'protected',
      args: 'Context x, foam.dao.DAO dao, String phase, long nanos',
      javaCode: `
        // Emit a per-phase PM so replay cost breaks down into its
        // four contributors (getEntry, parse, findMerge, daoWrite) in
        // the aggregate replay statistics.
        if ( nanos <= 0 ) return;
        PM phasePm = new PM(dao.getOf(), "replay." + getFilename() + ":" + phase);
        phasePm.setStartTime(phasePm.getStartTime() - nanos / 1_000_000L);
        phasePm.log(x);
      `
    }
  ]
});
