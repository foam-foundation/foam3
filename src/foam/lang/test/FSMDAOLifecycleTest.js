/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.lang.test',
  name: 'FSMDAOLifecycleTest',
  extends: 'foam.core.test.Test',
  flags: ['java'],

  documentation: 'End-to-end golden traces of FSMDAO over the synthetic TestStateMachine.',

  javaImports: [
    'foam.dao.DAO',
    'foam.lang.StateTransition',
    'foam.lang.X',
    'foam.lang.XLocator',
    'foam.lang.test.FSMTestHelpers',
    'foam.lang.test.TestStateMachine',
    'foam.lang.test.TestStateMachineHolder'
  ],

  methods: [
    {
      name: 'runTest',
      args: [{ name: 'x', type: 'Context' }],
      javaCode: `
        XLocator.set(x);
        try { traceHappyPath(x); }
        catch (Exception e) { test(false, "traceHappyPath threw: " + e.getMessage()); }
        try { traceTerminalRecreate(x); }
        catch (Exception e) { test(false, "traceTerminalRecreate threw: " + e.getMessage()); }
      `
    },
    {
      name: 'traceHappyPath',
      args: [{ name: 'x', type: 'Context' }],
      javaCode: `
        DAO dao = FSMTestHelpers.buildFSMDAO(x);
        TestStateMachineHolder h = new TestStateMachineHolder.Builder(x)
          .setId(101L).setStatus(TestStateMachine.NEW).build();
        dao.put(h);
        h.setStatus(TestStateMachine.ACTIVE);   dao.put(h);
        h.setStatus(TestStateMachine.DEADLINE); dao.put(h);
        h.setStatus(TestStateMachine.DONE);
        TestStateMachineHolder fin = (TestStateMachineHolder) dao.put(h);

        StateTransition[] hist = fin.getStatusHistory();
        test(hist != null && hist.length == 3,
          "happy path: history length 3; got " +
            (hist == null ? "null" : String.valueOf(hist.length)));
        if ( hist != null && hist.length == 3 ) {
          FSMTestHelpers.assertHistoryEquals(this, hist, new String[][] {
            { "NEW", "ACTIVE" }, { "ACTIVE", "DEADLINE" }, { "DEADLINE", "DONE" }
          });
        }
      `
    },
    {
      name: 'traceTerminalRecreate',
      args: [{ name: 'x', type: 'Context' }],
      javaCode: `
        DAO dao = FSMTestHelpers.buildFSMDAO(x);
        TestStateMachineHolder h = new TestStateMachineHolder.Builder(x)
          .setId(102L).setStatus(TestStateMachine.NEW).build();
        dao.put(h);
        h.setStatus(TestStateMachine.ACTIVE); dao.put(h);
        h.setStatus(TestStateMachine.DONE);   dao.put(h);

        h.setStatus(TestStateMachine.NEW);
        boolean threw = false;
        String msg = "";
        try { dao.put(h); }
        catch (RuntimeException e) { threw = true; msg = e.getMessage() == null ? "" : e.getMessage(); }
        test(! threw, "terminal DONE → initial NEW allowed; err: " + msg);

        TestStateMachineHolder fin = (TestStateMachineHolder) dao.find(102L);
        test(fin != null && fin.getStatusHistory() != null && fin.getStatusHistory().length >= 3,
          "history preserved across recreate; length=" +
            (fin == null ? "null fin" :
              (fin.getStatusHistory() == null ? "null hist" :
                String.valueOf(fin.getStatusHistory().length))));
      `
    }
  ]
});
