/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.script.test',
  name: 'ScriptInterruptTest',
  extends: 'foam.core.test.Test',

  documentation: `
    Proves ScriptRunnerDAO stops the thread behind an interrupted script, and
    that a re-run does not orphan a live one.

    threadExecution holds a java.util.concurrent.Future and is transient, so the
    script handed to put_ never carries it: a client cannot hold a Future, and
    it is not marshalled. The stored script is the only place it lives.

    Before the fix, put_ read the Future off the incoming script, so the
    Interrupt button wrote the INTERRUPTED label and cancelled nothing - the
    thread ran on, and (with INTERRUPTED excluded from the run action's status
    set) the script could not be started again either.
  `,

  javaImports: [
    'foam.core.script.Script',
    'foam.core.script.ScriptRunnerDAO',
    'foam.core.script.ScriptStatus',
    'foam.dao.DAO',
    'foam.dao.MDAO',
    'foam.lang.X',
    'java.util.concurrent.Callable',
    'java.util.concurrent.CountDownLatch',
    'java.util.concurrent.FutureTask',
    'java.util.concurrent.TimeUnit'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        interruptCancelsStoredExecution(x);
        rerunCancelsStoredExecution(x);
      `
    },
    {
      // The stored script is what a running agent leaves behind: it carries the
      // Future. The incoming script is what a client sends: it cannot.
      name: 'interruptCancelsStoredExecution',
      args: 'X x',
      javaCode: `
        MDAO mdao = new MDAO(Script.getOwnClassInfo());
        DAO runner = new ScriptRunnerDAO(mdao);

        CountDownLatch started = new CountDownLatch(1);
        FutureTask task = parkedTask(started);
        new Thread(task, "ScriptInterruptTest-interrupt").start();
        test(awaitStart(started), "parked execution reached its blocking call");

        Script stored = new Script.Builder(x).setId("interrupt-cancel").build();
        stored.setStatus(ScriptStatus.RUNNING);
        stored.setThreadExecution(task);
        mdao.put_(x, stored);

        Script incoming = new Script.Builder(x).setId("interrupt-cancel").build();
        incoming.setStatus(ScriptStatus.INTERRUPTED);
        test(incoming.getThreadExecution() == null,
          "an interrupt arriving from a client carries no Future "
          + "- threadExecution is transient (Script.js threadExecution)");

        runner.put_(x, incoming);
        test(task.isCancelled(),
          "FIX: interrupt cancels the execution taken from the STORED script "
          + "- before the fix the incoming null Future short-circuited the guard");
      `
    },
    {
      // Running a script that is still parked must not leave the old execution
      // behind: setThreadExecution replaces the only reference to its Future.
      name: 'rerunCancelsStoredExecution',
      args: 'X x',
      javaCode: `
        MDAO mdao = new MDAO(Script.getOwnClassInfo());
        DAO runner = new ScriptRunnerDAO(mdao);
        X sx = x.put("scriptInterruptTestDAO", runner);

        CountDownLatch started = new CountDownLatch(1);
        FutureTask task = parkedTask(started);
        new Thread(task, "ScriptInterruptTest-rerun").start();
        test(awaitStart(started), "parked execution reached its blocking call");

        Script stored = new Script.Builder(sx).setId("interrupt-rerun").build();
        stored.setStatus(ScriptStatus.INTERRUPTED);
        stored.setDaoKey("scriptInterruptTestDAO");
        stored.setThreadExecution(task);
        mdao.put_(sx, stored);

        // What the run action sends: same id, SCHEDULED, no Future.
        Script incoming = new Script.Builder(sx).setId("interrupt-rerun").build();
        incoming.setStatus(ScriptStatus.SCHEDULED);
        incoming.setDaoKey("scriptInterruptTestDAO");
        incoming.setCode("");
        try {
          runner.put_(sx, incoming);
        } catch ( Throwable t ) {
          // The run itself needs an agency and writes events; neither is what
          // this case asserts, and both may be unavailable in this harness.
          print("re-run put_ threw (run side effects only): " + t);
        }
        test(task.isCancelled(),
          "FIX: scheduling a run over a parked execution cancels it first "
          + "- no thread left running with its Future unreachable");
      `
    },
    {
      // Blocks interruptibly, so cancel(true) is observable via isCancelled().
      name: 'parkedTask',
      args: [ { name: 'started', javaType: 'java.util.concurrent.CountDownLatch' } ],
      javaType: 'java.util.concurrent.FutureTask',
      javaCode: `
        return new FutureTask(new Callable() {
          public Object call() throws Exception {
            started.countDown();
            Thread.sleep(60000);
            return null;
          }
        });
      `
    },
    {
      name: 'awaitStart',
      args: [ { name: 'started', javaType: 'java.util.concurrent.CountDownLatch' } ],
      javaType: 'boolean',
      javaCode: `
        try {
          return started.await(5, TimeUnit.SECONDS);
        } catch ( InterruptedException e ) {
          Thread.currentThread().interrupt();
          return false;
        }
      `
    }
  ]
});
