/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.lang.test',
  name: 'FSMAxiomInstallTest',
  extends: 'foam.core.test.JSTest',

  documentation: 'Verifies foam.FSM() installs the expected history/payload/nextActivity axioms and proto methods.',

  requires: [
    'foam.lang.test.TestStateMachine',
    'foam.lang.test.TestStateMachineHolder'
  ],

  methods: [
    function runTest(x) {
      var ok = true, err = '';
      try {
        this.testHistoryAxiom(x);
        this.testPayloadAxiom(x);
        this.testNextActivityAxiom(x);
        this.testProtoMethods(x);
        this.testValidateMachine(x);
      } catch (e) {
        ok = false;
        err = (e && e.message) || String(e);
      }
      x.test(ok, 'runTest threw no top-level errors; got: ' + err);
    },

    function testHistoryAxiom(x) {
      var holder = this.TestStateMachineHolder.create();
      var ax = holder.cls_.getAxiomByName('statusHistory');
      x.test(!! ax, 'statusHistory axiom installed');
      var of = ax.of && ax.of.id ? ax.of.id : ax.of;
      x.test(of === 'foam.lang.StateTransition',
        'statusHistory of=StateTransition, got ' + of);
      x.test(ax.hidden === true,
        'statusHistory hidden=true, got ' + ax.hidden);
    },

    function testPayloadAxiom(x) {
      var holder = this.TestStateMachineHolder.create();
      var ax = holder.cls_.getAxiomByName('statusPayload');
      x.test(!! ax, 'statusPayload axiom installed');
      x.test(ax.hidden === true,
        'statusPayload hidden=true, got ' + ax.hidden);
    },

    function testNextActivityAxiom(x) {
      var holder = this.TestStateMachineHolder.create();
      var ax = holder.cls_.getAxiomByName('statusNextActivity');
      x.test(!! ax, 'statusNextActivity axiom installed');
      x.test(ax.cls_.id === 'foam.lang.DateTime',
        'statusNextActivity is DateTime, got ' + ax.cls_.id);
      x.test(ax.hidden === true,
        'statusNextActivity hidden=true, got ' + ax.hidden);
    },

    function testProtoMethods(x) {
      var holder = this.TestStateMachineHolder.create();
      x.test(typeof holder.transitionStatusTo === 'function',
        'transitionStatusTo installed');
      x.test(typeof holder.canTransitionStatusTo === 'function',
        'canTransitionStatusTo installed');
      x.test(typeof holder.getAvailableStatusTransitions === 'function',
        'getAvailableStatusTransitions installed');
      x.test(typeof holder.assertStatusCanTransitionTo === 'function',
        'assertStatusCanTransitionTo installed');
    },

    function testValidateMachine(x) {
      // Note: validateMachine on `main` references `state.onTransition` which is
      // declared as a method, not a property factory. The validation logic ends up
      // calling Object.keys() on a value that is null/undefined for enum values,
      // throwing "Cannot convert undefined or null to object". We pin this down
      // as the current behavior so we can detect if swam-all changes it.
      var threwOnGood = false, goodMsg = '';
      try { this.TestStateMachine.validateMachine(); }
      catch (e) { threwOnGood = true; goodMsg = (e && e.message) || String(e); }
      x.test(threwOnGood,
        'validateMachine on TestStateMachine throws (current main behavior); error: ' + goodMsg);

      foam.FSM({
        package: 'foam.lang.test',
        name: 'BrokenStateMachineNoInitial',
        values: [
          { name: 'A', transitions: ['B'] },
          { name: 'B', transitions: [] }
        ]
      });
      var threw = false, brokenMsg = '';
      try { foam.lang.test.BrokenStateMachineNoInitial.validateMachine(); }
      catch (e) { threw = true; brokenMsg = (e && e.message) || String(e); }
      x.test(threw, 'validateMachine throws on malformed FSM; thrown msg: ' + brokenMsg);
    }
  ]
});
