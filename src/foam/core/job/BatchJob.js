/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.job',
  name: 'BatchJob',
  extends: 'foam.core.job.Job',

  documentation: `
    Job that drives any Batchable with DAO-backed checkpointing.

    Submit a BatchJob to jobDAO with a Batchable delegate and a runKey.
    BatchJob calls delegate.collectBatches() to get the work list, then
    delegate.processBatch() for each item not already in batchRecordDAO.

    Set runKey to a stable string (e.g. "foam-dataset-2026-10-20") to identify
    the run. Restarting with the same runKey resumes from where it left off.
    Change it to start fresh. When runKey is empty, checkpointing is disabled.
  `,

  javaImports: [
    'foam.core.logger.Loggers',
    'foam.dao.DAO',
    'java.util.List'
  ],

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.core.job.Batchable',
      name: 'delegate',
      documentation: 'The Batchable that provides the work list and item logic.',
      required: true
    },
    {
      class: 'String',
      name: 'runKey',
      documentation: 'Identifies this logical run. Reuse to resume; change to start fresh.'
    }
  ],

  methods: [
    {
      name: 'execute',
      args: 'X x',
      javaCode: `
        DAO          jobDAO        = (DAO) x.get("jobDAO");
        DAO          checkpointDAO = (DAO) x.get("batchRecordDAO");
        Batchable    batchable     = (Batchable) getDelegate();
        List<String> items         = batchable.collectBatches(x);
        int          total         = items.size();
        int          skipped       = 0;

        Loggers.logger(x, this).info("BatchJob: execute-start", "id", getId(), "total", total, "runKey", getRunKey());

        for ( int i = 0; i < total; i++ ) {
          String item = items.get(i);

          // Re-fetch the DAO record each iteration to detect a client-written
          // SUSPENDED status. The check must come before reportProgress because
          // reportProgress calls save(), which writes this clone back and would
          // overwrite any status change made between here and that write.
          BatchJob dao = (BatchJob) jobDAO.find(getId());
          Loggers.logger(x, this).debug("loop-check", "i", i + 1, "total", total, "status", dao != null ? dao.getStatus() : "null", "item", item.length() > 60 ? item.substring(0, 60) : item);
          if ( dao != null && dao.getStatus() == JobStatus.SUSPENDING ) {
            setStatus(JobStatus.SUSPENDED);
            save(x);
            out("Suspended at item " + (i + 1) + " of " + total + ". Resubmit with the same runKey to resume.");
            Loggers.logger(x, this).info("BatchJob: suspended", "id", getId(), "item", i + 1, "total", total, "runKey", getRunKey());
            return;
          }

          if ( ! getRunKey().isEmpty() ) {
            BatchRecordId cid = new BatchRecordId();
            cid.setRunKey(getRunKey());
            cid.setItemId(item);
            BatchRecord existing = (BatchRecord) checkpointDAO.find(cid);
            if ( existing != null ) {
              if ( existing.getBatchNumber() == 0 ) {
                existing = (BatchRecord) existing.fclone();
                existing.setBatchNumber(i + 1);
                checkpointDAO.put(existing);
                Loggers.logger(x, this).debug("BatchJob: checkpoint-backfill", "i", i + 1, "batchNumber", i + 1, "item", item.length() > 60 ? item.substring(0, 60) : item);
              }
              skipped++;
              Loggers.logger(x, this).debug("checkpoint-skip", "i", i + 1, "item", item.length() > 60 ? item.substring(0, 60) : item);
              continue;
            }
          }

          reportProgress(x, item + " (" + (i + 1) + " / " + total + ")", total > 0 ? (i * 100 / total) : 0);
          try {
            batchable.processBatch(x, item);
            if ( ! getRunKey().isEmpty() ) {
              BatchRecord rec = new BatchRecord();
              rec.setRunKey(getRunKey());
              rec.setItemId(item);
              rec.setBatchNumber(i + 1);
              Loggers.logger(x, this).debug("BatchJob: checkpoint-write", "i", i + 1, "batchNumber", i + 1, "item", item.length() > 60 ? item.substring(0, 60) : item);
              checkpointDAO.put(rec);
            }
          } catch ( Exception e ) {
            out("ERROR: " + item + " — " + e.getMessage());
            Loggers.logger(x, this).error("processBatch-error", "i", i + 1, "item", item.length() > 60 ? item.substring(0, 60) : item, e);
          }
        }

        if ( skipped > 0 )
          out("Skipped " + skipped + " already-completed items (runKey=" + getRunKey() + ").");
      `
    }
  ],

  actions: [
    {
      name: 'suspend',
      label: 'Suspend',
      isEnabled: function(status) { return status === foam.core.job.JobStatus.RUNNING; },
      code: async function(X) {

        // Fetch fresh from server so the delegate's concrete class is preserved.
        // Putting `this` risks a stale client-side class the server cannot instantiate.
        const found = await X.jobDAO.find(this.id);
        if ( ! found ) { console.warn('[Suspend] job not found, aborting'); return; }

        const latest = found.clone();
        latest.status = foam.core.job.JobStatus.SUSPENDING;
        try {
          const result = await X.jobDAO.put(latest);
          console.log('[Suspending] put OK, result status=' + result?.status?.name);
          this.status = foam.core.job.JobStatus.SUSPENDING;
        } catch(e) {
          console.error('[Suspending] put FAILED:', e);
        }
      }
    }
  ]
});
