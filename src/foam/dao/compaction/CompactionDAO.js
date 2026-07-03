/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.compaction',
  name: 'CompactionDAO',
  extends: 'foam.dao.compaction.BlockingDAO',

  documentation: `
Re-writes DAO with a single full copy of each Object.

Run from script 'DAOCompaction'

process:
block dao operations
roll journal file
unblock dao
select from mdao and write full records to new empty journal
  `,

  javaImports: [
    'foam.core.logger.Loggers',
    'foam.core.logger.Logger',
    'foam.core.er.EventRecord',
    'foam.lang.Agency',
    'foam.lang.ContextAgent',
    'foam.lang.FObject',
    'foam.lang.X',
    'foam.dao.ArraySink',
    'foam.dao.DAO',
    'foam.dao.FileRollCmd',
    'foam.dao.Journal',
    'foam.dao.MDAO',
    'foam.dao.ProxyDAO',
    'foam.dao.ProxySink',
    'foam.dao.ReadOnlyF3FileJournal',
    'foam.dao.Sink',
    'foam.dao.java.JDAO',
    'foam.log.LogLevel',
    'foam.mlang.sink.Count',
    'foam.mlang.sink.Sequence',
    'foam.core.fs.Storage',
    'java.io.BufferedReader',
    'java.io.File',
    'java.io.FileReader',
    'java.time.Duration'
  ],

  constants: [
    {
      documentation: 'Initiate Compaction process',
      name: 'COMPACTION_CMD',
      type: 'String',
      value: 'COMPACTION_CMD'
    }
  ],

  properties: [
    {
      name: 'serviceName',
      class: 'String'
    },
    {
      documentation: 'true when blocking for setup',
      name: 'blocking',
      class: 'Boolean',
      visibility: 'HIDDEN'
    },
    {
      name: 'eventRecord',
      class: 'FObjectProperty',
      of: 'foam.core.er.EventRecord'
    },
    {
      name: 'report',
      class: 'String',
      documentation: 'Human-readable compaction report populated after execute()'
    }
  ],

  javaCode: `
  public CompactionDAO(X x, String serviceName) {
    setX(x);
    setServiceName(serviceName);
    setDelegate(new foam.dao.NullDAO(x, this.getOwnClassInfo()));
  }
  `,

  methods: [
    {
      name: 'cmd_',
      javaCode: `
      if ( COMPACTION_CMD.equals(obj) ) {
        ((foam.core.om.OMLogger) x.get("OMLogger")).log(obj.toString());
        execute(x);
        return obj;
      }
      return getDelegate().cmd_(x, obj);
      `
    },
    {
      name: 'maybeBlock',
      args: 'X x',
      javaCode: `
      return getBlocking();
      `
    },
    {
      name: 'execute',
      args: 'X x',
      javaCode: `
      Logger logger = Loggers.logger(x, this, "execute");
      long startTime = System.currentTimeMillis();
      logger.info("start");
      EventRecord er = (EventRecord) ((DAO) x.get("eventRecordDAO")).put(new EventRecord(x, getServiceName(), "compaction", "start")).fclone();
      er.clearId();
      setEventRecord(er);
      Compaction compaction = null;
      DAO compactionDAO = (DAO) x.get("compactionDAO");
      if ( compactionDAO != null ) {
        compaction = (Compaction) compactionDAO.find(getServiceName());
      }
      if ( compaction == null ) {
        compaction = new Compaction();
        compaction.setCSpec(getServiceName());
        logger.info("no compaction config found, using defaults");
      }

      try {
        roll(x);
        if ( compaction.getCompactible() ) {
          compaction(x);
        } else {
          logger.warning(getServiceName(), "not compactible");
        }

        logger.info("end");
        er = getEventRecord();
        er.setMessage("complete");
        ((DAO) x.get("eventRecordDAO")).put(er);
       } catch (Throwable t) {
        er = getEventRecord();
        er.setMessage(t.getMessage());
        er.setSeverity(LogLevel.ERROR);
        er.setException(t);
        ((DAO) x.get("eventRecordDAO")).put(er);
        throw t;
      } finally {
        logger.info("end", "duration", Duration.ofMillis(System.currentTimeMillis() - startTime));
      }
      `
    },
    {
      documentation: 'Copy the current journal to journal.1 and create a new empty journal.',
      name: 'roll',
      args: 'X x',
      javaCode: `
      Logger logger = Loggers.logger(x, this, "roll", getServiceName());
      ProxyDAO dao = (ProxyDAO) x.get(getServiceName());
      DAO savedDelegate = dao.getDelegate();

      try {
        this.setDelegate(savedDelegate);
        dao.setDelegate(this);
        setBlocking(true);

        FileRollCmd cmd = new FileRollCmd();
        cmd = (FileRollCmd) getDelegate().cmd_(x, new FileRollCmd());
        if ( ! foam.util.SafetyUtil.isEmpty(cmd.getError()) ) {
          logger.error("failed", cmd.getError());
          throw new CompactionException("roll");
        } else {
          logger.info("complete", cmd.getRolledFilename());
        }
      } catch (RuntimeException e) {
        logger.error("failed", e.getMessage());
        throw new CompactionException("roll", e);
      } finally {
        setBlocking(false);
        super.unblock(x);
        dao.setDelegate(savedDelegate);
      }
      `
    },
    {
      documentation: 'Dump data to new journal file',
      name: 'compaction',
      args: 'X x',
      javaCode: `
      final Logger logger = Loggers.logger(x, this, "compaction", getServiceName());
      Compaction compaction = null;
      DAO compactionDAO = (DAO) x.get("compactionDAO");
      if ( compactionDAO != null ) {
        compaction = (Compaction) compactionDAO.find(getServiceName());
      }
      if ( compaction == null ) {
        compaction = new Compaction();
        compaction.setCSpec(getServiceName());
      }

      DAO dao = (DAO) x.get(getServiceName());
      MDAO mdao = null;
      JDAO jdao = null;
      while ( dao != null ) {
        if ( dao instanceof MDAO ) {
          mdao = (MDAO) dao;
          break;
        }
        if ( dao instanceof JDAO ) {
          jdao = (JDAO) dao;
        }
        if ( dao instanceof ProxyDAO ) {
          dao = (DAO) ((ProxyDAO) dao).getDelegate();
        } else {
          break;
        }
      }
      if ( mdao == null ) {
        logger.error("mdao not found");
        throw new CompactionException("mdao not found");
      }
      if ( jdao == null ) {
        logger.error("jdao not found");
        throw new CompactionException("jdao not found");
      }

      // Replay .0 (deployment journal) into a temp MDAO for diffing
      MDAO zeroMDAO = null;
      long zeroCount = 0;
      try {
        ReadOnlyF3FileJournal journal0 = new ReadOnlyF3FileJournal.Builder(x)
          .setFilename(jdao.getFilename() + ".0")
          .build();
        zeroMDAO = new MDAO(mdao.getOf());
        journal0.replay(x, zeroMDAO);
        zeroCount = ((Long) ((Count) zeroMDAO.select(new Count())).getValue());
        logger.info(".0 replay", "objects", zeroCount);
      } catch ( Throwable t ) {
        zeroMDAO = null;
        logger.info(".0 file not found or unreadable, compaction proceeds normally", t.getMessage());
      }
      final MDAO finalZeroMDAO = zeroMDAO;

      final DAO sourceDAO = (MDAO) mdao;

      // Capture original runtime journal stats before compaction
      Storage storage = (Storage) x.get(Storage.class);
      String filename = jdao.getFilename();
      long originalEntries = zeroMDAO != null ? zeroCount : 0;
      long originalSize = 0;

      // Find the most recent backup (.1, .2, etc.) created by roll
      for ( int i = 1 ; ; i++ ) {
        File f = storage.get(filename + "." + (i + 1));
        if ( f == null || ! f.exists() ) {
          File backup = storage.get(filename + "." + i);
          if ( backup != null && backup.exists() ) {
            originalSize += backup.length();
            try ( BufferedReader br = new BufferedReader(new FileReader(backup)) ) {
              while ( br.readLine() != null ) originalEntries++;
            } catch (Exception e) {
              logger.warning("could not read backup file", e.getMessage());
            }
          }
          break;
        }
      }

      final long backupEntries = originalEntries;
      final long backupSize = originalSize;

      final Count total = (Count) dao.select(new Count());
      final Count processed = new Count();

      // Build the sink chain bottom-up: JournalSink <- filters <- CompactionSink
      // Must be built before CompactionSink because CompactionSink.setDelegate()
      // triggers getFacetedSink() which captures the chain at that point.
      JournalSink journalSink = new JournalSink(x, jdao.getJournal());
      if ( finalZeroMDAO != null ) {
        // Read-only wrapper: find() returns .0 version for delta detection,
        // put() is no-op so zeroMDAO stays clean for the remove check later.
        // journal.put() uses baseDAO.find_(id) to get the old version, then
        // maybeOutputDelta() writes only changed properties. Identical objects
        // produce an empty delta and nothing is written to the journal.
        journalSink.setBaseDAO(new foam.dao.NullDAO(x, mdao.getOf()) {
          public foam.lang.FObject find_(foam.lang.X x, Object id) {
            return finalZeroMDAO.find_(x, id);
          }
        });
      }
      Sink tail = journalSink;

      // Build filter chain on top of tail
      if ( compaction.getLastModifiedSince() != null ) {
        ProxySink filter = new LastModifiedCompactionSink(x, compaction.getLastModifiedSince(), null);
        filter.setDelegate(tail);
        tail = filter;
      }
      if ( compaction.getCreatedSince() != null ) {
        ProxySink filter = new CreatedCompactionSink(x, compaction.getCreatedSince(), null);
        filter.setDelegate(tail);
        tail = filter;
      }
      if ( compaction.getPredicate() != null ) {
        ProxySink filter = new PredicateCompactionSink(x, compaction.getPredicate(), null);
        filter.setDelegate(tail);
        tail = filter;
      }
      if ( compaction.getDiscardLifecycleDeleted() ) {
        ProxySink filter = new LifecycleDeletedCompactionSink(x, compaction.getDiscardLifecycleDeleted(), null);
        filter.setDelegate(tail);
        tail = filter;
      }

      // Set the complete chain as CompactionSink's delegate (triggers getFacetedSink once)
      CompactionSink compactionSink = new CompactionSink(x, getServiceName(), tail);

      final Sink fsink = new Sequence.Builder(x)
                     .setArgs(new Sink[] {
                       processed,
                       compactionSink
                     })
                     .build();

      final long startTime = System.currentTimeMillis();
      Agency agency = (Agency) x.get("threadPool");
      agency.submit(x, new ContextAgent() {
        public void execute(X x) {
          logger.info("start");
          sourceDAO.select(fsink);
          long compactionTime = System.currentTimeMillis() - startTime;
          logger.info("agency", "end", "duration", Duration.ofMillis(compactionTime));
        }
      }, this.getClass().getSimpleName()+".compaction");

      // wait for eof
      while ( ! compactionSink.getIsEof() &&
              ((Long) processed.getValue()) < ((Long) total.getValue()) ) {
        long percentComplete = (long) ((((Long) processed.getValue()) / ((Long) total.getValue()).doubleValue()) * 100.0);
        logger.info("progress", "processed", processed.getValue(), percentComplete, "%");
        try {
          Thread.currentThread().sleep(5000);
        } catch (InterruptedException e) {
          break;
        }
      }
      // Write remove entries for objects that exist in .0 but were deleted at runtime
      long removedFromZero = 0;
      if ( finalZeroMDAO != null ) {
        java.util.List zeroObjects = ((ArraySink) finalZeroMDAO.select(new ArraySink())).getArray();
        DAO nullDAO = new foam.dao.NullDAO(x, mdao.getOf());
        for ( Object zeroObj : zeroObjects ) {
          FObject fobj = (FObject) zeroObj;
          Object id = fobj.getProperty("id");
          if ( mdao.find_(x, id) == null ) {
            jdao.getJournal().remove(x, "", nullDAO, fobj);
            removedFromZero++;
          }
        }
        if ( removedFromZero > 0 ) {
          logger.info(".0 removes", "count", removedFromZero);
        }
      }
      final long finalRemovedCount = removedFromZero;

      long compacted = journalSink.getCount();
      double reduced = ((((Long) processed.getValue()) - compacted) / ((Long) processed.getValue()).doubleValue()) * 100.0;
      long compactionTime = System.currentTimeMillis() - startTime;
      double seconds = compactionTime / 1000.0;
      double minutes = compactionTime / 60000.0;
      double min100K = minutes / ( (Long) processed.getValue() / 100000.0 );

      // Capture new journal stats
      long newEntries = 0;
      long newSize = 0;
      File journalFile = storage.get(filename);
      if ( journalFile != null && journalFile.exists() ) {
        newSize = journalFile.length();
        try ( BufferedReader br = new BufferedReader(new FileReader(journalFile)) ) {
          while ( br.readLine() != null ) newEntries++;
        } catch (Exception e) {
          logger.warning("could not read journal file", e.getMessage());
        }
      }

      double entryReduction = backupEntries > newEntries ? ((backupEntries - newEntries) / (double) backupEntries) * 100.0 : 0;
      double sizeReduction = backupSize > newSize ? ((backupSize - newSize) / (double) backupSize) * 100.0 : 0;

      String entryReductionStr = backupEntries > newEntries ? String.format("%.2f%%", entryReduction) : "N/A";
      String sizeReductionStr = backupSize > newSize ? String.format("%.2f%%", sizeReduction) : "N/A";

      StringBuilder report = new StringBuilder();
      report.append("instance,processed,compacted,duration s,objects filtered,date,original entries,new entries,entry reduction,original size,new size,size reduction,removed from .0");
      report.append("\\n");
      report.append(System.getProperty("hostname", "localhost"));
      report.append(",");
      report.append(processed.getValue());
      report.append(",");
      report.append(compacted);
      report.append(",");
      report.append(Math.round(seconds));
      report.append(",");
      report.append(String.format("%.2f%%", reduced));
      report.append(",");
      report.append(new java.util.Date(startTime));
      report.append(",");
      report.append(backupEntries);
      report.append(",");
      report.append(newEntries);
      report.append(",");
      report.append(entryReductionStr);
      report.append(",");
      report.append(formatSize(backupSize));
      report.append(",");
      report.append(formatSize(newSize));
      report.append(",");
      report.append(sizeReductionStr);
      report.append(",");
      report.append(finalRemovedCount);

      logger.info("compactionComplete", "report", "\\n"+report.toString());

      StringBuilder readable = new StringBuilder();
      readable.append("Compaction Report");
      readable.append("\\n  Instance:          " + System.getProperty("hostname", "localhost"));
      readable.append("\\n  Date:              " + new java.util.Date(startTime));
      readable.append("\\n  Duration:          " + Math.round(seconds) + "s");
      readable.append("\\n  Objects processed:  " + processed.getValue());
      readable.append("\\n  Objects compacted:  " + compacted);
      readable.append("\\n  Objects filtered:   " + String.format("%.2f%%", reduced));
      readable.append("\\n  Journal entries:    " + backupEntries + " -> " + newEntries + " (" + entryReductionStr + " reduction)");
      readable.append("\\n  Journal size:       " + formatSize(backupSize) + " -> " + formatSize(newSize) + " (" + sizeReductionStr + " reduction)");
      if ( finalRemovedCount > 0 ) {
        readable.append("\\n  Removed (.0):       " + finalRemovedCount + " (deleted at runtime)");
      }
      setReport(readable.toString());

      EventRecord er = getEventRecord();
      er.setResponseMessage(report.toString());
      `
    },
    {
      name: 'formatSize',
      args: 'long bytes',
      type: 'String',
      javaCode: `
      if ( bytes < 1024 ) return bytes + " B";
      if ( bytes < 1024 * 1024 ) return String.format("%.1f KB", bytes / 1024.0);
      if ( bytes < 1024 * 1024 * 1024 ) return String.format("%.1f MB", bytes / (1024.0 * 1024));
      return String.format("%.1f GB", bytes / (1024.0 * 1024 * 1024));
      `
    }
  ],
  classes: [
    {
      name: 'JournalSink',
      extends: 'foam.dao.AbstractSink',

      documentation: 'put to Journal',

      javaCode: `
        public JournalSink(X x, Journal journal) {
          setX(x);
          setJournal(journal);
        }
      `,

      properties: [
        {
          class: 'Object',
          name: 'journal'
        },
        {
          class: 'foam.dao.DAOProperty',
          name: 'baseDAO',
          documentation: 'DAO used by journal for delta detection. Defaults to NullDAO (full writes). Set to a .0 wrapper for delta writes.',
          javaFactory: 'return new foam.dao.NullDAO(getX(), this.getOwnClassInfo());'
        },
        {
          name: 'isEof',
          class: 'Boolean'
        },
        {
          name: 'count',
          class: 'Long'
        }
      ],

      methods: [
        {
          name: 'put',
          javaCode: `
          ((Journal) getJournal()).put(getX(), "", getBaseDAO(), (FObject) obj);
          setCount(getCount() +1);
          `
        },
        {
          name: 'eof',
          javaCode: 'setIsEof(true);'
        }
      ]
    }
  ]
});
