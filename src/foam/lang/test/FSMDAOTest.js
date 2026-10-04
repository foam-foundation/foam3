/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.lang.test',
  name: 'FSMDAOTest',
  extends: 'foam.core.test.Test',
  flags: ['java'],

  documentation: 'Direct unit tests of FSMDAO put_ behavior using TestStateMachineHolder.',

  javaImports: [
    'foam.dao.DAO',
    'foam.dao.FSMDAO',
    'foam.dao.MDAO',
    'foam.lang.PropertyInfo',
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
        runOne(x, "testCreateWithInitialStatePersists");
        runOne(x, "testCreateWithNonInitialStateThrows");
        runOne(x, "testValidTransitionRunsFullPipeline");
        runOne(x, "testInvalidTransitionThrows");
        runOne(x, "testTerminalToInitialAllowed");
        runOne(x, "testHistoryAppendedNotReplaced");
        runOne(x, "testNextActivitySetClearedUntouched");
        runOne(x, "testSkipCallbacksOnCreate");
        // Note: testStringConstructorResolvesProp lives only on swam-all
        // (the FSMDAO(X, String, DAO) constructor is introduced there).
        // Add it post-merge as forward-compat coverage.
      `
    },
    {
      name: 'runOne',
      args: [{ name: 'x', type: 'Context' }, { name: 'methodName', type: 'String' }],
      javaCode: `
        try {
          getClass().getMethod(methodName, foam.lang.X.class).invoke(this, x);
        } catch (Throwable t) {
          Throwable cause = t.getCause() != null ? t.getCause() : t;
          test(false, methodName + " threw: " + cause.getClass().getSimpleName() +
            ": " + cause.getMessage());
        }
      `
    },
    {
      name: 'testCreateWithInitialStatePersists',
      args: [{ name: 'x', type: 'Context' }],
      javaCode: `
        DAO dao = FSMTestHelpers.buildFSMDAO(x);
        TestStateMachineHolder h = new TestStateMachineHolder.Builder(x)
          .setId(1L)
          .setStatus(TestStateMachine.NEW)
          .build();
        h = (TestStateMachineHolder) dao.put(h);
        test(h.getStatus() == TestStateMachine.NEW,
          "create with initial NEW persists; got " +
            (h.getStatus() == null ? "null" : h.getStatus().getName()));
        TestStateMachineHolder fetched = (TestStateMachineHolder) dao.find(1L);
        test(fetched != null, "find returns persisted holder");
        test(fetched != null && fetched.getStatus() == TestStateMachine.NEW,
          "fetched status is NEW; got " +
            (fetched == null ? "null fetched" :
              (fetched.getStatus() == null ? "null status" : fetched.getStatus().getName())));
      `
    },
    {
      name: 'testCreateWithNonInitialStateThrows',
      args: [{ name: 'x', type: 'Context' }],
      javaCode: `
        DAO dao = FSMTestHelpers.buildFSMDAO(x);
        TestStateMachineHolder h = new TestStateMachineHolder.Builder(x)
          .setId(2L)
          .setStatus(TestStateMachine.ACTIVE)
          .build();
        boolean threw = false;
        String msg = "";
        try { dao.put(h); }
        catch (RuntimeException e) { threw = true; msg = e.getMessage() == null ? "" : e.getMessage(); }
        test(threw, "create with non-initial ACTIVE throws RuntimeException");
        test(msg.contains("non-initial"),
          "exception message mentions 'non-initial'; got: " + msg);
      `
    },
    {
      name: 'testValidTransitionRunsFullPipeline',
      args: [{ name: 'x', type: 'Context' }],
      javaCode: `
        DAO dao = FSMTestHelpers.buildFSMDAO(x);
        TestStateMachineHolder h = new TestStateMachineHolder.Builder(x)
          .setId(3L)
          .setStatus(TestStateMachine.NEW)
          .build();
        dao.put(h);

        h.setStatus(TestStateMachine.ACTIVE);
        TestStateMachineHolder after = null;
        String err = "";
        try { after = (TestStateMachineHolder) dao.put(h); }
        catch (Exception e) { err = e.getMessage(); }
        test(after != null && after.getStatus() == TestStateMachine.ACTIVE,
          "transition NEW→ACTIVE persisted; err: " + err);
        if ( after == null ) return;
        StateTransition[] hist = after.getStatusHistory();
        test(hist != null && hist.length == 1,
          "history length 1; got " + (hist == null ? "null" : String.valueOf(hist.length)));
        if ( hist != null && hist.length >= 1 ) {
          test("NEW".equals(hist[0].getFrom()) && "ACTIVE".equals(hist[0].getTo()),
            "history[0]: NEW→ACTIVE; got " + hist[0].getFrom() + "→" + hist[0].getTo());
          test(hist[0].getTimestamp() != null, "history[0] timestamp set");
        }
      `
    },
    {
      name: 'testInvalidTransitionThrows',
      args: [{ name: 'x', type: 'Context' }],
      javaCode: `
        DAO dao = FSMTestHelpers.buildFSMDAO(x);
        TestStateMachineHolder h = new TestStateMachineHolder.Builder(x)
          .setId(4L).setStatus(TestStateMachine.NEW).build();
        dao.put(h);

        h.setStatus(TestStateMachine.DONE);
        boolean threw = false;
        String msg = "";
        try { dao.put(h); }
        catch (RuntimeException e) { threw = true; msg = e.getMessage() == null ? "" : e.getMessage(); }
        test(threw, "invalid transition NEW→DONE throws");
        test(msg.contains("Invalid state transition"),
          "message contains 'Invalid state transition'; got: " + msg);
        test(msg.contains("ACTIVE"),
          "message lists allowed transitions including ACTIVE; got: " + msg);
      `
    },
    {
      name: 'testTerminalToInitialAllowed',
      args: [{ name: 'x', type: 'Context' }],
      javaCode: `
        DAO dao = FSMTestHelpers.buildFSMDAO(x);
        TestStateMachineHolder h = new TestStateMachineHolder.Builder(x)
          .setId(5L).setStatus(TestStateMachine.NEW).build();
        dao.put(h);
        h.setStatus(TestStateMachine.ACTIVE);   dao.put(h);
        h.setStatus(TestStateMachine.DONE);     dao.put(h);

        h.setStatus(TestStateMachine.NEW);
        boolean threw = false;
        String msg = "";
        try { dao.put(h); }
        catch (RuntimeException e) { threw = true; msg = e.getMessage() == null ? "" : e.getMessage(); }
        test(! threw, "terminal DONE → initial NEW transition allowed; err: " + msg);
      `
    },
    {
      name: 'testHistoryAppendedNotReplaced',
      args: [{ name: 'x', type: 'Context' }],
      javaCode: `
        DAO dao = FSMTestHelpers.buildFSMDAO(x);
        TestStateMachineHolder h = new TestStateMachineHolder.Builder(x)
          .setId(6L).setStatus(TestStateMachine.NEW).build();
        dao.put(h);
        h.setStatus(TestStateMachine.ACTIVE);   dao.put(h);
        h.setStatus(TestStateMachine.DEADLINE); dao.put(h);
        h.setStatus(TestStateMachine.DONE);
        TestStateMachineHolder after = (TestStateMachineHolder) dao.put(h);

        StateTransition[] hist = after.getStatusHistory();
        test(hist != null && hist.length == 3,
          "history length 3 after 3 transitions; got " +
            (hist == null ? "null" : String.valueOf(hist.length)));
        if ( hist != null && hist.length == 3 ) {
          FSMTestHelpers.assertHistoryEquals(this, hist, new String[][] {
            { "NEW", "ACTIVE" }, { "ACTIVE", "DEADLINE" }, { "DEADLINE", "DONE" }
          });
        }
      `
    },
    {
      name: 'testNextActivitySetClearedUntouched',
      args: [{ name: 'x', type: 'Context' }],
      javaCode: `
        DAO dao = FSMTestHelpers.buildFSMDAO(x);
        TestStateMachineHolder h = new TestStateMachineHolder.Builder(x)
          .setId(7L).setStatus(TestStateMachine.NEW).build();
        dao.put(h);
        long before = System.currentTimeMillis();

        h.setStatus(TestStateMachine.ACTIVE); dao.put(h);
        h.setStatus(TestStateMachine.DEADLINE);
        TestStateMachineHolder afterDeadline = (TestStateMachineHolder) dao.put(h);
        java.util.Date na = afterDeadline.getStatusNextActivity();
        test(na != null, "DEADLINE has scheduledTime=1000ms, nextActivity should be set; got " +
          (na == null ? "null" : na.toString()));
        if ( na != null ) {
          long delta = na.getTime() - before;
          test(delta >= 900 && delta <= 5000,
            "nextActivity ~1000ms in the future; delta=" + delta);
        }

        h.setStatus(TestStateMachine.DONE);
        TestStateMachineHolder afterDone = (TestStateMachineHolder) dao.put(h);
        test(afterDone.getStatusNextActivity() != null,
          "scheduledTime==0 leaves nextActivity untouched (carries DEADLINE's value); got " +
            (afterDone.getStatusNextActivity() == null ? "null" :
              afterDone.getStatusNextActivity().toString()));
      `
    },
    {
      name: 'testSkipCallbacksOnCreate',
      args: [{ name: 'x', type: 'Context' }],
      javaCode: `
        DAO mdao = new MDAO(TestStateMachineHolder.getOwnClassInfo());
        PropertyInfo prop = (PropertyInfo)
          TestStateMachineHolder.getOwnClassInfo().getAxiomByName("status");
        FSMDAO fsmDao = ((FSMDAO) new FSMDAO(x, prop, mdao)).setSkipCallbacksOnCreate(true);

        TestStateMachineHolder h = new TestStateMachineHolder.Builder(x)
          .setId(9L).setStatus(TestStateMachine.NEW).build();
        String err = "";
        try { fsmDao.put(h); }
        catch (RuntimeException e) { err = e.getMessage(); }
        TestStateMachineHolder fetched = (TestStateMachineHolder) fsmDao.find(9L);
        test(fetched != null,
          "skipCallbacksOnCreate(true) still persists object; err: " + err);
      `
    }
  ]
});
