/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.partition',
  name: 'PartitionLoadToastStack',
  extends: 'foam.u2.View',

  documentation: `Singleton bottom-right stack of partition-load progress
    cards. DAO decorators watch()/unwatch() service keys; while any key is
    watched the stack polls partitionLoadStatusReadDAO every pollInterval ms
    and renders one card per matching row. Non-blocking by design.

    create() is memoized to a single shared instance manually below instead
    of via foam.pattern.Singleton: that axiom's installInClass no-ops (only a
    console.error, no throw) whenever the class carries any foam.lang.Import
    axiom, own or inherited -- and foam.u2.Element, an ancestor of every
    View, always declares imports, so no View subclass can ever install it
    (see foam.pattern.Singleton.hasImports/installInClass). Task 6's decorator
    depends on every .create() call sharing one watched_ refcount map, so a
    real memoized create() is required, not the no-op axiom.`,

  requires: [ 'foam.u2.ProgressView' ],

  imports: [ 'partitionLoadStatusReadDAO?', 'ctrl?' ],

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
    ^more {
      color: $textTertiary;
      text-align: center;
    }
  `,

  constants: [ { name: 'MAX_CARDS', value: 4 } ],

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
      if ( ! keys.length || ! this.partitionLoadStatusReadDAO ) {
        this.rows_ = [];
        return;
      }
      try {
        var sink = await this.partitionLoadStatusReadDAO.select();
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
      return Math.min(99, Math.floor(row.bytesRead * 100 / Math.max(1, row.totalBytes)));
    },

    function render() {
      this.SUPER();
      var self = this;
      // The memoized create() (see bottom of file) hands out this same
      // instance to every caller. If the element is later detached (e.g.
      // ctrl.add()'d content torn down and rebuilt), invalidate the memo so
      // the next create() builds a fresh, attachable instance instead of
      // reusing this dead one.
      this.onDetach(function() {
        if ( self.cls_.private_.instance_ === self ) self.cls_.private_.instance_ = undefined;
        self.attached_ = false;
      });
      this.addClass().
        attrs({ 'aria-live': 'polite', role: 'status' }).
        add(this.dynamic(function(rows_) {
          if ( ! rows_ || ! rows_.length ) return;
          this.forEach(rows_.slice(0, self.MAX_CARDS), function(row) {
            var pct   = self.pct_(row);
            var label = row.serviceName + ( row.partition ? ' — ' + row.partition : '' );
            this.start().addClass(self.myClass('card'))
              .start().addClass('p-sm', self.myClass('title'))
                .add('Loading ' + label + ' — ' + pct + '%')
              .end()
              .start(self.ProgressView, { data: pct }).end()
            .end();
          });
          if ( rows_.length > self.MAX_CARDS ) {
            this.start().addClass('p-sm', self.myClass('more'))
              .add('+' + (rows_.length - self.MAX_CARDS) + ' more')
            .end();
          }
        }));
    }
  ]
});

// foam.pattern.Singleton can't be used here -- see documentation above.
// Memoize create() by hand, using the same cls.private_.instance_ slot
// Singleton itself would use.
(function() {
  var cls  = foam.core.partition.PartitionLoadToastStack;
  var base = cls.create;
  cls.create = function(args, X) {
    return cls.private_.instance_ || ( cls.private_.instance_ = base.call(cls, args, X) );
  };
})();
