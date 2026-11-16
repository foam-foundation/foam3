/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.partition',
  name: 'PartitionLoadWatcher',

  documentation: `Partition-load progress in the Dock. DAO decorators
    watch()/unwatch() service keys; while any key is watched the watcher
    polls partitionLoadStatusDAO every pollInterval ms and keeps one
    PartitionLoadDockItem per loading service: how far the load has got, how
    many partitions are left, and which one is replaying right now.

    Deliberately does NOT list the partitions. A reader waiting on a query
    wants the progress and what is left, not an enumeration -- and listing
    them costs an ordering rule per partitioning scheme and a scroll
    container.

    Percent is measured against a per-load baseline (sessions_), not the rows
    currently outstanding: a finished partition's bytes stay in the numerator
    instead of leaving with its row, so the percent never walks backwards.
    A per-partition percent is deliberately not shown -- the reporter
    publishes once at zero bytes then throttles to 250ms, so a partition that
    replays inside one poll interval is only ever sampled at 0%.

    Registered as a client-only CSpec service (partitionLoadWatcher in
    services.jrl, lazyClient: false) rather than a hand-rolled singleton, so
    every decorator that imports it resolves the same context-scoped
    instance and shares one watched_ refcount map. See
    PartitionLoadProgressDAO's optional 'partitionLoadWatcher?' import.`,

  requires: [
    'foam.core.partition.PartitionLoadDockItem'
  ],

  imports: [ 'partitionLoadStatusDAO?', 'dock?' ],

  messages: [
    { name: 'LOADING',   messageMap: { en: 'loading',   fr: 'chargement' } },
    { name: 'REMAINING', messageMap: { en: 'remaining', fr: 'restantes' } }
  ],

  properties: [
    {
      class: 'Map',
      name: 'watched_',
      factory: function() { return {}; }
    },
    {
      class: 'Map',
      name: 'sessions_',
      documentation: `Per-service load baseline, keyed by serviceName: the
        partition count and byte total the load was ever seen to cover, how
        much of each has finished, and the partition replaying now.`,
      factory: function() { return {}; }
    },
    {
      class: 'Map',
      name: 'items_',
      documentation: 'The docked card of each loading service, keyed by serviceName.',
      factory: function() { return {}; }
    },
    { class: 'Boolean', name: 'polling_' },
    { class: 'Int', name: 'pollInterval', value: 500 }
  ],

  methods: [
    function watch(key) {
      this.watched_[key] = (this.watched_[key] || 0) + 1;
      this.poll_();
    },

    function unwatch(key) {
      if ( ! this.watched_[key] ) return;
      this.watched_[key]--;
      if ( this.watched_[key] <= 0 ) delete this.watched_[key];
    },

    async function poll_() {
      if ( this.polling_ ) return;
      this.polling_ = true;
      try {
        while ( Object.keys(this.watched_).length ) {
          await this.refresh_();
          await new Promise(r => setTimeout(r, this.pollInterval));
        }
      } finally {
        this.polling_  = false;
        this.sessions_ = {};
        this.syncItems_();
      }
    },

    async function refresh_() {
      var keys = Object.keys(this.watched_);
      if ( ! keys.length || ! this.partitionLoadStatusDAO ) {
        this.sessions_ = {};
        this.syncItems_();
        return;
      }
      var rows;
      try {
        var sink = await this.partitionLoadStatusDAO.select();
        rows = sink.array.
          filter(function(r) { return keys.indexOf(r.serviceName) != -1; }).
          sort(function(a, b) { return a.startTime - b.startTime; });
      } catch (e) {
        // Progress channel never surfaces errors; retry next tick.
        return;
      }
      this.updateSessions_(rows);
      this.syncItems_();
    },

    function updateSessions_(rows) {
      var live = {};
      // rows is startTime-sorted, so the first unqueued row is the partition
      // that has been replaying longest -- the loop in DatePartitionedDAO is
      // sequential, so in practice there is exactly one.
      rows.forEach(function(r) {
        var l = live[r.serviceName] ||
            (live[r.serviceName] = { count: 0, bytes: 0, read: 0, current: '' });
        l.count++;
        l.bytes += r.totalBytes || 0;
        l.read  += r.bytesRead  || 0;
        if ( ! r.queued && ! l.current ) l.current = r.partition;
      });
      var sessions = this.sessions_;
      // Every row of a service gone means that service's load finished; drop
      // the baseline so a later load on the same key starts from scratch.
      Object.keys(sessions).forEach(function(k) {
        if ( ! live[k] ) delete sessions[k];
      });
      Object.keys(live).forEach(function(k) {
        var l = live[k];
        var s = sessions[k] ||
            (sessions[k] = { count: 0, bytes: 0, doneCount: 0, doneBytes: 0, read: 0, current: '' });
        // Baselines only grow. A second select can queue more partitions
        // mid-load, and finished rows leave, so the live sums on their own
        // would walk the percent backwards.
        if ( l.count + s.doneCount > s.count ) s.count = l.count + s.doneCount;
        if ( l.bytes + s.doneBytes > s.bytes ) s.bytes = l.bytes + s.doneBytes;
        s.doneCount = s.count - l.count;
        s.doneBytes = s.bytes - l.bytes;
        s.read      = s.doneBytes + l.read;
        s.remaining = l.count;
        s.current   = l.current;
      });
    },

    // One docked card per loading service: new services dock, finished ones
    // undock, and every card's numbers are brought up to date.
    function syncItems_() {
      var sessions = this.sessions_;
      var items    = this.items_;
      Object.keys(items).forEach(k => {
        if ( sessions[k] ) return;
        this.dock?.undock(items[k]);
        delete items[k];
      });
      Object.keys(sessions).forEach(k => {
        var item = items[k];
        if ( ! item ) {
          item = items[k] = this.PartitionLoadDockItem.create({ title: k });
          this.dock?.dock(item);
        }
        var s = sessions[k];
        item.progress  = this.pctOf_(s);
        var txt = s.current ? this.LOADING + ' ' + s.current : this.LOADING;
        item.statusMsg = s.count > 1 ? txt + ' · ' + s.remaining + ' ' + this.REMAINING : txt;
      });
    },

    function pctOf_(s) {
      // Unknown journal size (unreadable storage): no honest percent exists.
      if ( ! s || s.bytes <= 0 ) return -1;
      return Math.min(99, Math.floor(s.read * 100 / s.bytes));
    }
  ]
});
