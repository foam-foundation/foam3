/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.compaction',
  name: 'CompactionCmd',

  documentation: `Command that asks a JDAO to compact its own journal.

    Sent through the DAO stack with cmd(), so it reaches whichever JDAOs are
    down there: one for an ordinary DAO, one per partition for a partitioned
    one. Each JDAO that handles it appends its report.

    Carries configuration in and the report out. A config left unset is looked
    up in compactionDAO by serviceName, and defaults if that finds nothing.`,

  properties: [
    {
      documentation: 'CSpec name, used to look up configuration and to label the report.',
      class: 'String',
      name: 'serviceName'
    },
    {
      documentation: 'Configuration to apply. Looked up by serviceName when unset.',
      class: 'FObjectProperty',
      of: 'foam.dao.compaction.Compaction',
      name: 'compaction'
    },
    {
      documentation: 'Human-readable report, one block per journal compacted.',
      class: 'String',
      name: 'report'
    },
    {
      documentation: 'CSV report, one block per journal compacted.',
      class: 'String',
      name: 'csv'
    },
    {
      documentation: 'Set when a journal failed to compact. The others still run.',
      class: 'String',
      name: 'error'
    },
    {
      documentation: 'How many journals handled this command.',
      class: 'Int',
      name: 'compactedCount'
    },
    {
      documentation: `Journals dispatched but not yet finished.

        The command does not block: cmd_ returns once every journal has been
        handed to the thread pool, which is why a caller triggering compaction
        from a write path is never held up. Dispatch itself is synchronous, so
        by the time cmd_ returns this count is final and awaitCompletion has
        nothing to race with.`,
      class: 'Int',
      name: 'pending'
    }
  ],

  methods: [
    {
      documentation: `Append one journal's results, so a partitioned DAO
        accumulates every partition. Synchronized: partitions compact on
        separate threads and all report into this one command.`,
      name: 'addReport',
      synchronized: true,
      args: 'String readable, String csv',
      javaCode: `
        setReport(foam.util.SafetyUtil.isEmpty(getReport()) ? readable : getReport() + "\\n\\n" + readable);
        setCsv(foam.util.SafetyUtil.isEmpty(getCsv()) ? csv : getCsv() + "\\n" + csv);
        setCompactedCount(getCompactedCount() + 1);
      `
    },
    {
      documentation: 'Record a failure without discarding one already reported.',
      name: 'addError',
      synchronized: true,
      args: 'String message',
      javaCode: `
        setError(foam.util.SafetyUtil.isEmpty(getError()) ? message : getError() + "; " + message);
      `
    },
    {
      documentation: 'Called as a journal is handed to the thread pool.',
      name: 'started',
      synchronized: true,
      javaCode: 'setPending(getPending() + 1);'
    },
    {
      documentation: 'Called as a journal finishes, successfully or not.',
      name: 'finished',
      synchronized: true,
      javaCode: `
        setPending(getPending() - 1);
        notifyAll();
      `
    },
    {
      documentation: `Block until every dispatched journal has finished, for a
        caller that wants the report -- an operator script, a test. Nothing on a
        write path should call this. Returns false on timeout.`,
      name: 'awaitCompletion',
      synchronized: true,
      args: 'long timeoutMs',
      type: 'Boolean',
      javaCode: `
        long deadline = System.currentTimeMillis() + timeoutMs;
        while ( getPending() > 0 ) {
          long left = deadline - System.currentTimeMillis();
          if ( left <= 0 ) return false;
          try {
            wait(left);
          } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
          }
        }
        return true;
      `
    }
  ]
});
