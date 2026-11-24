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
        testResentPutAfterFinish(jobDAO);
        testSameIdRunsOnce(jobDAO);
        testGroupRunsInOrderOneAtATime(jobDAO);
        testGroupFailureSkipsTheRest(jobDAO);
        testNoGroupRunsTogether(jobDAO);
        testResentQueuedJobRunsOnce(jobDAO);
      `
    },
    {
      name: 'putGroupJob',
      documentation: 'Puts a CountingJob into the group, with the id group:n the way a batch sender names its Jobs.',
      type: 'foam.core.job.test.CountingJob',
      args: 'foam.dao.DAO jobDAO, String group, int n, int sleepMs, boolean fails',
      javaCode: `
        CountingJob job = new CountingJob();
        job.setId(group + ":" + n);
        job.setGroup(group);
        job.setTag(group + "-" + n);
        job.setOverlapKey(group);
        job.setSleepMs(sleepMs);
        job.setFails(fails);
        return (CountingJob) jobDAO.put(job);
      `
    },
    {
      name: 'testGroupRunsInOrderOneAtATime',
      documentation: `Jobs of one group run in the order they were put, never two at once, as the
        rules of a rule group do. Each takes 60 ms, so a Job that started before its predecessor
        ended would show as an overlap.`,
      args: 'foam.dao.DAO jobDAO',
      javaCode: `
        String group = "ordered-" + UUID.randomUUID();
        for ( int i = 0 ; i < 6 ; i++ ) putGroupJob(jobDAO, group, i, 60, false);

        Job last = awaitJob(jobDAO, group + ":5");
        test(last.getStatus() == JobStatus.COMPLETED, "the last Job of the group completes, actual: " + last.getStatus());

        java.util.List<String> ran = new java.util.ArrayList<>();
        for ( String tag : CountingJob.ORDER ) if ( tag.startsWith(group) ) ran.add(tag);
        java.util.List<String> expected = new java.util.ArrayList<>();
        for ( int i = 0 ; i < 6 ; i++ ) expected.add(group + "-" + i);
        test(expected.equals(ran), "the group runs in the order it was put, actual: " + ran);
        test(! CountingJob.OVERLAPPED.contains(group), "no two Jobs of a group run at the same time");
      `
    },
    {
      name: 'testGroupFailureSkipsTheRest',
      documentation: `After Job 1 fails, Jobs 2 and 3 end FAILED without running and say which batch
        failed. Job 4 asks for runAfterFailure, as a Job that cleans up after the group does, so it runs.
        A Job put into the group after the failure was seen is refused the same way.`,
      args: 'foam.dao.DAO jobDAO',
      javaCode: `
        String group = "failing-" + UUID.randomUUID();
        for ( int i = 0 ; i < 4 ; i++ ) putGroupJob(jobDAO, group, i, 20, i == 1);

        CountingJob cleanup = new CountingJob();
        cleanup.setId(group + ":4");
        cleanup.setGroup(group);
        cleanup.setTag(group + "-4");
        cleanup.setOverlapKey(group);
        cleanup.setRunAfterFailure(true);
        jobDAO.put(cleanup);

        awaitJob(jobDAO, group + ":4");

        test(awaitJob(jobDAO, group + ":0").getStatus() == JobStatus.COMPLETED, "the Job before the failure completes");
        Job failed = awaitJob(jobDAO, group + ":1");
        test(failed.getStatus() == JobStatus.FAILED, "the failing Job ends FAILED, actual: " + failed.getStatus());
        test(failed.getException().contains("CountingJob " + group + "-1 fails"),
          "the failing Job keeps its own error, actual: " + failed.getException());

        for ( int i = 2 ; i <= 3 ; i++ ) {
          Job skipped = awaitJob(jobDAO, group + ":" + i);
          test(skipped.getStatus() == JobStatus.FAILED, "Job " + i + " behind the failure ends FAILED, actual: " + skipped.getStatus());
          test(("Not run: batch " + group + ":1 failed").equals(skipped.getException()),
            "Job " + i + " says which batch failed, actual: " + skipped.getException());
          test(CountingJob.RUNS.get(group + "-" + i) == null, "Job " + i + " never ran");
        }

        test(awaitJob(jobDAO, group + ":4").getStatus() == JobStatus.COMPLETED,
          "a Job with runAfterFailure runs after the failure");

        putGroupJob(jobDAO, group, 5, 0, false);
        Job late = awaitJob(jobDAO, group + ":5");
        test(late.getStatus() == JobStatus.FAILED && late.getException().startsWith("Not run:"),
          "a Job put after the failure is refused too, actual: " + late.getStatus() + " " + late.getException());
      `
    },
    {
      name: 'testNoGroupRunsTogether',
      documentation: `A Job with no group is unchanged: it goes straight to the thread pool, so
        Jobs that take 400 ms each overlap.`,
      args: 'foam.dao.DAO jobDAO',
      javaCode: `
        String key = "ungrouped-" + UUID.randomUUID();
        for ( int i = 0 ; i < 3 ; i++ ) {
          CountingJob job = new CountingJob();
          job.setTag(key + "-" + i);
          job.setOverlapKey(key);
          job.setSleepMs(400);
          jobDAO.put(job);
        }
        long deadline = System.currentTimeMillis() + AWAIT_TIMEOUT;
        while ( System.currentTimeMillis() < deadline && ( CountingJob.RUNS.get(key + "-2") == null || CountingJob.ACTIVE.get(key).get() > 0 ) ) {
          try { Thread.sleep(25); } catch ( InterruptedException e ) { }
        }
        test(CountingJob.OVERLAPPED.contains(key), "Jobs without a group still run at the same time");
      `
    },
    {
      name: 'testResentQueuedJobRunsOnce',
      documentation: `A batch put again while it waits behind a slow Job in its group is the same Job:
        it runs once.`,
      args: 'foam.dao.DAO jobDAO',
      javaCode: `
        String group = "resent-" + UUID.randomUUID();
        putGroupJob(jobDAO, group, 0, 300, false);
        putGroupJob(jobDAO, group, 1, 0, false);
        putGroupJob(jobDAO, group, 1, 0, false);
        putGroupJob(jobDAO, group, 2, 0, false);

        Job last = awaitJob(jobDAO, group + ":2");
        test(last.getStatus() == JobStatus.COMPLETED, "the group completes, actual: " + last.getStatus());
        awaitJob(jobDAO, group + ":1");
        expect(CountingJob.RUNS.get(group + "-1").get(), 1, "a Job put twice while queued runs once");
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
      name: 'testResentPutAfterFinish',
      documentation: `A submitter that never saw the first reply sends the same Job again,
        with its id and status SCHEDULED. After the Job ended, that put must change nothing,
        or a poller waiting for COMPLETED or FAILED would wait forever.`,
      args: 'foam.dao.DAO jobDAO',
      javaCode: `
        SleepJob ok = new SleepJob();
        ok.setSteps(1);
        ok.setStepTime(1);
        String okId = ((Job) jobDAO.put(ok)).getId();
        awaitJob(jobDAO, okId);

        SleepJob resentOk = new SleepJob();
        resentOk.setId(okId);
        resentOk.setSteps(1);
        resentOk.setStepTime(1);
        jobDAO.put(resentOk);
        test(((Job) jobDAO.find(okId)).getStatus() == JobStatus.COMPLETED,
          "a put of a COMPLETED job's id leaves it COMPLETED, actual: " + ((Job) jobDAO.find(okId)).getStatus());

        SleepJob bad = new SleepJob();
        bad.setSteps(1);
        bad.setStepTime(1);
        bad.setFailAtStep(0);
        String badId = ((Job) jobDAO.put(bad)).getId();
        awaitJob(jobDAO, badId);

        SleepJob resentBad = new SleepJob();
        resentBad.setId(badId);
        resentBad.setSteps(1);
        jobDAO.put(resentBad);
        Job after = (Job) jobDAO.find(badId);
        test(after.getStatus() == JobStatus.FAILED,
          "a put of a FAILED job's id leaves it FAILED, actual: " + after.getStatus());
        test(after.getException().contains("SleepJob failed at step 0"),
          "the stored exception survives the resent put, actual: " + after.getException());
      `
    },
    {
      name: 'testSameIdRunsOnce',
      documentation: `The same id put twice before the first reply is one Job: the second put is
        an update, and only a create submits to the threadPool.`,
      args: 'foam.dao.DAO jobDAO',
      javaCode: `
        String tag = "same-id-" + UUID.randomUUID();
        String id  = "client-chosen-" + UUID.randomUUID();
        for ( int i = 0 ; i < 2 ; i++ ) {
          CountingJob job = new CountingJob();
          job.setId(id);
          job.setTag(tag);
          jobDAO.put(job);
        }
        Job done = awaitJob(jobDAO, id);
        test(done.getStatus() == JobStatus.COMPLETED, "the job with a client-chosen id completes, actual: " + done.getStatus());
        test(id.equals(done.getId()), "the jobDAO keeps the client's id, actual: " + done.getId());

        // A late second run would show up shortly after the first.
        try {
          Thread.sleep(300);
        } catch ( InterruptedException e ) { }
        expect(CountingJob.RUNS.get(tag).get(), 1, "two puts of one id run the job once");
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
