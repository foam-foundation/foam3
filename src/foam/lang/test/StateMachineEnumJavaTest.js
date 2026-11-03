/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.lang.test',
  name: 'StateMachineEnumJavaTest',
  extends: 'foam.core.test.Test',
  flags: ['java'],

  documentation: 'Java interface contract for StateMachineEnum: default no-ops, onUpdate returns this.',

  javaImports: [
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
        try {
          testDefaultsAreNoOps(x);
        } catch (Exception e) {
          test(false, "testDefaultsAreNoOps threw: " + e.getMessage());
        }
        try {
          testOnUpdateDefaultReturnsThis(x);
        } catch (Exception e) {
          test(false, "testOnUpdateDefaultReturnsThis threw: " + e.getMessage());
        }
      `
    },
    {
      name: 'testDefaultsAreNoOps',
      args: [{ name: 'x', type: 'Context' }],
      javaCode: `
        TestStateMachine s = TestStateMachine.NEW;
        TestStateMachineHolder h = new TestStateMachineHolder.Builder(x).build();
        boolean threw = false;
        String err = "";
        try {
          s.checkGuard(x, h, TestStateMachine.ACTIVE);
          s.onEnter(x, h, null);
          s.onExit(x, h, TestStateMachine.ACTIVE);
          s.onTransition(x, h, TestStateMachine.ACTIVE);
        } catch (Exception e) {
          threw = true;
          err = e.getMessage();
        }
        test(! threw,
          "default checkGuard/onEnter/onExit/onTransition are no-ops; err: " + err);
      `
    },
    {
      name: 'testOnUpdateDefaultReturnsThis',
      args: [{ name: 'x', type: 'Context' }],
      javaCode: `
        TestStateMachine s = TestStateMachine.NEW;
        TestStateMachineHolder h = new TestStateMachineHolder.Builder(x).build();
        Object after = null;
        String err = "";
        try {
          after = s.onUpdate(x, h, null);
        } catch (Exception e) {
          err = e.getMessage();
        }
        test(after == s, "default onUpdate returns this; got " +
          (after == null ? "null" : after.getClass().getName()) + " err: " + err);
      `
    }
  ]
});
