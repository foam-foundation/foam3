/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.lang.test',
  name: 'StateMachineEnumTest',
  extends: 'foam.core.test.JSTest',

  documentation: 'Unit tests for StateMachineEnum JS methods.',

  requires: [
    'foam.lang.test.TestStateMachine',
    'foam.lang.test.TestStateMachineHolder'
  ],

  methods: [
    async function runTest(x) {
      var ok = true, err = '';
      try {
        await this.testCanTransitionTo(x);
        await this.testGetAvailableTransitions(x);
        await this.testAssertCanTransitionTo(x);
        await this.testExecuteTransitionTransitionsAndRecords(x);
        await this.testRecordTransitionAppendsHistory(x);
      } catch (e) {
        ok = false;
        err = (e && e.message) || String(e);
      }
      x.test(ok, 'runTest threw no top-level errors; got: ' + err);
    },

    async function testCanTransitionTo(x) {
      var Status = this.TestStateMachine;
      var holder = this.TestStateMachineHolder.create({ status: Status.ACTIVE });

      var r1, e1 = '';
      try { r1 = await Status.ACTIVE.canTransitionTo('NEW', holder); }
      catch (e) { e1 = (e && e.message) || String(e); }
      x.test(r1 === false, 'canTransitionTo: false for unlisted target NEW; got ' + r1 + ' err: ' + e1);

      holder.allowGuarded = false;
      var r2, e2 = '';
      try { r2 = await Status.ACTIVE.canTransitionTo('GUARDED', holder); }
      catch (e) { e2 = (e && e.message) || String(e); }
      x.test(r2 === false, 'canTransitionTo: false when guard returns reason; got ' + r2 + ' err: ' + e2);

      holder.allowGuarded = true;
      var r3, e3 = '';
      try { r3 = await Status.ACTIVE.canTransitionTo('GUARDED', holder); }
      catch (e) { e3 = (e && e.message) || String(e); }
      x.test(r3 === true, 'canTransitionTo: true when guard returns null; got ' + r3 + ' err: ' + e3);

      var r4, e4 = '';
      try { r4 = await Status.ACTIVE.canTransitionTo('DEADLINE', holder); }
      catch (e) { e4 = (e && e.message) || String(e); }
      x.test(r4 === true, 'canTransitionTo: true for listed transition with no guard; got ' + r4 + ' err: ' + e4);
    },

    async function testGetAvailableTransitions(x) {
      var Status = this.TestStateMachine;
      var holder = this.TestStateMachineHolder.create({ status: Status.ACTIVE, allowGuarded: false });
      var avail, err = '';
      try { avail = await Status.ACTIVE.getAvailableTransitions(holder); }
      catch (e) { err = (e && e.message) || String(e); }
      x.test(Array.isArray(avail), 'getAvailableTransitions returns array; err: ' + err);
      if ( ! Array.isArray(avail) ) return;
      var names = avail.map(function(s) { return s.name; });
      x.test(names.includes('DEADLINE'), 'available includes DEADLINE; got ' + names.join(','));
      x.test(names.includes('DONE'),     'available includes DONE; got ' + names.join(','));
      x.test(! names.includes('GUARDED'),
        'available excludes GUARDED when guard fails; got ' + names.join(','));
    },

    async function testAssertCanTransitionTo(x) {
      var Status = this.TestStateMachine;
      var holder = this.TestStateMachineHolder.create({ status: Status.ACTIVE });
      var msg = '', threw = false;
      try { await Status.ACTIVE.assertCanTransitionTo('NEW', holder); }
      catch (e) { threw = true; msg = (e && e.message) || String(e); }
      x.test(threw, 'assertCanTransitionTo throws for unlisted target NEW');
      x.test(msg.indexOf('Invalid state transition') >= 0,
        'message contains "Invalid state transition", got: ' + msg);
    },

    async function testExecuteTransitionTransitionsAndRecords(x) {
      // Note: per-value JS callbacks (onExit/onEnter/onTransition) are NOT a
      // supported feature on `main` — those are class-level no-op Java methods
      // in StateMachineEnum.js. Production FSMs override them via `javaCode:`
      // blocks per value, which only fires on the Java side. Here we verify
      // the JS path of executeTransitionTo: no-op callbacks run cleanly,
      // state advances, and history is recorded.
      var Status = this.TestStateMachine;
      var holder = this.TestStateMachineHolder.create({ status: Status.NEW });
      var err = '';
      try { await holder.transitionStatusTo('ACTIVE'); }
      catch (e) { err = (e && e.message) || String(e); }
      x.test(holder.status === Status.ACTIVE,
        'state advanced NEW→ACTIVE via transitionStatusTo; got ' +
        (holder.status && holder.status.name) + ' err: ' + err);
      x.test(holder.statusHistory && holder.statusHistory.length === 1,
        'one history entry recorded; got ' +
        (holder.statusHistory && holder.statusHistory.length) + ' err: ' + err);
    },

    async function testRecordTransitionAppendsHistory(x) {
      var Status = this.TestStateMachine;
      var holder = this.TestStateMachineHolder.create({ status: Status.NEW });
      var err = '';
      try { await holder.transitionStatusTo('ACTIVE', 'opt note'); }
      catch (e) { err = (e && e.message) || String(e); }
      x.test(holder.statusHistory.length === 1,
        'history length 1 after first transition, got ' + holder.statusHistory.length + ' err: ' + err);
      if ( holder.statusHistory.length === 0 ) return;
      x.test(holder.statusHistory[0].from === 'NEW',
        'history[0].from === NEW, got ' + holder.statusHistory[0].from);
      x.test(holder.statusHistory[0].to === 'ACTIVE',
        'history[0].to === ACTIVE, got ' + holder.statusHistory[0].to);
      x.test(holder.statusHistory[0].note === 'opt note',
        'history[0].note recorded, got ' + holder.statusHistory[0].note);
    }
  ]
});
