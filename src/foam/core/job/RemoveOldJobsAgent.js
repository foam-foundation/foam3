/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.job',
  name: 'RemoveOldJobsAgent',

  implements: [ 'foam.lang.ContextAgent' ],

  documentation: `Retention sweep for the jobDAO, run from a Cron.

    Removes Jobs that have finished — COMPLETED or FAILED — and were created
    longer ago than maxAge. A SCHEDULED or RUNNING Job is never swept, however
    old it is, so a Job that outlives the sweep interval is not deleted out
    from under itself.

    maxAge is the cron's configuration point: set it from the Cron's code to
    keep results around for longer or shorter than the default day.`,

  javaImports: [
    'foam.dao.DAO',
    'foam.lang.X',
    'java.util.Date',
    'static foam.mlang.MLang.AND',
    'static foam.mlang.MLang.HAS',
    'static foam.mlang.MLang.IN',
    'static foam.mlang.MLang.LT'
  ],

  properties: [
    {
      documentation: 'Age past which a finished Job is removed. Defaults to one day.',
      class: 'Duration',
      name: 'maxAge',
      value: 24 * 60 * 60 * 1000
    }
  ],

  methods: [
    {
      name: 'execute',
      javaCode: `
        Date cutoff = new Date(System.currentTimeMillis() - getMaxAge());

        // HAS guards the LT: an unset Date satisfies a less-than against any
        // cutoff, which would sweep a Job the jobDAO never stamped.
        ((DAO) x.get("jobDAO")).inX(x).where(
          AND(
            IN(Job.STATUS, new JobStatus[] { JobStatus.COMPLETED, JobStatus.FAILED }),
            HAS(Job.CREATED),
            LT(Job.CREATED, cutoff)
          )
        ).removeAll();
      `
    }
  ]
});
