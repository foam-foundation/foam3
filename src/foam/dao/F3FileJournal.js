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
    'foam.core.boot.CSpec',
    'foam.core.boot.CSpecStatus',
    'foam.core.pm.PM',
    'foam.lang.FObject',
    'foam.lib.json.JSONParser',
    'foam.util.concurrent.AbstractAssembly',
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
      name: 'createReplayLine',
      documentation: `The AssemblyLine a replay parses and applies through.

        Into a BulkLoadDAO (the private staging map a JDAO replays into before
        the MDAO bulk-loads it) the apply stage is sharded: one thread per two
        parse threads, each applying the entries whose id hashes to it, so one
        id is always applied by one thread in journal order.
        Any other target keeps one apply thread, because a decorator on it may
        have side effects across rows; that includes a BulkLoadDAO wrapped by
        NDiffJournal in an NDiffDAO. Extension point for a subclass that wants
        another shape.`,
      args: 'Context x, foam.dao.DAO dao',
      type: 'foam.util.concurrent.AssemblyLine',
      javaCode: `
        // CSpec DAO sometimes gets deadlocks with AsyncAssemblyLine for some unknown reason
        if ( dao.getOf().getObjClass() == foam.core.boot.CSpec.class )
          return new foam.util.concurrent.SyncAssemblyLine();
        if ( dao instanceof foam.dao.BulkLoadDAO ) {
          int threads = Math.max(1, Runtime.getRuntime().availableProcessors() - 1);
          return new foam.util.concurrent.BatchingAssemblyLine(new foam.util.concurrent.SimpleAsyncAssemblyLine(x, "replay", threads, Math.max(1, threads / 2)));
        }
        return new foam.util.concurrent.BatchingAssemblyLine(new foam.util.concurrent.SimpleAsyncAssemblyLine(x, "replay"));
      `
    },
    {
      name: 'replay',
      documentation: 'Replays the journal file',
      args: 'Context x, foam.dao.DAO dao',
      javaCode: `
        // count number of entries successfully read
        AtomicInteger passCount = new AtomicInteger();
        AtomicInteger failCount = new AtomicInteger();
        Class         cls       = dao.getOf().getObjClass();

        String lastVersion = "";

        CSpec cspec = (CSpec)getX().get(CSpec.CSPEC_CTX_KEY);
        if ( cspec != null )
          cspec.updateStatus(CSpecStatus.REPLAYING, "Replay", "start", getFilename());
        else
          getLogger().info("Replay starting");

        // A journal path that resolves to a directory is not a journal to read
        // (e.g. a sibling PartitionedDAO nests its per-partition files under a
        // directory of the same base name). Skip it rather than crash on read.
        // Only check FileSystemStorage — ResourceStorage.get() can't produce a
        // File for a jar resource (and a jar has no directory-journals anyway).
        foam.core.fs.Storage jrlStorage = (foam.core.fs.Storage) getX().get(foam.core.fs.Storage.class);
        java.io.File jrlFile = jrlStorage instanceof foam.core.fs.FileSystemStorage ? jrlStorage.get(getFilename()) : null;
        if ( jrlFile != null && jrlFile.isDirectory() ) {
          getLogger().warning("Journal path is a directory; skipping replay", getFilename());
          return;
        }
        // Denominator of the progress percentage; 0 (unknown) for a jar resource.
        final long totalBytes = jrlFile != null ? jrlFile.length() : 0;

        // Pre-compute the parser X context once per replay. When the target
        // ClassInfo has no backing Java class (getObjClass() is null), thread
        // the ClassInfo itself through X so the parser can instantiate via
        // ci.newInstance() for entries that omit the class: prefix.
        final foam.lang.X parseX0;
        if ( dao.getOf().getObjClass() == null ) {
          getLogger().warning("Class not found for of, falling back to defaultClassInfo", dao.getOf().getId());
          parseX0 = x.put("defaultClassInfo", dao.getOf());
        } else {
          parseX0 = x;
        }
        // One StringInterner per replay: a parsed string seen twice is shared by
        // every record of the replay, and the interner's maps die with it.
        final foam.util.StringInterner interner = new foam.util.StringInterner();
        final foam.lang.X parseX = parseX0.put(foam.util.StringInterner.CTX_KEY, interner);

        // NOTE: explicitly calling PM constructor as create only creates
        // a percentage of PMs, but we want all replay statistics
        PM pm = new PM(dao.getOf(), "replay." + getFilename());
        // Built once the file is open, so a missing journal starts no threads.
        AssemblyLine assemblyLine = null;

        boolean threw = false;
        try ( BufferedReader reader = getReader() ) {
          if ( reader == null ) {
            return;
          }
          assemblyLine = createReplayLine(x, dao);

          for ( CharSequence entry ; ( entry = getEntry(reader) ) != null ; ) {
            int length = entry.length();
            if ( length == 0 ) continue;
            // Fast comment check: every comment starts with '/', which is never
            // the first char of a data entry ('c', 'p', 'r', 'v'). getEntry reads
            // line-by-line and only accumulates OPEN_PUT/CREATE/REMOVE blocks, so
            // multi-line block comments were never skipped by the COMMENT regex
            // either (its closing '*/' never lands on the opening line) — this
            // charAt check is a strict superset of the single-line cases the regex
            // actually matched, at no per-entry Matcher allocation.
            if ( entry.charAt(0) == '/' ) continue;
            if ( length < 3 ) {
              // Don't bother reporting lines with just spaces
              if ( entry.toString().trim().length() != 0 ) {
                getLogger().warning("Malformed journal entry", entry);
              }
              continue;
            }
            try {
              final char operation  = entry.charAt(0);
              final String strEntry = entry.subSequence(2, length - 1).toString();

              if ( operation == OP_VERSION ) {
                JSONObject obj = new JSONObject(strEntry);
                lastVersion = (String) obj.get("version");
                continue;
              }

              class F3Assembly extends AbstractAssembly {
                FObject  obj;
                Object[] locks;

                public void executeJob() {
                  obj = getParser(parseX).parseString(strEntry, cls);
                  if ( obj != null ) locks = new Object[] { obj.getProperty("id") };
                }

                // Entries for one id must end in journal order; a sharded line
                // keys its shard on this, asking once per shard, so the id is
                // read once when the entry is parsed.
                public Object[] requestLocks() {
                  return locks;
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
                    case OP_PUT:
                      foam.lang.FObject old = dao.find(locks[0]);
                      dao.put(old != null ? mergeFObject(old.fclone(), obj) : obj);
                      break;

                    case OP_REMOVE:
                      dao.remove(obj);
                      break;
                  }
                  long pass = passCount.incrementAndGet();
                  // Provide some feedback on long running replays
                  if ( pass % 100000 == 0 ) {
                    // Bytes read run ahead of entries processed by the reader's
                    // buffer, and a journal appended to mid-replay outgrows its
                    // starting size, so cap the percentage at 100 and the
                    // bytes left at 0.
                    long read    = getReplayBytesRead().get();
                    long elapsed = pm.getTime();
                    long percent = totalBytes > 0 ? Math.min(100, 100 * read / totalBytes) : -1;
                    // Time left at the average rate so far.
                    long left    = percent < 0 || read == 0 ? -1 : (long) (elapsed * (double) Math.max(0, totalBytes - read) / read);
                    String msg = String.format("progress,%1$s,processed,%2$d,%3$s,in,%4$s,eta,%5$s", getFilename(), pass, percent < 0 ? "?" : percent + "%", Duration.ofMillis(elapsed), left < 0 ? "?" : Duration.ofMillis(left));
                    if ( cspec != null )
                      cspec.updateStatus(CSpecStatus.REPLAYING, "Replay", msg);
                    else
                      getLogger().info("Replay", msg);
                    if ( Thread.currentThread().isInterrupted() ) {
                      getLogger().info("Replay interrupted");
                      return;
                    }
                  }
                }
              } // class

              assemblyLine.enqueue(new F3Assembly());
            } catch ( Throwable t ) {
              getLogger().error("Error replaying journal", dao.getOf().getId(), entry, t);
            }
          }

        } catch ( Throwable t) {
          threw = true;
          if ( cspec != null )
            cspec.updateStatus(CSpecStatus.REPLAYING, "Replay", getFilename(), "Failed to read journal", dao.getOf().getId(), t);
          else
            getLogger().error("Failed to read journal", dao.getOf().getId(), t);
        } finally {
          if ( assemblyLine != null ) assemblyLine.shutdown();
          pm.log(x);
          setLastReplayVersion(lastVersion);
          if ( threw )
            return;
          setPassCount(passCount.get());
          setFailCount(failCount.get());
          if ( interner.calls() > 0 ) getLogger().info("Replay", "intern", interner.summary());
          interner.release();
          String msg = String.format("complete,%1$s,processed,%2$d,of,%3$d,in,%4$s", getFilename(), passCount.get(), failCount.get()+passCount.get(), Duration.ofMillis(pm.getTime()));
          // The reload of an unloadable dao replays with no initService to
          // write READY afterwards, so the replay itself hands the status back.
          if ( cspec != null )
            cspec.updateStatus(CSpecStatus.READY, "Replay", msg);
          else {
            if ( getFailCount() == 0 ) {
              getLogger().info("Replay", msg);
            } else {
              getLogger().warning("Replay", msg);
            }
          }
        }
      `
    }
  ]
});
