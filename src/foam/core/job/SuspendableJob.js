/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.job',
  name: 'SuspendableJob',
  extends: 'foam.core.job.Job',
  abstract: true,

  documentation: `Intermediate base for jobs that support client-initiated suspend.
    Adds a single Suspend action that sets status to SUSPENDING; the running
    execute() loop is responsible for detecting that transition and stopping
    cleanly (checkpointing before exit). BatchJob and PythonJob both extend
    this so any subclass — including MLXTrainingJob — inherits the action.`,

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
