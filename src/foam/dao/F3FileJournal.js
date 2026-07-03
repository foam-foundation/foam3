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
        if ( jrlStorage instanceof foam.core.fs.FileSystemStorage ) {
          java.io.File jrlFile = jrlStorage.get(getFilename());
          if ( jrlFile != null && jrlFile.isDirectory() ) {
            getLogger().warning("Journal path is a directory; skipping replay", getFilename());
            return;
          }
        }

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
 //       AssemblyLine assemblyLine = new foam.util.concurrent.SyncAssemblyLine();
        // CSpec DAO sometimes gets deadlocks with AsyncAssemblyLine for some unknown reason
        AssemblyLine assemblyLine = dao.getOf().getObjClass() == foam.core.boot.CSpec.class ?
          new foam.util.concurrent.SyncAssemblyLine() :
          new foam.util.concurrent.BatchingAssemblyLine(new foam.util.concurrent.SimpleAsyncAssemblyLine(x, "replay")) ;

        boolean threw = false;
        try ( BufferedReader reader = getReader() ) {
          if ( reader == null ) {
            return;
          }

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
                FObject obj;

                public void executeJob() {
                  obj = getParser(parseX).parseString(strEntry, cls);
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
                      foam.lang.FObject old = dao.find(obj.getProperty("id"));
                      dao.put(old != null ? mergeFObject(old.fclone(), obj) : obj);
                      break;

                    case OP_REMOVE:
                      dao.remove(obj);
                      break;
                  }
                  long pass = passCount.incrementAndGet();
                  // Provide some feedback on long running replays
                  if ( pass % 100000 == 0 ) {
                    String msg = String.format("progress,%1$s,processed,%2$d,in,%3$s", getFilename(), pass, Duration.ofMillis(pm.getTime()));
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
          assemblyLine.shutdown();
          pm.log(x);
          setLastReplayVersion(lastVersion);
          if ( threw )
            return;
          setPassCount(passCount.get());
          setFailCount(failCount.get());
          String msg = String.format("complete,%1$s,processed,%2$d,of,%3$d,in,%4$s", getFilename(), passCount.get(), failCount.get()+passCount.get(), Duration.ofMillis(pm.getTime()));
          if ( cspec != null )
            cspec.updateStatus(CSpecStatus.REPLAYING, "Replay", msg);
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
