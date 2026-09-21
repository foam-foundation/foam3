/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.job.test',
  name: 'JobTest',
  extends: 'foam.core.test.Test',

  documentation: `Covers the jobDAO contract end to end: submitting returns a
    UUID without waiting on the work, the status transitions are visible to a
    poller, a throwing Job is recorded as FAILED with its stack trace, and the
    retention sweep only takes finished Jobs that are old enough.`,

  javaImports: [
    'foam.core.job.Job',
    'foam.core.job.JobStatus',
    'foam.core.job.RemoveOldJobsAgent',
    'foam.dao.DAO',
    'foam.lang.X',
    'foam.util.SafetyUtil',
    'java.util.Date',
    'java.util.UUID'
  ],

  constants: [
    {
      documentation: 'Ceiling on how long a test waits for a Job to finish.',
      name: 'AWAIT_TIMEOUT',
      type: 'Long',
      value: 30000
    },
    {
      name: 'DAY',
      type: 'Long',
      value: 86400000
    }
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        DAO jobDAO = ((DAO) x.get("jobDAO")).inX(x);

        testSubmitDoesNotBlock(jobDAO);
        testCompletedJob(jobDAO);
        testFailedJob(jobDAO);
        testRetention(x, jobDAO);
      `
    },
    {
      name: 'testSubmitDoesNotBlock',
      documentation: `The point of the whole mechanism: a submit has to come
        back inside the gateway's request timeout no matter how long the work
        takes. Three seconds of work stands in for the minutes a real Job runs.`,
      args: 'foam.dao.DAO jobDAO',
      javaCode: `
        SleepJob job = new SleepJob();
        job.setSteps(30);
        job.setStepTime(100);

        long start     = System.currentTimeMillis();
        Job  submitted = (Job) jobDAO.put(job);
        long elapsed   = System.currentTimeMillis() - start;

        test(! SafetyUtil.isEmpty(submitted.getId()), "submit generates an id");

        boolean isUUID = true;
        try {
          UUID.fromString(submitted.getId());
        } catch ( IllegalArgumentException e ) {
          isUUID = false;
        }
        test(isUUID, "the generated id is a UUID, actual: " + submitted.getId());

        test(elapsed < 1000, "submit returns without waiting on ~3s of work, actual: " + elapsed + "ms");

        Job done = awaitJob(jobDAO, submitted.getId());
        test(done.getStatus() == JobStatus.COMPLETED,
          "a job that outlives its submit still completes, actual: " + done.getStatus());
      `
    },
    {
      name: 'testCompletedJob',
      args: 'foam.dao.DAO jobDAO',
      javaCode: `
        SleepJob job = new SleepJob();
        job.setSteps(4);
        job.setStepTime(25);

        Job submitted = (Job) jobDAO.put(job);

        // put returns a snapshot taken before the runner touches the job.
        test(submitted.getStatus() == JobStatus.SCHEDULED,
          "a submitted job starts SCHEDULED, actual: " + submitted.getStatus());
        test(submitted.getProgress() == -1,
          "progress defaults to -1, actual: " + submitted.getProgress());

        Job done = awaitJob(jobDAO, submitted.getId());

        test(done.getStatus() == JobStatus.COMPLETED,
          "the job completes, actual: " + done.getStatus());
        test(done.getProgress() == 100,
          "progress reflects what the job reported, actual: " + done.getProgress());
        test("step 4 of 4".equals(done.getStatusMsg()),
          "statusMsg carries the last step reported, actual: " + done.getStatusMsg());
        test(done.getExecutionTime() > 0,
          "executionTime is populated on success, actual: " + done.getExecutionTime());
        test(SafetyUtil.isEmpty(done.getException()),
          "no exception on success, actual: " + done.getException());
        test(done.getCreated() != null, "created is stamped for the retention sweep");
      `
    },
    {
      name: 'testFailedJob',
      args: 'foam.dao.DAO jobDAO',
      javaCode: `
        SleepJob job = new SleepJob();
        job.setSteps(3);
        job.setStepTime(10);
        job.setFailAtStep(1);

        Job done = awaitJob(jobDAO, ((Job) jobDAO.put(job)).getId());

        test(done.getStatus() == JobStatus.FAILED,
          "a throwing job ends FAILED, actual: " + done.getStatus());
        test(done.getException().contains("SleepJob failed at step 1"),
          "the exception carries the message, actual: " + done.getException());
        test(done.getException().contains("foam.core.job.test.SleepJob.execute"),
          "the exception carries the stack trace, actual: " + done.getException());
        test(done.getExecutionTime() > 0,
          "executionTime is populated on failure, actual: " + done.getExecutionTime());
        test(done.getProgress() == 33,
          "progress keeps the last value the job reported, actual: " + done.getProgress());
      `
    },
    {
      name: 'testRetention',
      args: 'X x, foam.dao.DAO jobDAO',
      javaCode: `
        String oldFinished = ageJob(jobDAO, runToCompletion(jobDAO), JobStatus.COMPLETED, 2 * DAY);
        String oldRunning  = ageJob(jobDAO, runToCompletion(jobDAO), JobStatus.RUNNING,   2 * DAY);
        String recent      = runToCompletion(jobDAO);

        new RemoveOldJobsAgent().execute(x);

        test(jobDAO.find(oldFinished) == null,
          "a finished job older than the retention age is removed");
        test(jobDAO.find(oldRunning) != null,
          "a RUNNING job is never swept, however old");
        test(jobDAO.find(recent) != null,
          "a finished job inside the retention age is kept");
      `
    },
    {
      name: 'awaitJob',
      documentation: `Poll the way a client would, by id, until the job reaches
        a terminal status. Returns the last state seen so that a timeout is
        reported as the status it got stuck on rather than as a null.`,
      type: 'foam.core.job.Job',
      args: 'foam.dao.DAO jobDAO, String id',
      javaCode: `
        long deadline = System.currentTimeMillis() + AWAIT_TIMEOUT;

        while ( System.currentTimeMillis() < deadline ) {
          Job job = (Job) jobDAO.find(id);
          if ( job != null &&
               ( job.getStatus() == JobStatus.COMPLETED ||
                 job.getStatus() == JobStatus.FAILED ) )
            return job;

          try {
            Thread.sleep(25);
          } catch ( InterruptedException e ) { }
        }

        return (Job) jobDAO.find(id);
      `
    },
    {
      documentation: 'Submits the smallest possible job and returns its id once it has finished.',
      name: 'runToCompletion',
      type: 'String',
      args: 'foam.dao.DAO jobDAO',
      javaCode: `
        SleepJob job = new SleepJob();
        job.setSteps(1);
        job.setStepTime(1);

        Job done = awaitJob(jobDAO, ((Job) jobDAO.put(job)).getId());
        test(done.getStatus() == JobStatus.COMPLETED,
          "retention fixture completes, actual: " + done.getStatus());
        return done.getId();
      `
    },
    {
      name: 'ageJob',
      documentation: `Backdates a job and sets the status the sweep is meant to
        judge it by. created is stamped on create only, so an update can
        rewrite it, and an update fires no rule, so the job is not re-submitted.`,
      type: 'String',
      args: 'foam.dao.DAO jobDAO, String id, foam.core.job.JobStatus status, long ageMs',
      javaCode: `
        Job job = (Job) jobDAO.find(id).fclone();
        job.setStatus(status);
        job.setCreated(new Date(System.currentTimeMillis() - ageMs));
        jobDAO.put(job);
        return id;
      `
    }
  ]
});
