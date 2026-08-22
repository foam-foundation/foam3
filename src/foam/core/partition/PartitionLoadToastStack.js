/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.partition',
  name: 'PartitionLoadToastStack',
  extends: 'foam.u2.View',

  documentation: `Bottom-right partition-load progress card. DAO decorators
    watch()/unwatch() service keys; while any key is watched the card polls
    partitionLoadStatusDAO every pollInterval ms. One card per watched
    service, carrying that service's aggregate bar over a scrollable list of
    its partitions -- never one card per partition, so the card's height
    doesn't grow with the load. The collapse control shrinks it to a corner
    pill holding the overall percent; a load covering more than one partition
    opens collapsed, and that choice lasts only until the load ends.

    Percent is measured against a per-load baseline (sessions_), not the rows
    currently outstanding: a row disappears when its partition finishes, so a
    percent summed over live rows alone walks backwards. Non-blocking by
    design.

    Registered as a client-only CSpec service (partitionLoadToastStack in
    services.jrl, lazyClient: false) rather than a hand-rolled singleton, so
    every decorator that imports it resolves the same context-scoped
    instance and shares one watched_ refcount map. See
    PartitionLoadProgressDAO's optional 'partitionLoadToastStack?' import.`,

  requires: [ 'foam.u2.ProgressView' ],

  imports: [ 'partitionLoadStatusDAO?', 'ctrl?' ],

  css: `
    ^ {
      position: fixed;
      bottom: 16px;
      right: 16px;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 8px;
      max-width: 320px;
    }
    ^card {
      width: 320px;
      background: $backgroundDefault;
      border: 1px solid $borderDefault;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      padding: 4px 12px 12px 12px;
      animation: partitionLoadFadeIn 200ms ease-out;
    }
    ^header {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    ^name {
      flex: 1;
      color: $textSecondary;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    ^count {
      color: $textSecondary;
      white-space: nowrap;
    }
    ^toggle {
      min-width: 44px;
      min-height: 44px;
      background: none;
      border: none;
      border-radius: 4px;
      color: $textSecondary;
      cursor: pointer;
      transition: background-color 150ms ease-out;
    }
    ^toggle:hover {
      background: $backgroundHover;
    }
    ^bar {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    ^bar progress {
      flex: 1;
      width: auto;
    }
    ^pct {
      min-width: 3.2em;
      text-align: right;
      color: $textSecondary;
    }
    ^indeterminate {
      width: 100%;
      height: 8px;
    }
    ^list {
      max-height: 76px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-top: 8px;
    }
    ^row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    ^rowLabel {
      flex: 1;
      color: $textSecondary;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    ^rowPct {
      color: $textSecondary;
      white-space: nowrap;
    }
    ^rowBar {
      width: 80px;
    }
    ^pill {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 44px;
      min-height: 44px;
      padding: 0 12px;
      background: $backgroundDefault;
      border: 1px solid $borderDefault;
      border-radius: 22px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      color: $textSecondary;
      cursor: pointer;
      animation: partitionLoadFadeIn 200ms ease-out;
      transition: background-color 150ms ease-out;
    }
    ^pill:hover {
      background: $backgroundHover;
    }
    @keyframes partitionLoadFadeIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @media (prefers-reduced-motion: reduce) {
      ^card, ^pill {
        animation: none;
        transition: none;
      }
      ^toggle {
        transition: none;
      }
    }
  `,

  messages: [
    { name: 'LOADING',      messageMap: { en: 'Loading',      fr: 'Chargement' } },
    { name: 'QUEUED',       messageMap: { en: 'queued',       fr: 'en file' } },
    { name: 'OF',           messageMap: { en: 'of',           fr: 'sur' } },
    { name: 'HIDE_DETAILS', messageMap: { en: 'Hide partition details', fr: 'Masquer les détails des partitions' } },
    { name: 'SHOW_DETAILS', messageMap: { en: 'Show partition details', fr: 'Afficher les détails des partitions' } }
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
      documentation: `Per-service load baseline, keyed by serviceName. Each
        entry carries the partition count and byte total the load was ever
        seen to cover, plus how much of that has finished.`,
      factory: function() { return {}; }
    },
    { class: 'Array', name: 'rows_' },
    { class: 'Boolean', name: 'collapsed_' },
    { class: 'Boolean', name: 'attached_' },
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
        this.polling_ = false;
        this.rows_     = [];
        this.sessions_ = {};
      }
    },

    async function refresh_() {
      var keys = Object.keys(this.watched_);
      if ( ! keys.length || ! this.partitionLoadStatusDAO ) {
        this.rows_ = [];
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
      // Baselines must be current before rows_ fires the render.
      var opening = ! Object.keys(this.sessions_).length;
      this.updateSessions_(rows);
      if ( opening ) this.collapsed_ = this.totals_().count > 1;
      this.rows_ = rows;
      // The service is instantiated in the client context (eager CSpec),
      // which is the PARENT of ApplicationController's subcontext -- the
      // 'ctrl' export lives in the child, so the import resolves undefined
      // here. Fall back to the application's browser global.
      var c = this.ctrl || globalThis.ctrl;
      if ( this.rows_.length && ! this.attached_ && c ) {
        this.attached_ = true;
        c.add(this);
      }
    },

    function updateSessions_(rows) {
      var live = {};
      rows.forEach(function(r) {
        var l = live[r.serviceName] ||
            (live[r.serviceName] = { count: 0, bytes: 0, read: 0 });
        l.count++;
        l.bytes += r.totalBytes || 0;
        l.read  += r.bytesRead  || 0;
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
            (sessions[k] = { count: 0, bytes: 0, doneCount: 0, doneBytes: 0, read: 0 });
        // Baselines only grow. A second select can queue more partitions
        // mid-load, and finished rows leave, so the live sums on their own
        // would walk the percent backwards.
        if ( l.count + s.doneCount > s.count ) s.count = l.count + s.doneCount;
        if ( l.bytes + s.doneBytes > s.bytes ) s.bytes = l.bytes + s.doneBytes;
        s.doneCount = s.count - l.count;
        s.doneBytes = s.bytes - l.bytes;
        s.read      = s.doneBytes + l.read;
      });
    },

    function totals_() {
      var t = { count: 0, doneCount: 0, bytes: 0, read: 0 };
      var sessions = this.sessions_;
      Object.keys(sessions).forEach(function(k) {
        var s = sessions[k];
        t.count     += s.count;
        t.doneCount += s.doneCount;
        t.bytes     += s.bytes;
        t.read      += s.read;
      });
      return t;
    },

    function pctOf_(s) {
      // Unknown journal size (unreadable storage): no honest percent exists.
      if ( s.bytes <= 0 ) return null;
      return Math.min(99, Math.floor(s.read * 100 / s.bytes));
    },

    function pct_(row) {
      if ( row.totalBytes <= 0 ) return null;
      return Math.min(99, Math.floor(row.bytesRead * 100 / row.totalBytes));
    },

    function byService_(rows) {
      // rows is already startTime-sorted, so first-seen order is
      // earliest-start order.
      var order = [];
      var map   = {};
      rows.forEach(function(r) {
        if ( ! map[r.serviceName] ) {
          map[r.serviceName] = [];
          order.push(r.serviceName);
        }
        map[r.serviceName].push(r);
      });
      return { order: order, rows: map };
    },

    function renderPill(self) {
      var pct = self.pctOf_(self.totals_());
      this.start('button').addClass(self.myClass('pill')).
        attrs({
          'aria-label':    self.SHOW_DETAILS,
          'aria-expanded': false,
          title:           self.SHOW_DETAILS
        }).
        on('click', function() { self.collapsed_ = false; }).
        start().addClass('p-sm', 'p-bold').
          add(pct == null ? self.LOADING : pct + '%').
        end().
      end();
    },

    function renderToggle(self) {
      this.start('button').addClass(self.myClass('toggle')).
        attrs({
          'aria-label':    self.HIDE_DETAILS,
          'aria-expanded': true,
          title:           self.HIDE_DETAILS
        }).
        on('click', function() { self.collapsed_ = true; }).
        add('–').
      end();
    },

    function renderBar(self, pct) {
      if ( pct == null ) {
        // No max/value attributes: the progress element renders its native
        // indeterminate animation. Only the aggregate bar ever does this --
        // a per-partition row falls back to text, so one card never runs
        // several indeterminate animations at once.
        this.start('progress').addClass(self.myClass('indeterminate')).end();
        return;
      }
      this.start().addClass(self.myClass('bar')).
        start(self.ProgressView, { data: pct }).end().
        start().addClass('p-sm', self.myClass('pct')).add(pct + '%').end().
      end();
    },

    function renderList(self, rows) {
      this.start().addClass(self.myClass('list')).
        forEach(rows, function(row) {
          var pct = self.pct_(row);
          this.start().addClass(self.myClass('row')).
            start().addClass('p-sm', self.myClass('rowLabel')).
              add(row.partition).
            end().
            start().addClass('p-sm', self.myClass('rowPct')).
              add(row.queued ? self.QUEUED :
                  ( pct == null ? self.LOADING : pct + '%' )).
            end().
            callIf(! row.queued && pct != null, function() {
              this.start().addClass(self.myClass('rowBar')).
                start(self.ProgressView, { data: pct }).end().
              end();
            }).
          end();
        }).
      end();
    },

    function render() {
      this.SUPER();
      var self = this;
      // If the element is later detached (e.g. ctrl.add()'d content torn
      // down and rebuilt), clear attached_ so refresh_() re-adds it next
      // time watched rows appear -- the instance itself is unchanged since
      // it's resolved via context import, not re-created per attach.
      this.onDetach(function() {
        self.attached_ = false;
      });
      this.addClass().
        attrs({ 'aria-live': 'polite', role: 'status' }).
        add(this.dynamic(function(rows_, collapsed_) {
          if ( ! rows_ || ! rows_.length ) return;
          if ( collapsed_ ) {
            this.call(self.renderPill, [self]);
            return;
          }
          var grouped = self.byService_(rows_);
          this.forEach(grouped.order, function(name) {
            var rows    = grouped.rows[name];
            var session = self.sessions_[name];
            this.start().addClass(self.myClass('card')).
              start().addClass(self.myClass('header')).
                start().addClass('p-sm', 'p-bold', self.myClass('name')).
                  add(self.LOADING + ' ' + name).
                end().
                callIf(session.count > 1, function() {
                  this.start().addClass('p-sm', self.myClass('count')).
                    add(session.doneCount + ' ' + self.OF + ' ' + session.count).
                  end();
                }).
                call(self.renderToggle, [self]).
              end().
              call(self.renderBar, [self, self.pctOf_(session)]).
              callIf(session.count > 1, self.renderList, [self, rows]).
            end();
          });
        }));
    }
  ]
});
