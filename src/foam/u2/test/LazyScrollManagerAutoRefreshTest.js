/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.test',
  name: 'AutoRefreshTestRow',
  flags: [ 'js' ],
  properties: [ 'id', 'group', 'label' ]
});

foam.CLASS({
  package: 'foam.u2.test',
  name: 'AutoRefreshTestRowView',
  extends: 'foam.u2.View',
  flags: [ 'js' ],
  css: `^ { height: 24px; box-sizing: border-box; }`,
  methods: [
    function render() {
      this.SUPER();
      this.addClass().add(this.data.label);
    }
  ]
});

foam.CLASS({
  package: 'foam.u2.test',
  name: 'AutoRefreshTestHost',
  extends: 'foam.u2.Element',
  flags: [ 'js' ],
  css: `^ { height: 120px; width: 300px; overflow: auto; }`,
  methods: [
    function render() {
      this.SUPER();
      this.addClass();
    }
  ]
});

foam.CLASS({
  package: 'foam.u2.test',
  name: 'LazyScrollManagerAutoRefreshTest',
  extends: 'foam.core.test.JSTest',

  requires: [
    'foam.comics.v2.DAOControllerConfig',
    'foam.dao.MDAO',
    'foam.dao.ProxyDAO',
    'foam.dao.RequestResponseClientDAO',
    'foam.dao.TTLSelectCachingDAO',
    'foam.box.SkeletonBox',
    'foam.u2.test.AutoRefreshTestHost',
    'foam.u2.test.AutoRefreshTestRow',
    'foam.u2.test.AutoRefreshTestRowView',
    'foam.u2.view.LazyScrollManager'
  ],

  methods: [
    async function waitFor(x, predicate) {
      for ( var i = 0 ; i < 150 ; i++ ) {
        if ( predicate() ) return;
        await new Promise(resolve => x.setTimeout(resolve, 20));
      }
      throw new Error('Table did not finish loading');
    },

    async function runTest(x) {
      var EXPECTED = { interval: 15000, count: 60, updated: 'Updated summary' };
      var E = foam.mlang.Expressions.create();
      var timers = new Map();
      var nextTimer = 0;
      var hidden = false;
      var pending = [];
      var blockPages = false;
      var failCount = false;
      var failPage = false;
      var failPurge = false;
      var purges = 0;
      var reads = 0;
      var visibilityListeners = new Set();
      var doc = new Proxy(x.document, {
        get: function(target, key) {
          if ( key === 'hidden' ) return hidden;
          if ( key === 'addEventListener' ) return function(type, fn) {
            if ( type === 'visibilitychange' ) visibilityListeners.add(fn);
            target.addEventListener(type, fn);
          };
          if ( key === 'removeEventListener' ) return function(type, fn) {
            if ( type === 'visibilitychange' ) visibilityListeners.delete(fn);
            target.removeEventListener(type, fn);
          };
          var value = Reflect.get(target, key, target);
          return typeof value === 'function' ? value.bind(target) : value;
        }
      });
      var config = this.DAOControllerConfig.create({}, x);
      var tx = x.createSubContext({
        config: config,
        document: doc,
        setTimeout: function(fn, delay) {
          var id = ++nextTimer;
          timers.set(id, { fn: fn, delay: delay });
          return id;
        },
        clearTimeout: function(id) { timers.delete(id); }
      });
      var source = this.MDAO.create({ of: this.AutoRefreshTestRow }, x);
      for ( var i = 0 ; i < 120 ; i++ ) {
        await source.put(this.AutoRefreshTestRow.create({
          id: String(i).padStart(3, '0'), group: i % 2 ? 'b' : 'a', label: 'Row ' + i
        }));
      }
      var observed = this.ProxyDAO.create({ delegate: source }, x);
      observed.select_ = function(ctx, sink, skip, limit, order, predicate) {
        reads++;
        var count = foam.mlang.sink.Count.isInstance(sink);
        if ( ( count && failCount ) || ( ! count && failPage ) ) {
          failCount = failPage = false;
          return Promise.reject(new Error('Expected read failure'));
        }
        var result = source.select_(ctx, sink, skip, limit, order, predicate);
        return ! count && blockPages ? new Promise((resolve, reject) => {
          pending.push(() => result.then(resolve, reject));
        }) : result;
      };
      var client = this.RequestResponseClientDAO.create({
        of: this.AutoRefreshTestRow,
        delegate: this.SkeletonBox.create({ data: observed }, x)
      }, x);
      var clientCmd = client.cmd_.bind(client);
      client.cmd_ = function(ctx, cmd) {
        if ( cmd === foam.dao.DAO.PURGE_CMD ) {
          purges++;
          if ( failPurge ) {
            failPurge = false;
            return Promise.reject(new Error('Expected purge failure'));
          }
        }
        return clientCmd(ctx, cmd);
      };
      var cached = this.TTLSelectCachingDAO.create({ delegate: client, purgeTime: 300000 }, x);
      var query = cached.where(E.EQ(this.AutoRefreshTestRow.GROUP, 'a'));
      config.dao = query;
      var order = E.DESC(this.AutoRefreshTestRow.ID);
      var host = this.AutoRefreshTestHost.create({}, x);
      var manager;
      function ready() {
        return ! manager.daoLoading && ! manager.autoRefreshInProgress_ &&
          ! Object.keys(manager.loadingPages_).length;
      }
      function fireTimer() {
        var entry = timers.entries().next().value;
        if ( ! entry ) throw new Error('No auto-refresh timer');
        timers.delete(entry[0]);
        x.test(entry[1].delay === EXPECTED.interval, 'timer uses the configured 15-second interval');
        return entry[1].fn();
      }
      try {
        host.write();
        manager = this.LazyScrollManager.create({
          data: query, order: order, rootElement: host, pageSize: 10,
          rowView: this.AutoRefreshTestRowView
        }, tx);
        host.add(manager);
        await this.waitFor(x, () => ready() && Object.keys(manager.loadedPages_).length);
        x.test(manager.daoCount === EXPECTED.count, 'initial count respects the table filter');
        x.test(timers.size === 0, 'automatic refresh defaults to disabled');

        config.autoRefreshInterval = EXPECTED.interval;
        x.test(timers.size === 1, 'menu configuration enables one timer');
        var changed = (await source.find('118')).clone();
        changed.label = EXPECTED.updated;
        var before = reads;
        await source.put(changed);
        await new Promise(resolve => x.setTimeout(resolve, 100));
        x.test(reads === before && ! host.el_().textContent.includes(EXPECTED.updated),
          'independent server writes do not notify or update the open table');
        await fireTimer();
        await this.waitFor(x, () => ready() && timers.size === 1);
        x.test(host.el_().textContent.includes(EXPECTED.updated), 'automatic refresh purges cached results and renders current rows');
        x.test(manager.data === query && manager.order === order, 'refresh retains the filtered DAO and sort order');
        x.test(manager.daoCount === EXPECTED.count, 'refresh retains the filtered count');

        host.el_().scrollTop = 1000;
        await new Promise(resolve => x.setTimeout(resolve, 200));
        var scrollTop = host.el_().scrollTop;
        var page = manager.currentTopPage_;
        x.test(page > 0 && scrollTop > 0, 'scroll test starts beyond the first page window');
        await fireTimer();
        await this.waitFor(x, () => ready() && timers.size === 1);
        await new Promise(resolve => x.setTimeout(resolve, 200));
        x.test(Math.abs(host.el_().scrollTop - scrollTop) < 2, 'automatic refresh preserves the scroll offset');
        x.test(manager.currentTopPage_ === page,
          'automatic refresh preserves the page window (' + page + ' to ' + manager.currentTopPage_ + ')');

        hidden = true;
        doc.dispatchEvent(new Event('visibilitychange'));
        x.test(timers.size === 0, 'hiding the browser tab cancels the timer');
        before = reads;
        await manager.autoRefresh();
        x.test(reads === before, 'hidden tabs issue no refresh reads');
        hidden = false;
        doc.dispatchEvent(new Event('visibilitychange'));
        x.test(timers.size === 1, 'showing the browser tab resumes the timer');

        host.show(false);
        before = reads;
        await fireTimer();
        x.test(reads === before && timers.size === 1, 'a hidden table skips reads while waiting to become visible');
        host.show(true);

        blockPages = true;
        await fireTimer();
        await this.waitFor(x, () => pending.length > 0);
        var beforePurge = purges;
        await manager.autoRefresh();
        x.test(purges === beforePurge && timers.size === 0, 'slow page loads prevent another refresh cycle');
        blockPages = false;
        pending.splice(0).forEach(resolve => resolve());
        await this.waitFor(x, () => ready() && timers.size === 1);

        for ( var failure of [ 'purge', 'count', 'page' ] ) {
          failPurge = failure === 'purge';
          failCount = failure === 'count';
          failPage = failure === 'page';
          await fireTimer();
          await this.waitFor(x, () => ready() && timers.size === 1);
          x.test(! manager.autoRefreshInProgress_, failure + ' failure releases the refresh cycle for retry');
          await fireTimer();
          await this.waitFor(x, () => ready() && timers.size === 1);
          x.test(manager.daoCount === EXPECTED.count, 'refresh recovers after a ' + failure + ' failure');
        }

        manager.groupBy = this.AutoRefreshTestRow.GROUP;
        manager.groupHeaderView = this.AutoRefreshTestRowView;
        await this.waitFor(x, () => ready() && timers.size === 1);
        await fireTimer();
        await this.waitFor(x, () => ready() && timers.size === 1);
        x.test(manager.groupBy === this.AutoRefreshTestRow.GROUP,
          'grouped tables finish refreshing and retain their grouping');

        await source.removeAll();
        await fireTimer();
        await this.waitFor(x, () => ready() && timers.size === 1);
        x.test(manager.daoCount === 0 && Object.keys(manager.loadedPages_).length === 0,
          'removing all source rows refreshes to an empty table without stopping the timer');

        config.autoRefreshInterval = 0;
        x.test(timers.size === 0, 'setting the interval to zero cancels the timer');
        config.autoRefreshInterval = -1;
        x.test(timers.size === 0, 'negative intervals also keep automatic refresh disabled');
        config.autoRefreshInterval = EXPECTED.interval;

        await source.put(changed);
        blockPages = true;
        await fireTimer();
        await this.waitFor(x, () => pending.length > 0);
        host.remove();
        x.test(timers.size === 0, 'leaving the table cancels the timer');
        x.test(visibilityListeners.size === 0, 'leaving the table removes the visibility listener');
        blockPages = false;
        pending.splice(0).forEach(resolve => resolve());
        await new Promise(resolve => x.setTimeout(resolve, 100));
        x.test(timers.size === 0, 'an in-flight page result cannot restart a detached table');
        before = reads;
        await manager.autoRefresh();
        x.test(reads === before, 'detached tables cannot start another refresh');
      } finally {
        blockPages = false;
        pending.splice(0).forEach(resolve => resolve());
        if ( ! host.isDetached() ) host.remove();
      }
    }
  ]
});
