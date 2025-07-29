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

      try {
        roll(x);
        compaction(x);

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

      final Count total = (Count) dao.select(new Count());
      final Count processed = new Count();
      final CompactionSink compactionSink = new CompactionSink(x, getServiceName(),
        new JournalSink(x, jdao.getJournal()));
      final Sink sink = new Sequence.Builder(x)
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
          sourceDAO.select(sink);
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
      long compactionTime = System.currentTimeMillis() - startTime;
      double seconds = compactionTime / 1000.0;
      double minutes = compactionTime / 60;
      double min100K = minutes / ( (Long) processed.getValue() / 100000.0 );
      StringBuilder report = new StringBuilder();
      report.append("instance,processed,duration s,date");
      report.append("\\n");
      report.append(System.getProperty("hostname", "loalhost"));
      report.append(",");
      report.append(processed.getValue());
      report.append(",");
      report.append(Math.round(seconds));
      report.append(",");
      report.append(new java.util.Date(startTime));

      logger.info("compactionComplete", "report", "\\n"+report.toString());

      EventRecord er = getEventRecord();
      er.setResponseMessage(report.toString());
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
        }
      ],

      methods: [
        {
          name: 'put',
          javaCode: `
          ((Journal) getJournal()).put(getX(), "", getNullDAO(), (FObject) obj);
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
