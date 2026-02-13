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
    'foam.dao.DAO',
    'foam.dao.FileRollCmd',
    'foam.dao.Journal',
    'foam.dao.MDAO',
    'foam.dao.ProxyDAO',
    'foam.dao.ProxySink',
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
      Compaction compaction = (Compaction) ((DAO) x.get("compactionDAO")).find(getServiceName());
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
      Compaction compaction = (Compaction) ((DAO) x.get("compactionDAO")).find(getServiceName());
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

      final DAO sourceDAO = (MDAO) mdao;

      // Capture backup file stats before compaction
      Storage storage = (Storage) x.get(Storage.class);
      String filename = jdao.getFilename();
      long originalEntries = 0;
      long originalSize = 0;
      // Find the most recent backup (.1, .2, etc.)
      for ( int i = 1 ; ; i++ ) {
        File f = storage.get(filename + "." + (i + 1));
        if ( f == null || ! f.exists() ) {
          File backup = storage.get(filename + "." + i);
          if ( backup != null && backup.exists() ) {
            originalSize = backup.length();
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
      CompactionSink compactionSink = new CompactionSink(x, getServiceName(), null);
      ProxySink sink = compactionSink;
      ProxySink delegate = null;
      if ( compaction.getDiscardLifecycleDeleted() ) {
        delegate = new LifecycleDeletedCompactionSink(x, compaction.getDiscardLifecycleDeleted(), null);
        sink.setDelegate(delegate);
        sink = delegate;
      }
      if ( compaction.getPredicate() != null ) {
        delegate = new PredicateCompactionSink(x, compaction.getPredicate(), null);
        sink.setDelegate(delegate);
        sink = delegate;
      } else if ( compaction.getCreatedSince() != null ) {
        delegate = new CreatedCompactionSink(x, compaction.getCreatedSince(), null);
        sink.setDelegate(delegate);
        sink = delegate;
      } else if ( compaction.getLastModifiedSince() != null ) {
        delegate = new LastModifiedCompactionSink(x, compaction.getLastModifiedSince(), null);
        sink.setDelegate(delegate);
        sink = delegate;
      }

      JournalSink journalSink = new JournalSink(x, jdao.getJournal());
      sink.setDelegate(journalSink);

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

      double entryReduction = backupEntries > 0 ? ((backupEntries - newEntries) / (double) backupEntries) * 100.0 : 0;
      double sizeReduction = backupSize > 0 ? ((backupSize - newSize) / (double) backupSize) * 100.0 : 0;

      StringBuilder report = new StringBuilder();
      report.append("instance,processed,compacted,duration s,objects filtered,date,original entries,new entries,entry reduction,original size,new size,size reduction");
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
      report.append(String.format("%.2f%%", entryReduction));
      report.append(",");
      report.append(formatSize(backupSize));
      report.append(",");
      report.append(formatSize(newSize));
      report.append(",");
      report.append(String.format("%.2f%%", sizeReduction));

      logger.info("compactionComplete", "report", "\\n"+report.toString());

      StringBuilder readable = new StringBuilder();
      readable.append("Compaction Report");
      readable.append("\\n  Instance:          " + System.getProperty("hostname", "localhost"));
      readable.append("\\n  Date:              " + new java.util.Date(startTime));
      readable.append("\\n  Duration:          " + Math.round(seconds) + "s");
      readable.append("\\n  Objects processed:  " + processed.getValue());
      readable.append("\\n  Objects compacted:  " + compacted);
      readable.append("\\n  Objects filtered:   " + String.format("%.2f%%", reduced));
      readable.append("\\n  Journal entries:    " + backupEntries + " -> " + newEntries + " (" + String.format("%.2f%%", entryReduction) + " reduction)");
      readable.append("\\n  Journal size:       " + formatSize(backupSize) + " -> " + formatSize(newSize) + " (" + String.format("%.2f%%", sizeReduction) + " reduction)");
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
          of: 'foam.dao.NullDAO',
          name: 'nullDAO',
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
          ((Journal) getJournal()).put(getX(), "", getNullDAO(), (FObject) obj);
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
