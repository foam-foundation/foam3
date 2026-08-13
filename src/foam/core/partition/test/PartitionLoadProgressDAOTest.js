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

        var subX = x.createSubContext({ partitionLoadStatusReadDAO: statusDAO });

        // partitionLoadToastStack is a context-scoped service (services.jrl,
        // lazyClient: false), not a process-wide singleton -- build one
        // instance and place it in the sub-context so every decorator
        // created in that context imports the same instance, mirroring how
        // the real app resolves it via CSpec + imports.
        var stack = this.PartitionLoadToastStack.create(null, subX);
        stack.pollInterval = 100;
        subX = subX.createSubContext({ partitionLoadToastStack: stack });

        // Delegate that resolves after 750ms -- slower than showDelay 400ms,
        // with enough margin past the 500/600/700ms checkpoints below that
        // the settle-triggered unwatch can't race them.
        var slow = this.PromisedDAO.create({
          promise: new Promise(function(resolve) {
            setTimeout(function() {
              resolve(foam.dao.MDAO.create({ of: foam.core.partition.PartitionLoadStatus }, subX));
            }, 750);
          })
        }, subX);

        var dao = this.PartitionLoadProgressDAO.create({
          delegate: slow, serviceKey: 'svcA', showDelay: 400
        }, subX);

        var p = dao.select();

        await new Promise(function(r) { setTimeout(r, 500); });
        x.test(Object.keys(stack.watched_).length === 1,
            'stack watching svcA while op pending past showDelay');

        await new Promise(function(r) { setTimeout(r, 100); });
        x.test(stack.rows_.length === 1, 'active status row surfaced as a card row');

        // Fast op mid-flight (slow op still pending until 750ms): must never
        // watch, and must not disturb the slow op's existing watch refcount.
        var fast = this.PartitionLoadProgressDAO.create({
          delegate: this.MDAO.create({ of: this.PartitionLoadStatus }, subX),
          serviceKey: 'svcA', showDelay: 400
        }, subX);
        x.test(dao.partitionLoadToastStack === fast.partitionLoadToastStack,
            'both decorators reach the same context instance');
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
