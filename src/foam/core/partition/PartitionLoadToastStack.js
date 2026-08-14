/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.partition',
  name: 'PartitionLoadToastStack',
  extends: 'foam.u2.View',

  documentation: `Bottom-right stack of partition-load progress cards. DAO
    decorators watch()/unwatch() service keys; while any key is watched the
    stack polls partitionLoadStatusDAO every pollInterval ms and renders
    one card per matching row. Non-blocking by design.

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
      gap: 8px;
      max-width: 320px;
    }
    ^card {
      background: $backgroundDefault;
      border: 1px solid $borderDefault;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      padding: 12px;
    }
    ^title {
      color: $textSecondary;
      margin-bottom: 4px;
    }
    ^groupHeader {
      color: $textSecondary;
      font-weight: bold;
      margin-bottom: 4px;
    }
    ^indeterminate {
      width: 100%;
      height: 8px;
    }
    ^more {
      color: $textTertiary;
      text-align: center;
    }
  `,

  constants: [ { name: 'MAX_CARDS', value: 4 } ],

  messages: [
    { name: 'LOADING',   messageMap: { en: 'Loading',   fr: 'Chargement' } },
    { name: 'QUEUED',    messageMap: { en: 'queued',    fr: 'en file' } },
    { name: 'PARTITION', messageMap: { en: 'partition', fr: 'partition' } },
    { name: 'OF',        messageMap: { en: 'of',        fr: 'sur' } },
    { name: 'OVERALL',   messageMap: { en: 'overall',   fr: 'global' } },
    { name: 'MORE',      messageMap: { en: 'more',      fr: 'autres' } }
  ],

  properties: [
    {
      class: 'Map',
      name: 'watched_',
      factory: function() { return {}; }
    },
    { class: 'Array', name: 'rows_' },
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
        this.rows_    = [];
      }
    },

    async function refresh_() {
      var keys = Object.keys(this.watched_);
      if ( ! keys.length || ! this.partitionLoadStatusDAO ) {
        this.rows_ = [];
        return;
      }
      try {
        var sink = await this.partitionLoadStatusDAO.select();
        this.rows_ = sink.array.
          filter(function(r) { return keys.indexOf(r.serviceName) != -1; }).
          sort(function(a, b) { return a.startTime - b.startTime; });
      } catch (e) {
        // Progress channel never surfaces errors; retry next tick.
      }
      if ( this.rows_.length && ! this.attached_ && this.ctrl ) {
        this.attached_ = true;
        this.ctrl.add(this);
      }
    },

    function pct_(row) {
      // Unknown journal size (unreadable storage): no honest percent exists.
      if ( row.totalBytes <= 0 ) return null;
      return Math.min(99, Math.floor(row.bytesRead * 100 / row.totalBytes));
    },

    function serviceGroups_(rows) {
      // Aggregate ALL watched rows per serviceName (not just the on-screen
      // cap-4 slice) so "N of M -- overall P%" stays accurate even when
      // some of that service's cards are hidden by the cap.
      var groups = {};
      rows.forEach(function(r) {
        var g = groups[r.serviceName] || (groups[r.serviceName] = {
          total: 0, started: 0, bytesRead: 0, totalBytes: 0
        });
        g.total++;
        if ( ! r.queued ) g.started++;
        g.bytesRead  += r.bytesRead  || 0;
        g.totalBytes += r.totalBytes || 0;
      });
      return groups;
    },

    function groupedRows_(rows) {
      // rows is already startTime-sorted; re-bucket so each service's rows
      // sit contiguously (first-seen order == earliest start), so one
      // header covers one uninterrupted block of cards instead of
      // repeating whenever two services' rows interleave by start time.
      var order     = [];
      var byService = {};
      rows.forEach(function(r) {
        if ( ! byService[r.serviceName] ) {
          byService[r.serviceName] = [];
          order.push(r.serviceName);
        }
        byService[r.serviceName].push(r);
      });
      var out = [];
      order.forEach(function(name) { out = out.concat(byService[name]); });
      return out;
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
        add(this.dynamic(function(rows_) {
          if ( ! rows_ || ! rows_.length ) return;
          var groups      = self.serviceGroups_(rows_);
          var ordered     = self.groupedRows_(rows_).slice(0, self.MAX_CARDS);
          var lastService = null;
          this.forEach(ordered, function(row) {
            var group = groups[row.serviceName];
            if ( row.serviceName !== lastService ) {
              lastService = row.serviceName;
              if ( group.total > 1 ) {
                var header = self.PARTITION + ' ' + group.started + ' ' + self.OF + ' ' + group.total;
                if ( group.totalBytes > 0 ) {
                  header += ' — ' + self.OVERALL + ' ' + Math.min(99, Math.floor(group.bytesRead * 100 / group.totalBytes)) + '%';
                }
                this.start().addClass('p-sm', self.myClass('groupHeader'))
                  .add(header)
                .end();
              }
            }
            var label = row.serviceName + ( row.partition ? ' — ' + row.partition : '' );
            if ( row.queued ) {
              this.start().addClass(self.myClass('card'))
                .start().addClass('p-sm', self.myClass('title'))
                  .add(label + ' — ' + self.QUEUED)
                .end()
              .end();
              return;
            }
            var pct = self.pct_(row);
            var card = this.start().addClass(self.myClass('card'))
              .start().addClass('p-sm', self.myClass('title'))
                .add(pct == null ? self.LOADING + ' ' + label : self.LOADING + ' ' + label + ' — ' + pct + '%')
              .end();
            if ( pct == null ) {
              // No max/value attributes: the progress element renders its
              // native indeterminate animation.
              card.start('progress').addClass(self.myClass('indeterminate')).end();
            } else {
              card.start(self.ProgressView, { data: pct }).end();
            }
            card.end();
          });
          if ( rows_.length > self.MAX_CARDS ) {
            this.start().addClass('p-sm', self.myClass('more'))
              .add('+' + (rows_.length - self.MAX_CARDS) + ' ' + self.MORE)
            .end();
          }
        }));
    }
  ]
});
