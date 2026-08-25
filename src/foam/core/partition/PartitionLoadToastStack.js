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
    partitionLoadStatusDAO every pollInterval ms and shows one card per
    watched service: how far the load has got, how many partitions are left,
    and which one is replaying right now. The collapse control shrinks it to
    a corner pill holding the overall percent; the next load opens expanded
    again.

    Deliberately does NOT list the partitions. A reader waiting on a query
    wants the progress and what is left, not an enumeration -- and listing
    them costs an ordering rule per partitioning scheme, a scroll container,
    and a DOM rebuild every time a partition finishes.

    Two-tier reactivity, so a poll tick never rebuilds the DOM: structure_
    keys the services and their bar kind, which holds still for a whole load,
    and drives the one dynamic() that builds elements; tick_ drives slots
    carrying every changing number.

    Percent is measured against a per-load baseline (sessions_), not the rows
    currently outstanding: a finished partition's bytes stay in the numerator
    instead of leaving with its row, so the aggregate never walks backwards.
    A per-partition percent is deliberately not shown -- the reporter
    publishes once at zero bytes then throttles to 250ms, so a partition that
    replays inside one poll interval is only ever sampled at 0%.
    Non-blocking by design.

    Registered as a client-only CSpec service (partitionLoadToastStack in
    services.jrl, lazyClient: false) rather than a hand-rolled singleton, so
    every decorator that imports it resolves the same context-scoped
    instance and shares one watched_ refcount map. See
    PartitionLoadProgressDAO's optional 'partitionLoadToastStack?' import.`,

  requires: [
    'foam.lang.ExpressionSlot',
    'foam.u2.ProgressView'
  ],

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
      border-radius: $inputBorderRadius;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      padding: 4px 12px 12px 12px;
    }
    ^header {
      display: flex;
      align-items: flex-start;
      gap: 8px;
    }
    ^name {
      flex: 1;
      padding-top: 12px;
      color: $textSecondary;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    ^toggle {
      min-width: 44px;
      min-height: 44px;
      background: none;
      border: none;
      border-radius: $inputBorderRadius;
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
    ^current {
      margin-top: 4px;
      color: $textSecondary;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
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
      transition: background-color 150ms ease-out;
    }
    ^pill:hover {
      background: $backgroundHover;
    }
    @media (prefers-reduced-motion: reduce) {
      ^toggle, ^pill {
        transition: none;
      }
    }
  `,

  messages: [
    { name: 'LOADING',      messageMap: { en: 'loading',   fr: 'chargement' } },
    { name: 'REMAINING',    messageMap: { en: 'remaining', fr: 'restantes' } },
    { name: 'HIDE_STATUS',  messageMap: { en: 'Hide loading status', fr: 'Masquer l\'état du chargement' } },
    { name: 'SHOW_STATUS',  messageMap: { en: 'Show loading status', fr: 'Afficher l\'état du chargement' } }
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
    { class: 'Array', name: 'rows_' },
    {
      class: 'String',
      name: 'structure_',
      documentation: `Key over everything that decides which elements exist.
        Only a change here rebuilds the DOM; progress moves tick_.`
    },
    {
      class: 'Int',
      name: 'tick_',
      documentation: 'Bumped once per poll; drives the value slots.'
    },
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
        this.polling_   = false;
        this.rows_      = [];
        this.sessions_  = {};
        this.structure_ = '';
        // The next load opens expanded, whatever the user chose for this one.
        this.collapsed_ = false;
      }
    },

    async function refresh_() {
      var keys = Object.keys(this.watched_);
      if ( ! keys.length || ! this.partitionLoadStatusDAO ) {
        this.rows_      = [];
        this.sessions_  = {};
        this.structure_ = '';
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
      // Baselines must be current before either slot fires.
      this.updateSessions_(rows);
      this.rows_      = rows;
      this.structure_ = this.structureKey_();
      this.tick_++;
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

    function structureKey_() {
      var sessions = this.sessions_;
      var keys     = Object.keys(sessions).sort();
      if ( ! keys.length ) return '';
      // Only the set of services and whether each has a readable byte total
      // decide which elements exist, and neither changes over a load -- so
      // the DOM is built once and every number after that rides a slot.
      return keys.map(function(k) {
        return k + ( sessions[k].bytes > 0 ? ':d' : ':i' );
      }).join('|');
    },

    function totals_() {
      var t = { bytes: 0, read: 0 };
      var sessions = this.sessions_;
      Object.keys(sessions).forEach(function(k) {
        t.bytes += sessions[k].bytes;
        t.read  += sessions[k].read;
      });
      return t;
    },

    function pctOf_(s) {
      // Unknown journal size (unreadable storage): no honest percent exists.
      if ( ! s || s.bytes <= 0 ) return null;
      return Math.min(99, Math.floor(s.read * 100 / s.bytes));
    },

    function tickSlot_(el, code) {
      // Owned by the element, not the view: the view outlives every load, so
      // slots parented to it would pile up and be notified on every tick.
      return el.onDetach(this.ExpressionSlot.create({ code: code, obj: this }));
    },

    function renderPill(self) {
      var pct = self.tickSlot_(this, function(tick_) {
        return self.pctOf_(self.totals_());
      });
      this.start('button').addClass(self.myClass('pill')).
        show(self.collapsed_$).
        attrs({
          'aria-label':    self.SHOW_STATUS,
          'aria-expanded': false,
          title:           self.SHOW_STATUS
        }).
        on('click', function() { self.collapsed_ = false; }).
        start().addClass('p-sm', 'p-bold').
          add(pct.map(function(p) { return p == null ? self.LOADING : p + '%'; })).
        end().
      end();
    },

    function renderToggle(self) {
      this.start('button').addClass(self.myClass('toggle')).
        attrs({
          'aria-label':    self.HIDE_STATUS,
          'aria-expanded': true,
          title:           self.HIDE_STATUS
        }).
        on('click', function() { self.collapsed_ = true; }).
        add('–').
      end();
    },

    function renderBar(self, name, determinate) {
      if ( ! determinate ) {
        // No max/value attributes: the progress element renders its native
        // indeterminate animation. Only this bar ever animates.
        this.start('progress').addClass(self.myClass('indeterminate')).end();
        return;
      }
      var pct = self.tickSlot_(this, function(tick_) {
        return self.pctOf_(self.sessions_[name]) || 0;
      });
      this.start().addClass(self.myClass('bar')).
        start(self.ProgressView, { data$: pct }).end().
        start().addClass('p-sm', self.myClass('pct')).
          add(pct.map(function(p) { return p + '%'; })).
        end().
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
        add(this.dynamic(function(structure_) {
          if ( ! structure_ ) return;
          // Collapsing is a visibility flip, not a change of structure: both
          // forms are built once and shown/hidden off collapsed_, so the
          // toggle costs no rebuild.
          this.forEach(Object.keys(self.sessions_), function(name) {
            var session = self.sessions_[name];
            this.start().addClass(self.myClass('card')).
              hide(self.collapsed_$).
              start().addClass(self.myClass('header')).
                start().addClass('p-sm', 'p-bold', self.myClass('name')).
                  attrs({ title: name }).
                  add(name).
                end().
                call(self.renderToggle, [self]).
              end().
              call(self.renderBar, [self, name, session.bytes > 0]).
              start().addClass('p-sm', self.myClass('current')).
                add(self.tickSlot_(this, function(tick_) {
                  var s = self.sessions_[name];
                  if ( ! s ) return self.LOADING;
                  var txt = s.current ? self.LOADING + ' ' + s.current : self.LOADING;
                  return s.count > 1 ? txt + ' \u00b7 ' + s.remaining + ' ' + self.REMAINING : txt;
                })).
              end().
            end();
          });
          this.call(self.renderPill, [self]);
        }));
    }
  ]
});
