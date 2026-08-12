/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.partition.test',
  name: 'PartitionLoadProgressDAOTest',
  extends: 'foam.core.test.JSTest',

  requires: [
    'foam.core.partition.PartitionLoadProgressDAO',
    'foam.core.partition.PartitionLoadStatus',
    'foam.core.partition.PartitionLoadToastStack',
    'foam.dao.MDAO',
    'foam.dao.PromisedDAO'
  ],

  methods: [
    async function runTest(x) {
      try {
        // Status DAO with one active row for service key 'svcA'.
        var statusDAO = this.MDAO.create({ of: this.PartitionLoadStatus });
        await statusDAO.put(this.PartitionLoadStatus.create({
          id: 'jrnA', serviceName: 'svcA', partition: '2026/7',
          totalBytes: 1000, bytesRead: 400
        }));

        var subX = x.createSubContext({ partitionLoadStatusDAO: statusDAO });

        // PartitionLoadToastStack.create() is memoized process-wide (manual
        // singleton, not context-scoped -- see the documentation on
        // PartitionLoadToastStack.js), so whichever instance already exists
        // must be configured directly rather than via context injection.
        var stack = this.PartitionLoadToastStack.create(null, subX);
        x.test(this.PartitionLoadToastStack.create() === stack,
            'toast stack is a process-wide singleton');
        stack.partitionLoadStatusDAO = statusDAO;
        stack.pollInterval = 100;

        // Delegate that resolves after 700ms -- slower than showDelay 400ms,
        // with enough margin past the 400/500/600ms checkpoints below that
        // the settle-triggered unwatch can't race them.
        var slow = this.PromisedDAO.create({
          promise: new Promise(function(resolve) {
            setTimeout(function() {
              resolve(foam.dao.MDAO.create({ of: foam.core.partition.PartitionLoadStatus }, subX));
            }, 700);
          })
        }, subX);

        var dao = this.PartitionLoadProgressDAO.create({
          delegate: slow, serviceKey: 'svcA', showDelay: 400
        }, subX);

        var p = dao.select();

        await new Promise(function(r) { setTimeout(r, 450); });
        x.test(Object.keys(stack.watched_).length === 1,
            'stack watching svcA while op pending past showDelay');

        await new Promise(function(r) { setTimeout(r, 100); });
        x.test(stack.rows_.length === 1, 'active status row surfaced as a card row');

        // Fast op mid-flight (slow op still pending until 700ms): must never
        // watch, and must not disturb the slow op's existing watch refcount.
        var fast = this.PartitionLoadProgressDAO.create({
          delegate: this.MDAO.create({ of: this.PartitionLoadStatus }, subX),
          serviceKey: 'svcA', showDelay: 400
        }, subX);
        await fast.select();

        await new Promise(function(r) { setTimeout(r, 100); });
        x.test(Object.keys(stack.watched_).length === 1,
            'fast op never triggers watch; slow op refcount undisturbed');
        x.test(stack.rows_.length === 1, 'slow op card still rendered after fast op settles');

        await p;
        x.test(Object.keys(stack.watched_).length === 0, 'unwatched after slow op settles');
      } catch (e) {
        x.test(false, 'unexpected exception: ' + (e && e.message ? e.message : e));
      }
    }
  ]
});
