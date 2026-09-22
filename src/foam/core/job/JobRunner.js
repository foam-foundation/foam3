/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.job',
  name: 'JobRunner',

  implements: [ 'foam.lang.ContextAgent' ],

  documentation: `Adapter around a Job, and the object actually handed to the
    threadPool. It owns the status transitions so that a Job implementation is
    only responsible for its own work:

      SCHEDULED -> RUNNING -> COMPLETED
                           -> FAILED

    Each transition is written back to the jobDAO, so a poller sees the Job
    start, and sees how it ended. A Throwable out of execute() becomes FAILED
    plus its stack trace rather than a lost thread, and executionTime is set
    either way.`,

  javaImports: [
    'foam.core.logger.Loggers',
    'foam.lang.X',
    'java.io.PrintWriter',
    'java.io.StringWriter'
  ],

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.core.job.Job',
      name: 'job'
    }
  ],

  methods: [
    {
      name: 'execute',
      javaCode: `
        Job  job   = getJob();
        long start = System.currentTimeMillis();

        job.setStatus(JobStatus.RUNNING);
        job.save(x);

        try {
          job.execute(x);
          job.setStatus(JobStatus.COMPLETED);
        } catch ( Throwable t ) {
          job.setStatus(JobStatus.FAILED);
          job.setException(stackTrace(t));
          Loggers.logger(x, this).error("job", job.getClass().getSimpleName(), job.getId(), t);
        } finally {
          job.setExecutionTime(System.currentTimeMillis() - start);
          job.save(x);
        }
      `
    },
    {
      name: 'stackTrace',
      type: 'String',
      args: 'Throwable t',
      javaCode: `
        StringWriter sw = new StringWriter();
        t.printStackTrace(new PrintWriter(sw));
        return sw.toString();
      `
    }
  ]
});
