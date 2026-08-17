/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.partition',
  name: 'F3FileJournalRefinement',

  refines: 'foam.dao.AbstractF3FileJournal',

  documentation: `Implements the journal's decorateReplayStream extension
    point for partition loads: when a PartitionLoadReporter rides the
    journal's context (put there by the partition createDAO paths), wrap the
    replay stream so every byte read is counted -- byte-exact progress,
    newlines and multi-byte characters included. Journals with no reporter
    in context replay untouched.`,

  javaImports: [ 'foam.core.partition.PartitionLoadReporter' ],

  methods: [
    {
      name: 'decorateReplayStream',
      args: 'java.io.InputStream is',
      type: 'java.io.InputStream',
      javaCode: `
        PartitionLoadReporter progress = (PartitionLoadReporter) getX().get(PartitionLoadReporter.CTX_KEY);
        return progress != null ? progress.countingStream(is) : is;
      `
    }
  ]
});
