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
    'foam.core.partition.PartitionLoadWatcher',
    'foam.dao.MDAO',
    'foam.dao.PromisedDAO',
    'foam.u2.dock.Dock'
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

        // partitionLoadWatcher and dock are context-scoped services
        // (services.jrl, lazyClient: false), not process-wide singletons --
        // build one of each and place them in the sub-context so every
        // decorator created in that context imports the same instances,
        // mirroring how the real app resolves them via CSpec + imports.
        // a stand-in ctrl, so the cards are not added to the test page
        subX = subX.createSubContext({ ctrl: { add: function() {} } });
        var dock = this.Dock.create(null, subX);
        subX = subX.createSubContext({ dock: dock });
        var watcher = this.PartitionLoadWatcher.create(null, subX);
        watcher.pollInterval = 100;
        subX = subX.createSubContext({ partitionLoadWatcher: watcher });

        // Waits until cond() holds, checking every 20ms; the 5s cap only
        // bounds a failing run, it is never what a passing run waits for.
        var until = async function(cond) {
          for ( var i = 0 ; i < 250 && ! cond() ; i++ ) await new Promise(r => setTimeout(r, 20));
          return cond();
        };

        // The slow operation's delegate resolves only when the test calls
        // release(), so its watch lasts exactly as long as the test needs it.
        var release;
        var slow = this.PromisedDAO.create({
          promise: new Promise(function(resolve) {
            release = function() { resolve(foam.dao.MDAO.create({ of: foam.core.partition.PartitionLoadStatus }, subX)); };
          })
        }, subX);

        var dao = this.PartitionLoadProgressDAO.create({
          delegate: slow, serviceKey: 'svcA', showDelay: 50
        }, subX);

        var p = dao.select();

        x.test(await until(() => Object.keys(watcher.watched_).length === 1),
            'watcher watching svcA while op pending past showDelay');

        x.test(await until(() => dock.items.length === 1 && dock.items[0].title === 'svcA' && dock.items[0].progress === 40),
            'active status row docked as a card at 40%');

        // Fast op while the slow one is still pending: it settles before its
        // showDelay, so it must never watch nor disturb the slow op's refcount.
        // Awaiting it runs its settle first (track_ attached settle before
        // this await), so the check needs no wait.
        var fast = this.PartitionLoadProgressDAO.create({
          delegate: this.MDAO.create({ of: this.PartitionLoadStatus }, subX),
          serviceKey: 'svcA', showDelay: 50
        }, subX);
        x.test(dao.partitionLoadWatcher === fast.partitionLoadWatcher,
            'both decorators reach the same context instance');
        await fast.select();
        x.test(Object.keys(watcher.watched_).length === 1,
            'fast op never triggers watch; slow op refcount undisturbed');
        x.test(dock.items.length === 1, 'slow op card still docked after fast op settles');

        release();
        await p;
        x.test(Object.keys(watcher.watched_).length === 0, 'unwatched after slow op settles');
        x.test(await until(() => dock.items.length === 0), 'the card leaves the Dock once the load is over');
      } catch (e) {
        x.test(false, 'unexpected exception: ' + (e && e.message ? e.message : e));
      }
    }
  ]
});
