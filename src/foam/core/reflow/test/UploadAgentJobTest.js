/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.test',
  name: 'UploadAgentJobTest',
  extends: 'foam.core.test.Test',

  documentation: `An upload batch runs as a Job. Covers what the old dao.cmd() path could not:
    a resent submit adds no rows, a batch that cannot run fails the Job instead of
    completing empty, and the Job is authorized as the request it replaces was.`,

  javaImports: [
    'foam.core.auth.AuthService',
    'foam.core.auth.ProxyAuthService',
    'foam.core.auth.Subject',
    'foam.core.auth.User',
    'foam.core.job.Job',
    'foam.core.job.JobStatus',
    'foam.dao.DAO',
    'foam.lang.FObject',
    'foam.lang.X',
    'foam.lib.formatter.JSONFObjectFormatter',
    'foam.mlang.sink.Count',
    'java.io.ByteArrayOutputStream',
    'java.util.Base64',
    'java.util.UUID',
    'java.util.zip.GZIPOutputStream',
    'static foam.mlang.MLang.COUNT'
  ],

  constants: [
    { name: 'AWAIT_TIMEOUT', type: 'Long',   value: 30000 },
    { name: 'UPLOAD_DAO',       type: 'String', value: 'uploadJobTestDAO' }
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        testStoresRows(x);
        testResentPutAddsNothing(x);
        testNodeStyleAgent(x);
        testUnknownKeyFails(x);
        testEmptyKeyFails(x);
        testEmptyPayloadFails(x);
        testUserWithoutServiceFails(x);
      `
    },
    {
      name: 'testStoresRows',
      args: 'X x',
      javaCode: `
        long before = count(x);
        Job done = submitAndWait(x, agent(x, UPLOAD_DAO, 5, "stores"));
        test(done.getStatus() == JobStatus.COMPLETED, "the batch completes, actual: " + done.getStatus());
        expect(count(x) - before, 5L, "every row of the batch is stored");
        expect(((foam.core.reflow.UploadAgent) done).getProcessed(), 5, "processed counts the rows");
        test(((foam.core.reflow.UploadAgent) done).getCompressed().isEmpty(), "the payload is dropped when the job ends");
      `
    },
    {
      name: 'testResentPutAddsNothing',
      documentation: 'The duplicate-load bug: the same batch sent again with the same job id must not store it again.',
      args: 'X x',
      javaCode: `
        DAO jobDAO = ((DAO) x.get("jobDAO")).inX(x);
        String id  = "resend-" + UUID.randomUUID();
        long before = count(x);

        foam.core.reflow.UploadAgent first = agent(x, UPLOAD_DAO, 4, "resend");
        first.setId(id);
        jobDAO.put(first);
        // Sent again before the first one ended, and again after it ended.
        foam.core.reflow.UploadAgent second = agent(x, UPLOAD_DAO, 4, "resend");
        second.setId(id);
        jobDAO.put(second);
        await(jobDAO, id);
        foam.core.reflow.UploadAgent third = agent(x, UPLOAD_DAO, 4, "resend");
        third.setId(id);
        jobDAO.put(third);
        sleep(300);

        expect(count(x) - before, 4L, "three sends of one batch store its rows once");
        test(((Job) jobDAO.find(id)).getStatus() == JobStatus.COMPLETED, "the job still reads COMPLETED");
      `
    },
    {
      name: 'testNodeStyleAgent',
      documentation: `A Node client sends the rows themselves in data and no compressed text
        (UploadAgentNodeRefinement makes data non-transient). Rows set directly must be stored.`,
      args: 'X x',
      javaCode: `
        long before = count(x);
        foam.core.reflow.UploadAgent agent = new foam.core.reflow.UploadAgent();
        agent.setDaoKey(UPLOAD_DAO);
        agent.setData(new FObject[] { row("node-1"), row("node-2"), row("node-3") });
        Job done = submitAndWait(x, agent);
        test(done.getStatus() == JobStatus.COMPLETED, "a batch carrying data directly completes, actual: " + done.getStatus());
        expect(count(x) - before, 3L, "its rows are stored");
      `
    },
    {
      name: 'testUnknownKeyFails',
      args: 'X x',
      javaCode: `
        long before = count(x);
        Job done = submitAndWait(x, agent(x, "noSuchUploadDAO", 3, "unknown"));
        test(done.getStatus() == JobStatus.FAILED, "an unknown key fails the job, actual: " + done.getStatus());
        test(done.getException().contains("No served DAO named noSuchUploadDAO"),
          "the failure names the key, actual: " + done.getException());
        expect(count(x) - before, 0L, "nothing is stored");
      `
    },
    {
      name: 'testEmptyKeyFails',
      documentation: 'A page or client older than the server sends no daoKey.',
      args: 'X x',
      javaCode: `
        long before = count(x);
        Job done = submitAndWait(x, agent(x, "", 3, "emptykey"));
        test(done.getStatus() == JobStatus.FAILED, "an empty key fails the job, actual: " + done.getStatus());
        test(done.getException().contains("Reload and upload again"),
          "the failure tells the user to reload, actual: " + done.getException());
        expect(count(x) - before, 0L, "nothing is stored");
        test(((foam.core.reflow.UploadAgent) done).getCompressed().isEmpty(),
          "the payload is dropped when the job fails, so a FAILED job does not keep thousands of rows");
      `
    },
    {
      name: 'testEmptyPayloadFails',
      documentation: 'A batch whose payload is gone must not complete with nothing stored.',
      args: 'X x',
      javaCode: `
        foam.core.reflow.UploadAgent agent = new foam.core.reflow.UploadAgent();
        agent.setDaoKey(UPLOAD_DAO);
        Job done = submitAndWait(x, agent);
        test(done.getStatus() == JobStatus.FAILED, "a batch with no rows fails, actual: " + done.getStatus());
        test(done.getException().contains("UploadAgent received no rows"),
          "the failure says there were no rows, actual: " + done.getException());
      `
    },
    {
      name: 'testUserWithoutServiceFails',
      documentation: `The request this replaces was refused without service.<daoKey>; the job must be too,
        and must store nothing. Executed directly as the user so the test pins resolveDAO itself.`,
      args: 'X x',
      javaCode: `
        User user = new User.Builder(x).setId(486401L).build();
        X ux = x.put("subject", new Subject.Builder(x).setUser(user).build())
          .put("auth", new ProxyAuthService(x) {
            public boolean check(X cx, String permission) { return false; }
          });
        long before = count(x);
        String failure = "";
        try {
          agent(x, UPLOAD_DAO, 3, "noservice").execute(ux);
        } catch ( Exception e ) {
          failure = e.getClass().getSimpleName();
        }
        test(failure.contains("AuthorizationException"), "a user without service.uploadJobTestDAO is refused, actual: " + failure);
        expect(count(x) - before, 0L, "nothing is stored");
      `
    },

    //
    // Helpers
    //
    {
      name: 'row',
      type: 'foam.core.reflow.test.UploadTestRow',
      args: 'String name',
      javaCode: `
        return new UploadTestRow.Builder(getX()).setName(name).build();
      `
    },
    {
      name: 'agent',
      documentation: 'A batch of n rows as the browser sends it: compressed JSON in the compressed property.',
      type: 'foam.core.reflow.UploadAgent',
      args: 'X x, String key, int n, String tag',
      javaCode: `
        try {
          StringBuilder json = new StringBuilder("[");
          for ( int i = 0 ; i < n ; i++ ) {
            JSONFObjectFormatter f = new JSONFObjectFormatter(x);
            f.output(row(tag + "-" + i));
            if ( i > 0 ) json.append(',');
            json.append(f.builder());
          }
          json.append(']');

          ByteArrayOutputStream bytes = new ByteArrayOutputStream();
          try ( GZIPOutputStream gz = new GZIPOutputStream(bytes) ) {
            gz.write(json.toString().getBytes("UTF-8"));
          }
          foam.core.reflow.UploadAgent agent = new foam.core.reflow.UploadAgent();
          agent.setDaoKey(key);
          agent.setCompressed(Base64.getEncoder().encodeToString(bytes.toByteArray()));
          return agent;
        } catch ( java.io.IOException e ) {
          throw new RuntimeException(e);
        }
      `
    },
    {
      name: 'submitAndWait',
      documentation: 'Submit through the jobDAO as a client does and wait for the job to end.',
      type: 'foam.core.job.Job',
      args: 'X x, foam.core.reflow.UploadAgent agent',
      javaCode: `
        DAO jobDAO = ((DAO) x.get("jobDAO")).inX(x);
        return await(jobDAO, ((Job) jobDAO.put(agent)).getId());
      `
    },
    {
      name: 'await',
      type: 'foam.core.job.Job',
      args: 'foam.dao.DAO jobDAO, String id',
      javaCode: `
        long deadline = System.currentTimeMillis() + AWAIT_TIMEOUT;
        while ( System.currentTimeMillis() < deadline ) {
          Job job = (Job) jobDAO.find(id);
          if ( job != null && ( job.getStatus() == JobStatus.COMPLETED || job.getStatus() == JobStatus.FAILED ) )
            return job;
          sleep(25);
        }
        return (Job) jobDAO.find(id);
      `
    },
    {
      name: 'count',
      type: 'Long',
      args: 'X x',
      javaCode: `
        return ((Count) ((DAO) x.get(UPLOAD_DAO)).select(COUNT())).getValue();
      `
    },
    {
      name: 'sleep',
      args: 'long ms',
      javaCode: `
        try {
          Thread.sleep(ms);
        } catch ( InterruptedException e ) { }
      `
    }
  ]
});
