/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.lang.test',
  name: 'NamedPropertyInfoTest',
  extends: 'foam.core.test.Test',
  flags: ['java'],

  documentation: `
    Unit tests for foam.lang.NamedPropertyInfo.

    A NamedPropertyInfo wraps a property NAME and resolves the target axiom
    from each object's ClassInfo on every access. These tests pin down:
      - get/set forward to the target axiom on the actual object
      - getName returns the wrapped name
      - equals/compareTo are name-based (don't NPE when classInfo is null)
      - FSMDAO operates unchanged when given a NamedPropertyInfo — proving
        the wrapper is transparent to the existing PropertyInfo-mode
        constructor and to the String-constructor convenience path
  `,

  javaImports: [
    'foam.dao.DAO',
    'foam.dao.FSMDAO',
    'foam.dao.MDAO',
    'foam.lang.NamedPropertyInfo',
    'foam.lang.PropertyInfo',
    'foam.lang.StateTransition',
    'foam.lang.X',
    'foam.lang.XLocator',
    'foam.lang.test.TestStateMachine',
    'foam.lang.test.TestStateMachineHolder'
  ],

  methods: [
    {
      name: 'runTest',
      args: [{ name: 'x', type: 'Context' }],
      javaCode: `
        XLocator.set(x);
        runOne(x, "testGetReturnsTargetValue");
        runOne(x, "testSetWritesToTarget");
        runOne(x, "testClearDelegatesToTarget");
        runOne(x, "testGetNameReturnsProvidedName");
        runOne(x, "testEqualsIsNameBased");
        runOne(x, "testCompareToIsNameBased");
        runOne(x, "testFSMDAOWithDelegateFullLifecycle");
        runOne(x, "testFSMDAOStringConstructorRoutesThroughDelegate");
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
      name: 'testGetReturnsTargetValue',
      args: [{ name: 'x', type: 'Context' }],
      javaCode: `
        PropertyInfo delegate = NamedPropertyInfo.forName("status");
        TestStateMachineHolder h = new TestStateMachineHolder.Builder(x)
          .setId(1L).setStatus(TestStateMachine.NEW).build();
        Object viaDelegate = delegate.get(h);
        Object viaReal     = TestStateMachineHolder.STATUS.get(h);
        test(viaDelegate == TestStateMachine.NEW,
          "delegate.get returns NEW; got " +
            (viaDelegate == null ? "null" : viaDelegate.toString()));
        test(viaDelegate == viaReal,
          "delegate.get == real STATUS.get on same object");
      `
    },
    {
      name: 'testSetWritesToTarget',
      args: [{ name: 'x', type: 'Context' }],
      javaCode: `
        PropertyInfo delegate = NamedPropertyInfo.forName("status");
        TestStateMachineHolder h = new TestStateMachineHolder.Builder(x)
          .setId(2L).setStatus(TestStateMachine.NEW).build();
        delegate.set(h, TestStateMachine.ACTIVE);
        test(h.getStatus() == TestStateMachine.ACTIVE,
          "delegate.set wrote ACTIVE; got " +
            (h.getStatus() == null ? "null" : h.getStatus().getName()));
        test(TestStateMachineHolder.STATUS.get(h) == TestStateMachine.ACTIVE,
          "real STATUS.get observes the delegate's write");
      `
    },
    {
      name: 'testClearDelegatesToTarget',
      args: [{ name: 'x', type: 'Context' }],
      javaCode: `
        PropertyInfo delegate = NamedPropertyInfo.forName("status");
        TestStateMachineHolder h = new TestStateMachineHolder.Builder(x)
          .setId(3L).setStatus(TestStateMachine.ACTIVE).build();
        test(TestStateMachineHolder.STATUS.isSet(h),
          "status is set before clear");
        delegate.clear(h);
        test(! TestStateMachineHolder.STATUS.isSet(h),
          "status is unset after delegate.clear");
      `
    },
    {
      name: 'testGetNameReturnsProvidedName',
      args: [{ name: 'x', type: 'Context' }],
      javaCode: `
        PropertyInfo delegate = NamedPropertyInfo.forName("status");
        test("status".equals(delegate.getName()),
          "getName returns 'status'; got " + delegate.getName());
      `
    },
    {
      name: 'testEqualsIsNameBased',
      args: [{ name: 'x', type: 'Context' }],
      javaCode: `
        PropertyInfo a = NamedPropertyInfo.forName("status");
        PropertyInfo b = NamedPropertyInfo.forName("status");
        PropertyInfo c = NamedPropertyInfo.forName("other");
        test(a.equals(b), "two delegates with same name are equal");
        test(! a.equals(c), "delegates with different names are not equal");
        test(a.hashCode() == b.hashCode(),
          "equal delegates have equal hashCode");
      `
    },
    {
      name: 'testCompareToIsNameBased',
      args: [{ name: 'x', type: 'Context' }],
      javaCode: `
        PropertyInfo a = NamedPropertyInfo.forName("status");
        PropertyInfo b = NamedPropertyInfo.forName("status");
        // Must not NPE despite getClassInfo() == null on both.
        int cmp = 0;
        String err = "";
        try { cmp = a.compareTo(b); }
        catch (Exception e) { err = e.getClass().getSimpleName() + ": " + e.getMessage(); }
        test(err.isEmpty(), "compareTo does not throw; got " + err);
        test(cmp == 0, "compareTo same-name delegates returns 0; got " + cmp);
      `
    },
    {
      name: 'testFSMDAOWithDelegateFullLifecycle',
      args: [{ name: 'x', type: 'Context' }],
      javaCode: `
        DAO mdao = new MDAO(TestStateMachineHolder.getOwnClassInfo());
        DAO dao  = new FSMDAO(x, NamedPropertyInfo.forName("status"), mdao);

        // Create with initial state. Don't reassign h — dao.put() returns
        // a frozen copy; we want to keep mutating the original.
        TestStateMachineHolder h = new TestStateMachineHolder.Builder(x)
          .setId(99L).setStatus(TestStateMachine.NEW).build();
        dao.put(h);
        TestStateMachineHolder fetched = (TestStateMachineHolder) dao.find(99L);
        test(fetched != null && fetched.getStatus() == TestStateMachine.NEW,
          "create with initial NEW persists via delegate; got " +
            (fetched == null ? "null fetched" :
              (fetched.getStatus() == null ? "null status" : fetched.getStatus().getName())));

        // Valid transition fires the full FSMDAO pipeline through the delegate.
        h.setStatus(TestStateMachine.ACTIVE);
        TestStateMachineHolder after = null;
        String err = "";
        try { after = (TestStateMachineHolder) dao.put(h); }
        catch (Exception e) { err = e.getMessage(); }
        test(after != null && after.getStatus() == TestStateMachine.ACTIVE,
          "NEW→ACTIVE persisted via delegate; err: " + err);

        // History accrues — proves FSMDAO's sibling lookup
        // (prop.getName() + "History" against delegate.getOf()) still resolves
        // statusHistory on the real class.
        if ( after != null ) {
          StateTransition[] hist = after.getStatusHistory();
          test(hist != null && hist.length == 1,
            "history length 1 after one transition; got " +
              (hist == null ? "null" : String.valueOf(hist.length)));
          if ( hist != null && hist.length >= 1 ) {
            test("NEW".equals(hist[0].getFrom()) && "ACTIVE".equals(hist[0].getTo()),
              "history[0] is NEW→ACTIVE; got " +
                hist[0].getFrom() + "→" + hist[0].getTo());
          }
        }

        // Invalid transition still throws. ACTIVE only allows
        // [GUARDED, DEADLINE, DONE, FAILED] and ACTIVE is not terminal,
        // so ACTIVE→NEW is invalid.
        h.setStatus(TestStateMachine.NEW);
        boolean threw = false;
        try { dao.put(h); }
        catch (RuntimeException e) { threw = true; }
        test(threw,
          "invalid transition ACTIVE→NEW throws via delegate-driven FSMDAO");
      `
    },
    {
      name: 'testFSMDAOStringConstructorRoutesThroughDelegate',
      args: [{ name: 'x', type: 'Context' }],
      javaCode: `
        // new FSMDAO(x, "status", mdao) is a thin convenience that wraps
        // the name in a NamedPropertyInfo. Behaviour must match the
        // explicit delegate form.
        DAO mdao = new MDAO(TestStateMachineHolder.getOwnClassInfo());
        DAO dao  = new FSMDAO(x, "status", mdao);

        TestStateMachineHolder h = new TestStateMachineHolder.Builder(x)
          .setId(123L).setStatus(TestStateMachine.NEW).build();
        dao.put(h);

        h.setStatus(TestStateMachine.ACTIVE);
        TestStateMachineHolder after = null;
        String err = "";
        try { after = (TestStateMachineHolder) dao.put(h); }
        catch (Exception e) { err = e.getMessage(); }
        test(after != null && after.getStatus() == TestStateMachine.ACTIVE,
          "string-ctor FSMDAO transitions NEW→ACTIVE; err: " + err);

        if ( after != null ) {
          StateTransition[] hist = after.getStatusHistory();
          test(hist != null && hist.length == 1,
            "string-ctor FSMDAO records history; length=" +
              (hist == null ? "null" : String.valueOf(hist.length)));
        }
      `
    }
  ]
});
