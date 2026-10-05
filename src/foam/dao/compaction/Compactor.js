/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.compaction',
  name: 'Compactor',

  documentation: `Rewrites one journal as a single full copy of each object.

    Driven by the JDAO that owns the journal, which hands itself in, so there
    is no DAO stack to search and a partitioned DAO compacts each partition by
    calling this once per JDAO. Reached by sending a CompactionCmd through the
    DAO stack; see JDAO.cmd_.

    process:
      roll the journal, freezing it as the next generation
      snapshot the MDAO and write full records to a new compressed snapshot
      rename the snapshot into place, then drop the generations it supersedes

    Nothing is blocked. The journal orders the cutover against its own writes,
    and the MDAO's functional index hands the select a snapshot that later
    writes cannot disturb, so the rewrite runs as slowly as it likes beside
    live traffic. See doc/guides/JournalFiles.md.`,

  javaImports: [
    'foam.core.fs.FileSystemStorage',
    'foam.core.auth.LifecycleAware',
    'foam.core.auth.LifecycleState',
    'foam.core.logger.Loggers',
    'foam.core.logger.Logger',
    'foam.lang.Agency',
    'foam.lang.ContextAgent',
    'foam.lang.FObject',
    'foam.lang.X',
    'foam.dao.ArraySink',
    'foam.dao.DAO',
    'foam.dao.FileRollCmd',
    'foam.dao.Journal',
    'foam.dao.JournalGenerations',
    'foam.dao.MDAO',
    'foam.dao.ProxySink',
    'foam.dao.ReadOnlyF3FileJournal',
    'foam.dao.Sink',
    'foam.dao.WriteOnlyF3FileJournal',
    'foam.dao.java.JDAO',
    'foam.mlang.sink.Count',
    'foam.mlang.sink.Sequence',
    'java.io.BufferedReader',
    'java.io.File',
    'java.io.FileReader',
    'java.nio.file.Files',
    'java.nio.file.StandardCopyOption',
    'java.time.Duration'
  ],

  methods: [
    {
      documentation: "Compact one JDAO's journal, appending its results to the command.",
      name: 'compact',
      args: 'X x, foam.dao.java.JDAO jdao, foam.dao.compaction.CompactionCmd cmd',
      javaCode: `
      final Logger logger = Loggers.logger(x, this, "compaction", jdao.getFilename());

      // One compaction per journal at a time. Compaction rolls, and the roll
      // has to be the only one in flight for this journal.
      if ( ! jdao.getCompacting().compareAndSet(false, true) ) {
        logger.info("already compacting, skipped");
        cmd.addSkipped(jdao.getFilename());
        return;
      }

      boolean dispatched = false;
      try {

      Compaction compaction = cmd.getCompaction();
      if ( compaction == null ) {
        DAO compactionDAO = (DAO) x.get("compactionDAO");
        if ( compactionDAO != null && ! foam.util.SafetyUtil.isEmpty(cmd.getServiceName()) ) {
          compaction = (Compaction) compactionDAO.find(cmd.getServiceName());
        }
      }
      if ( compaction == null ) {
        compaction = new Compaction();
        compaction.setCSpec(cmd.getServiceName());
      }
      if ( ! compaction.getCompactible() ) {
        logger.warning(jdao.getFilename(), "not compactible");
        return;
      }

      // The JDAO that handed us this call owns exactly one journal and one
      // MDAO, so there is no stack to search -- and a partitioned DAO simply
      // calls us once per partition instead of us guessing which one it meant.
      // Down this JDAO's own delegates only -- a short, local walk, not a
      // search of the served stack. A partition with String ids has a
      // sequence-number DAO between the JDAO and the MDAO
      // (PartitionedDAO.createDAO), and compaction reads the stored objects,
      // so it wants the MDAO underneath rather than the wrapper.
      DAO delegate = jdao.getDelegate();
      while ( delegate != null && ! ( delegate instanceof MDAO ) ) {
        delegate = delegate instanceof foam.dao.ProxyDAO
          ? ((foam.dao.ProxyDAO) delegate).getDelegate()
          : null;
      }
      if ( delegate == null ) {
        throw new CompactionException("no MDAO under the JDAO: " + jdao.getFilename());
      }
      MDAO mdao = (MDAO) delegate;
      DAO  dao  = mdao;

      // Freeze the live journal first. Ordered against writes by the journal's
      // own assembly line, so nothing is blocked, and the snapshot below is
      // numbered for the generation that just closed.
      FileRollCmd rollCmd = (FileRollCmd) jdao.cmd_(x, new FileRollCmd());
      if ( ! foam.util.SafetyUtil.isEmpty(rollCmd.getError()) ) {
        throw new CompactionException("roll: " + rollCmd.getError());
      }
      final String archive = rollCmd.getRolledFilename();
      logger.info("rolled", archive);

      // Everything past the cutover runs on the thread pool: the command must
      // not hold up whatever triggered it -- a nightly job, or the write that
      // created a new partition. Dispatch is synchronous, so cmd_ returns with
      // the roll done and the work queued.
      final MDAO       fmdao   = mdao;
      final Compaction fconf   = compaction;
      final String     farch   = archive;
      final JDAO       fjdao   = jdao;
      final CompactionCmd fcmd = cmd;

      cmd.started();
      ((Agency) x.get("threadPool")).submit(x, new ContextAgent() {
        public void execute(X x) {
          try {
            rewrite(x, fjdao, fcmd, fmdao, fconf, farch);
          } catch (Throwable t) {
            fcmd.addError(fjdao.getFilename() + ": " + t.getMessage());
            Loggers.logger(x, this, "compaction").error(fjdao.getFilename(), t);
          } finally {
            fjdao.getCompacting().set(false);
            fcmd.finished();
          }
        }
      }, "Compactor:" + jdao.getFilename());
      dispatched = true;

      } finally {
        // Once dispatched the async job clears the flag; until then this does.
        if ( ! dispatched ) jdao.getCompacting().set(false);
      }
      `
    },
    {
      documentation: `The rewrite itself: snapshot the MDAO, commit it, drop what
        it supersedes. Runs on the thread pool, beside live traffic.`,
      name: 'rewrite',
      args: 'X x, foam.dao.java.JDAO jdao, foam.dao.compaction.CompactionCmd cmd, foam.dao.MDAO mdao, foam.dao.compaction.Compaction compaction, String archive',
      javaCode: `
      final Logger logger = Loggers.logger(x, this, "compaction", jdao.getFilename());
      final DAO    dao    = mdao;
      final String filename = jdao.getFilename();

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

      // Capture original runtime journal stats before compaction.
      // FileSystemStorage, not Storage: these are runtime-directory files, and
      // Storage is the jar's ResourceStorage wherever .0 journals ship as
      // resources -- ResourceStorage.get() cannot open a File at all.
      FileSystemStorage storage = (FileSystemStorage) x.get(FileSystemStorage.class);
      long originalEntries = zeroMDAO != null ? zeroCount : 0;
      long originalSize = 0;

      // roll names the generation it just froze, so there is nothing to
      // search for, and it is raw, so its size is its size.
      if ( ! foam.util.SafetyUtil.isEmpty(archive) ) {
        File backup = storage.get(archive);
        if ( backup != null && backup.exists() ) {
          originalSize += backup.length();
          try ( BufferedReader br = new BufferedReader(new FileReader(backup)) ) {
            while ( br.readLine() != null ) originalEntries++;
          } catch (Exception e) {
            logger.warning("could not read backup file", archive, e.getMessage());
          }
        }
      }

      final long backupEntries = originalEntries;
      final long backupSize = originalSize;

      final Count total = (Count) dao.select(new Count());
      final Count processed = new Count();

      // Build the sink chain bottom-up: JournalSink <- lifecycle filter.
      // The snapshot is a new file, not the live journal: it is the complete
      // state through the generation roll just froze, so it is named for that
      // generation and supersedes everything at or below it. Built under .tmp
      // and renamed at the end, which is the commit point -- until then the
      // frozen generations are still the record and the .tmp is discardable.
      String snapshot = archive + ".snap.gz";
      File   snapTmp  = storage.get(snapshot + ".tmp");
      // A .tmp left by an abandoned run is derived data. Drop it: the storage
      // layer opens output streams in APPEND mode, so a survivor would be
      // written onto rather than replaced.
      snapTmp.delete();

      WriteOnlyF3FileJournal snapshotJournal = new WriteOnlyF3FileJournal.Builder(x)
        .setFilename(snapshot + ".tmp")
        .setGzip(true)
        .setCreateFile(true)
        .build();

      JournalSink journalSink = new JournalSink(x, snapshotJournal);
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

      // What survives compaction is whatever the MDAO currently holds. Deciding
      // what should be in it -- age, status, TTL -- is a separate concern,
      // expressed as an ordinary removeAll() from a CRON or, for date TTL, by
      // dropping a partition directory. Compaction used to filter here too,
      // which meant a row stayed live and queryable until the day compaction
      // silently dropped it.
      if ( compaction.getDiscardLifecycleDeleted() ) {
        ProxySink filter = new LifecycleDeletedCompactionSink(x, compaction.getDiscardLifecycleDeleted(), null);
        filter.setDelegate(tail);
        tail = filter;
      }

      final Sink fsink = new Sequence.Builder(x)
                     .setArgs(new Sink[] {
                       processed,
                       tail
                     })
                     .build();

      final long startTime = System.currentTimeMillis();
      logger.info("start");
      sourceDAO.select(fsink);
      logger.info("select", "end", "duration", Duration.ofMillis(System.currentTimeMillis() - startTime));

      // Anything .0 supplies that the snapshot will not carry needs an explicit
      // remove, or the next replay brings it back: .0 is always replayed, and
      // the snapshot only supersedes the generations, never .0.
      long removedFromZero = 0;
      if ( finalZeroMDAO != null ) {
        java.util.List zeroObjects = ((ArraySink) finalZeroMDAO.select(new ArraySink())).getArray();
        DAO nullDAO = new foam.dao.NullDAO(x, mdao.getOf());
        for ( Object zeroObj : zeroObjects ) {
          FObject fobj = (FObject) zeroObj;
          Object  id   = fobj.getProperty("id");
          FObject cur  = mdao.find_(x, id);

          // Absent from the MDAO is the obvious case. The other is a soft
          // delete: LifecycleAwareDAO turns a remove into a DELETED put, so
          // the row is still here and find_ sees it, while the lifecycle
          // filter drops it from the snapshot. Checking find_ alone left such
          // a row unmentioned by the snapshot and alive in .0 -- deleted at
          // runtime, resurrected by the next restart.
          boolean discarded = cur != null &&
            compaction.getDiscardLifecycleDeleted() &&
            cur instanceof LifecycleAware &&
            ((LifecycleAware) cur).getLifecycleState() == LifecycleState.DELETED;

          if ( cur == null || discarded ) {
            snapshotJournal.remove(x, "", nullDAO, fobj);
            removedFromZero++;
          }
        }
        if ( removedFromZero > 0 ) {
          logger.info(".0 removes", "count", removedFromZero);
        }
      }
      final long finalRemovedCount = removedFromZero;

      // Commit. Closing matters twice over: it drains the assembly line and it
      // writes the gzip trailer, without which the file cannot be replayed.
      // Only then is the rename -- the single commit point -- allowed to run.
      long newSize = 0;
      try {
        snapshotJournal.getWriter().flush();
        snapshotJournal.getWriter().close();

        File snapFile = storage.get(snapshot);
        Files.move(snapTmp.toPath(), snapFile.toPath(), StandardCopyOption.ATOMIC_MOVE);
        newSize = snapFile.length();
      } catch (Exception e) {
        // The snapshot never became visible, so the frozen generations are
        // still the record and nothing was lost. Drop the partial file.
        snapTmp.delete();
        logger.error("snapshot failed, generations left intact", snapshot, e.getMessage());
        throw new CompactionException("snapshot", e);
      }

      // Past the commit point the superseded generations are dead weight.
      // Replay already skips them by name, so deleting them reclaims disk and
      // nothing else -- which is why keeping them is safe, and why failing to
      // delete one is only logged.
      if ( compaction.getKeepSupersededGenerations() ) {
        logger.info("keeping superseded generations", new JournalGenerations(x, filename).superseded().size());
      } else {
        for ( String dead : new JournalGenerations(x, filename).superseded() ) {
          File f = storage.get(dead);
          if ( f != null && f.exists() && ! f.delete() ) logger.warning("could not remove superseded", dead);
        }
      }

      long compacted = journalSink.getCount();
      double reduced = ((((Long) processed.getValue()) - compacted) / ((Long) processed.getValue()).doubleValue()) * 100.0;
      long compactionTime = System.currentTimeMillis() - startTime;
      double seconds = compactionTime / 1000.0;
      double minutes = compactionTime / 60000.0;
      double min100K = minutes / ( (Long) processed.getValue() / 100000.0 );

      // The snapshot is compressed, so its lines cannot be counted without
      // decompressing it -- but the sink already knows what it wrote. newSize
      // is the compressed size, which is the honest answer to what this DAO
      // now occupies, and so folds the compression into the reported saving.
      long newEntries = compacted + finalRemovedCount;

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
      cmd.addReport(readable.toString(), report.toString());

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
