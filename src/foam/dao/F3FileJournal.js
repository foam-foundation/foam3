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

        String lastVersion = "";

        getLogger().info("Replay starting", getFilename());

        // NOTE: explicitly calling PM constructor as create only creates
        // a percentage of PMs, but we want all replay statistics
        PM pm = new PM(dao.getOf(), "replay." + getFilename());
        AssemblyLine assemblyLine = new foam.util.concurrent.SyncAssemblyLine();

        try ( BufferedReader reader = getReader() ) {
          if ( reader == null ) {
            return;
          }
          for ( CharSequence entry ; ( entry = getEntry(reader) ) != null ; ) {
            int length = entry.length();
            if ( length == 0 ) continue;
            if ( COMMENT.matcher(entry).matches() ) continue;
            if ( length < 3 ) {
              // Don't bother reporting lines with just spaces
              if ( entry.toString().trim().length() != 0 ) {
                System.err.println("Malformed jrl entry " + getFilename() + " : " + entry);
              }
              continue;
            }
            try {
              final char operation = entry.charAt(0);
              final String strEntry = entry.subSequence(2, length - 1).toString();

              if ( operation == 'v' ) {
                JSONObject obj = new JSONObject(strEntry);
                lastVersion = (String) obj.get("version");
                continue;
              }

              assemblyLine.enqueue(new foam.util.concurrent.AbstractAssembly() {
                FObject obj;

                public void executeJob() {
                  obj = getParser(x).parseString(strEntry, dao.getOf().getObjClass());
                }

                public void endJob(boolean isLast) {
                  if ( obj == null ) {
                    getLogger().error("Parse error in the jrl file " + getFilename(), getParsingErrorMessage(strEntry), "entry Object is: ", strEntry);
                    failCount.incrementAndGet();
                    return;
                  }
                  switch ( operation ) {
                    case 'p':
                      foam.lang.FObject old = dao.find(obj.getProperty("id"));
                      dao.put(old != null ? mergeFObject(old.fclone(), obj) : obj);
                      break;

                    case 'r':
                      dao.remove(obj);
                      break;
                  }
                  long pass = passCount.incrementAndGet();
                  // Provide some feedback on long running replays
                  if ( pass % 10000 == 0 ) {
                    getLogger().info("Replay progress", getFilename(), "processed", pass, "in", Duration.ofMillis(pm.getTime()));
                  }
                }
              });
            } catch ( Throwable t ) {
              getLogger().error("Error replaying journal", dao.getOf().getId(), entry, t);
            }
          }
        } catch ( Throwable t) {
          getLogger().error("Failed to read journal", dao.getOf().getId(), getFilename(), t);
        } finally {
          setLastReplayVersion(lastVersion);
          setPassCount(passCount.get());
          setFailCount(failCount.get());
          assemblyLine.shutdown();
          pm.log(x);
          if ( getFailCount() == 0 ) {
            getLogger().info("Replay complete", getFilename(), "processed", passCount.get(), "of", failCount.get()+passCount.get(), "in", Duration.ofMillis(pm.getTime()));
          } else {
            getLogger().warning("Replay complete", getFilename(), "processed", passCount.get(), "of", failCount.get()+passCount.get(), "in", Duration.ofMillis(pm.getTime()));
          }
        }
      `
    }
  ]
});
