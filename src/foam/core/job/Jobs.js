/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.LIB({
  name: 'foam.core.job.Jobs',

  methods: [
    {
      name: 'poll',
      documentation: `Submit a Job to x's jobDAO and poll it until it stops,
        resolving to the full Job, results or exception included, once it is
        COMPLETED or FAILED.
        While it runs, the optional onStatus(job) gets a plain Job carrying
        only status, progress, statusMsg, output and executionTime, read through a
        projection so the Job's results are not downloaded on every poll.
        Freeing the Job with jobDAO.remove() is left to the caller. Rejects
        if the Job is not found, e.g. it was removed or swept.`,
      code: async function poll(x, job, opt_onStatus, interval = 1000) {
        var jobDAO = x.jobDAO;
        var id     = (await jobDAO.put(job)).id;
        var Job    = foam.core.job.Job;
        var Status = foam.core.job.JobStatus;
        var E      = foam.mlang.Expressions.create();
        var props  = [ Job.STATUS, Job.PROGRESS, Job.STATUS_MSG, Job.OUTPUT, Job.EXECUTION_TIME ];

        while ( true ) {
          // A new Projection each poll: a sink keeps every row it is given.
          var row = (await jobDAO.where(E.EQ(Job.ID, id)).limit(1)
            .select(E.PROJECTION(props))).projection[0];

          if ( ! row ) throw new Error('Job not found: ' + id);

          var status = Job.create();
          props.forEach((p, i) => p.set(status, row[i]));

          if ( status.status === Status.COMPLETED || status.status === Status.FAILED )
            return jobDAO.find(id);

          if ( opt_onStatus ) opt_onStatus(status);
          await new Promise(r => setTimeout(r, interval));
        }
      }
    }
  ]
});
