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
      javaCode: `
        DAO          checkpointDAO = (DAO) x.get("batchRecordDAO");
        Batchable    batchable     = (Batchable) getDelegate();
        List<String> items         = batchable.collectBatches(x);
        int          total         = items.size();
        int          skipped       = 0;

        for ( int i = 0; i < total; i++ ) {
          String item = items.get(i);

          if ( ! getRunKey().isEmpty() ) {
            BatchRecordId cid = new BatchRecordId();
            cid.setRunKey(getRunKey());
            cid.setItemId(item);
            if ( checkpointDAO.find(cid) != null ) {
              skipped++;
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
              checkpointDAO.put(rec);
            }
          } catch ( Exception e ) {
            out("ERROR: " + item + " — " + e.getMessage());
          }
        }

        if ( skipped > 0 )
          out("Skipped " + skipped + " already-completed items (runKey=" + getRunKey() + ").");
      `
    }
  ]
});
