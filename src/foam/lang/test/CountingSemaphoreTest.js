/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.lang.test',
  name: 'CountingSemaphoreTest',
  extends: 'foam.core.test.JSTest',

  documentation: `A block that fails must reject the promise then() returns. It used to resolve,
    so a caller that waited on it could not tell a failed block from a finished one.
    The slot must still be given back, so the blocks queued behind it still run.`,

  requires: [ 'foam.lang.CountingSemaphore' ],

  methods: [
    async function runTest(x) {
      var sem = this.CountingSemaphore.create({ limit: 1 });

      var rejected = null;
      try {
        await sem.then(async () => { throw new Error('block failed'); });
      } catch (e) { rejected = e; }
      x.test(rejected && rejected.message === 'block failed', 'a rejected block rejects then()');
      x.test(sem.count_ === 0, 'the count returns to 0 after a rejection, actual: ' + sem.count_);

      // Limit 1: the second block queues behind the first, which fails.
      var ran = false;
      var failing = sem.then(async () => { await new Promise(r => setTimeout(r, 20)); throw new Error('first failed'); });
      var queued  = sem.then(async () => { ran = true; return 'queued done'; });
      var firstError = null;
      try { await failing; } catch (e) { firstError = e; }
      var queuedResult = await queued;
      x.test(firstError && firstError.message === 'first failed', 'the failing block rejects');
      x.test(ran && queuedResult === 'queued done', 'a block queued behind a failed one still runs');
      await sem.drain();
      x.test(sem.count_ === 0, 'the count is 0 once everything ended, actual: ' + sem.count_);

      var ok = await sem.then(async () => 'fine');
      x.test(ok === 'fine', 'a block that succeeds resolves with its value');
    }
  ]
});
