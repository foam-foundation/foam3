/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'PerfSnapshot',

  documentation: `Point-in-time capture of browser/system performance metrics.
    All browser APIs are passed in as arguments to capture() so the logic is
    testable without a real browser environment. Missing APIs (Safari/Firefox)
    leave properties at their type defaults.`,

  properties: [
    { class: 'DateTime', name: 'capturedAt' },
    { class: 'Float',  name: 'now', documentation: 'performance.now() at capture time (ms since page load)' },
    { class: 'String', name: 'userAgent' },
    { class: 'Int',    name: 'hardwareConcurrency', documentation: 'navigator.hardwareConcurrency (logical cores)' },
    { class: 'Float',  name: 'deviceMemoryGB', documentation: 'navigator.deviceMemory - Chrome only' },
    { class: 'Long',   name: 'usedJSHeapSize',  documentation: 'performance.memory - Chrome only, bytes' },
    { class: 'Long',   name: 'totalJSHeapSize', documentation: 'performance.memory - Chrome only, bytes' },
    { class: 'Long',   name: 'jsHeapSizeLimit', documentation: 'performance.memory - Chrome only, bytes' },
    { class: 'String', name: 'connectionType', documentation: 'navigator.connection.effectiveType - Chrome only' },
    { class: 'Float',  name: 'downlinkMbps', documentation: 'navigator.connection.downlink - Chrome only' },
    { class: 'Int',    name: 'rttMs', documentation: 'navigator.connection.rtt - Chrome only' },
    { class: 'Int',    name: 'resourceCount', documentation: 'count of resource timing entries' },
    { class: 'Long',   name: 'resourceTransferBytes', documentation: 'sum of resource transferSize' },
    { class: 'Float',  name: 'domContentLoadedMs', documentation: 'navigation timing domContentLoadedEventEnd' },
    { class: 'Float',  name: 'loadEventMs', documentation: 'navigation timing loadEventEnd' }
  ],

  methods: [
    function capture(perf, nav) {
      /** Populate this snapshot from a Performance and a Navigator object. **/
      this.capturedAt = new Date();
      this.now        = perf.now();

      if ( nav.userAgent )           this.userAgent           = nav.userAgent;
      if ( nav.hardwareConcurrency ) this.hardwareConcurrency = nav.hardwareConcurrency;
      if ( nav.deviceMemory )        this.deviceMemoryGB      = nav.deviceMemory;

      if ( perf.memory ) {
        this.usedJSHeapSize  = perf.memory.usedJSHeapSize;
        this.totalJSHeapSize = perf.memory.totalJSHeapSize;
        this.jsHeapSizeLimit = perf.memory.jsHeapSizeLimit;
      }

      if ( nav.connection ) {
        if ( nav.connection.effectiveType ) this.connectionType = nav.connection.effectiveType;
        if ( nav.connection.downlink )      this.downlinkMbps   = nav.connection.downlink;
        if ( nav.connection.rtt )           this.rttMs          = nav.connection.rtt;
      }

      var navEntries = perf.getEntriesByType('navigation');
      if ( navEntries && navEntries.length ) {
        this.domContentLoadedMs = navEntries[0].domContentLoadedEventEnd;
        this.loadEventMs        = navEntries[0].loadEventEnd;
      }

      var resources = perf.getEntriesByType('resource');
      if ( resources ) {
        this.resourceCount         = resources.length;
        this.resourceTransferBytes = resources.reduce((s, r) => s + (r.transferSize || 0), 0);
      }

      return this;
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'PerfReport',

  documentation: `A start/end pair of PerfSnapshots plus derived deltas, FPS and
    long-task statistics for the captured window. This is the structured value
    stored on the perf block, so it serializes into saved flows and can be
    exported and compared across runs.`,

  properties: [
    { class: 'String', name: 'label', documentation: 'optional user label for comparing runs' },
    { class: 'FObjectProperty', of: 'foam.core.reflow.PerfSnapshot', name: 'startSnapshot' },
    { class: 'FObjectProperty', of: 'foam.core.reflow.PerfSnapshot', name: 'endSnapshot' },
    { class: 'Float', name: 'elapsedMs' },
    { class: 'Long',  name: 'heapDeltaBytes' },
    { class: 'Int',   name: 'resourceDeltaCount' },
    { class: 'Long',  name: 'resourceDeltaBytes' },
    { class: 'Float', name: 'avgFps' },
    { class: 'Float', name: 'minFps', documentation: '1000 / worst observed frame interval' },
    { class: 'Int',   name: 'frameCount' },
    { class: 'Int',   name: 'longTaskCount', documentation: 'PerformanceObserver longtask entries (Chrome only)' },
    { class: 'Float', name: 'longTaskTotalMs' }
  ],

  methods: [
    function finish(stats) {
      /** Compute derived metrics from start/end snapshots and frame/longtask counters.
          stats: { frameCount, frameTotalMs, worstFrameMs, longTaskCount, longTaskTotalMs } **/
      this.elapsedMs          = this.endSnapshot.now - this.startSnapshot.now;
      this.heapDeltaBytes     = this.endSnapshot.usedJSHeapSize - this.startSnapshot.usedJSHeapSize;
      this.resourceDeltaCount = this.endSnapshot.resourceCount - this.startSnapshot.resourceCount;
      this.resourceDeltaBytes = this.endSnapshot.resourceTransferBytes - this.startSnapshot.resourceTransferBytes;
      this.frameCount         = stats.frameCount;
      this.avgFps             = stats.frameTotalMs > 0 ? 1000 * stats.frameCount / stats.frameTotalMs : 0;
      this.minFps             = stats.worstFrameMs > 0 ? 1000 / stats.worstFrameMs : 0;
      this.longTaskCount      = stats.longTaskCount;
      this.longTaskTotalMs    = stats.longTaskTotalMs;
      return this;
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'Perf',
  extends: 'foam.u2.View',

  documentation: `Reflow performance block. Start/Stop captures a PerfReport:
    snapshots at both ends, FPS via requestAnimationFrame, long tasks via
    PerformanceObserver (Chrome). The report is the block's structured value.
    Snapshot action takes a one-shot snapshot without a window. The capture
    methods are callable headlessly (no rendered view) - see the loadPerf
    command.`,

  requires: [
    'foam.core.reflow.PerfReport',
    'foam.core.reflow.PerfSnapshot'
  ],

  imports: [ 'window' ],

  messages: [
    { name: 'CAPTURING_MSG',    message: 'Capturing…' },
    { name: 'IDLE_MSG',         message: 'Idle' },
    { name: 'ELAPSED_LABEL',    message: 'Elapsed' },
    { name: 'AVG_FPS_LABEL',    message: 'Avg FPS' },
    { name: 'MIN_FPS_LABEL',    message: 'Min FPS (worst frame)' },
    { name: 'HEAP_DELTA_LABEL', message: 'Heap delta' },
    { name: 'LONG_TASKS_LABEL', message: 'Long tasks' },
    { name: 'RESOURCES_LABEL',  message: 'Resources loaded' },
    { name: 'CPU_CORES_LABEL',  message: 'CPU cores' },
    { name: 'CONNECTION_LABEL', message: 'Connection' },
    { name: 'NA_MSG',           message: 'n/a' }
  ],

  css: `
    ^ { font-size: 13px; }
    ^ table { border-collapse: collapse; }
    ^ th { text-align: left; padding: 2px 12px 2px 0; }
    ^ td { padding: 2px 0; font-variant-numeric: tabular-nums; }
    ^status { font-weight: bold; padding-bottom: 8px; }
    ^json { font-family: monospace; white-space: pre; overflow-x: auto; max-height: 240px; }
  `,

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.core.reflow.PerfReport',
      name: 'report',
      factory: function() { return this.PerfReport.create({}, this); }
    },
    { class: 'Boolean', name: 'running' },
    // transient run state, not serialized
    { class: 'Int',   name: 'frameCount_',      hidden: true, transient: true },
    { class: 'Float', name: 'frameTotalMs_',    hidden: true, transient: true },
    { class: 'Float', name: 'worstFrameMs_',    hidden: true, transient: true },
    { class: 'Float', name: 'lastFrameTime_',   hidden: true, transient: true },
    { class: 'Int',   name: 'longTaskCount_',   hidden: true, transient: true },
    { class: 'Float', name: 'longTaskTotalMs_', hidden: true, transient: true },
    { name: 'observer_', hidden: true, transient: true }
  ],

  methods: [
    function render() {
      var self = this;
      this.addClass();

      this.start().addClass(this.myClass('status'))
        .add(this.running$.map(r => r ? self.CAPTURING_MSG : self.IDLE_MSG))
      .end();

      this.startContext({ data: this })
        .add(this.START, this.STOP, this.SNAPSHOT)
      .endContext();

      this.add(this.dynamic(function(report$elapsedMs) {
        var r = self.report;
        if ( ! r.endSnapshot ) return;
        var fmt = function(n, d) { return n == null ? self.NA_MSG : Number(n).toFixed(d == undefined ? 1 : d); };
        var mb  = function(b) { return r.endSnapshot.usedJSHeapSize ? fmt(b / 1048576, 2) + ' MB' : self.NA_MSG; };
        this.start('table')
          .start('tr').start('th').add(self.ELAPSED_LABEL).end().start('td').add(fmt(r.elapsedMs), ' ms').end().end()
          .start('tr').start('th').add(self.AVG_FPS_LABEL).end().start('td').add(fmt(r.avgFps)).end().end()
          .start('tr').start('th').add(self.MIN_FPS_LABEL).end().start('td').add(fmt(r.minFps)).end().end()
          .start('tr').start('th').add(self.HEAP_DELTA_LABEL).end().start('td').add(mb(r.heapDeltaBytes)).end().end()
          .start('tr').start('th').add(self.LONG_TASKS_LABEL).end().start('td').add(r.longTaskCount, ' (', fmt(r.longTaskTotalMs), ' ms)').end().end()
          .start('tr').start('th').add(self.RESOURCES_LABEL).end().start('td').add(r.resourceDeltaCount, ' (', fmt(r.resourceDeltaBytes / 1024), ' KB)').end().end()
          .start('tr').start('th').add(self.CPU_CORES_LABEL).end().start('td').add(r.endSnapshot.hardwareConcurrency || self.NA_MSG).end().end()
          .start('tr').start('th').add(self.CONNECTION_LABEL).end().start('td').add(r.endSnapshot.connectionType || self.NA_MSG).end().end()
        .end();
        this.start().addClass(self.myClass('json'))
          .add(foam.json.Pretty.stringify(r))
        .end();
      }));

      this.onDetach(function() { self.stopCapture_(); });
    },

    function takeSnapshot_() {
      return this.PerfSnapshot.create({}, this).capture(this.window.performance, this.window.navigator);
    },

    function startCapture_() {
      /** Begin a capture window. Callable headlessly - no rendered view required. **/
      var self = this;
      this.frameCount_ = this.frameTotalMs_ = this.worstFrameMs_ = this.lastFrameTime_ = 0;
      this.longTaskCount_ = this.longTaskTotalMs_ = 0;
      this.report = this.PerfReport.create({ startSnapshot: this.takeSnapshot_() }, this);

      try {
        this.observer_ = new PerformanceObserver(function(list) {
          list.getEntries().forEach(function(e) {
            self.longTaskCount_++;
            self.longTaskTotalMs_ += e.duration;
          });
        });
        this.observer_.observe({ entryTypes: ['longtask'] });
      } catch (e) { /* longtask unsupported (Firefox/Safari) */ }

      this.running = true;
      this.window.requestAnimationFrame(this.frameTick);
    },

    function finishCapture_() {
      /** End the capture window and compute the report. Callable headlessly. **/
      this.stopCapture_();
      this.report.endSnapshot = this.takeSnapshot_();
      this.report.finish({
        frameCount:      this.frameCount_,
        frameTotalMs:    this.frameTotalMs_,
        worstFrameMs:    this.worstFrameMs_,
        longTaskCount:   this.longTaskCount_,
        longTaskTotalMs: this.longTaskTotalMs_
      });
      return this.report;
    },

    function stopCapture_() {
      this.running = false;
      if ( this.observer_ ) { this.observer_.disconnect(); this.observer_ = null; }
    }
  ],

  actions: [
    {
      name: 'start',
      isEnabled: function(running) { return ! running; },
      code: function() { this.startCapture_(); }
    },
    {
      name: 'stop',
      isEnabled: function(running) { return running; },
      code: function() { this.finishCapture_(); }
    },
    {
      name: 'snapshot',
      label: 'Snapshot',
      isEnabled: function(running) { return ! running; },
      code: function() {
        var s = this.takeSnapshot_();
        this.report = this.PerfReport.create({ startSnapshot: s, endSnapshot: s }, this);
        this.report.finish({ frameCount: 0, frameTotalMs: 0, worstFrameMs: 0, longTaskCount: 0, longTaskTotalMs: 0 });
      }
    }
  ],

  listeners: [
    {
      name: 'frameTick',
      code: function() {
        if ( ! this.running ) return;
        var t = this.window.performance.now();
        if ( this.lastFrameTime_ ) {
          var dt = t - this.lastFrameTime_;
          this.frameCount_++;
          this.frameTotalMs_ += dt;
          if ( dt > this.worstFrameMs_ ) this.worstFrameMs_ = dt;
        }
        this.lastFrameTime_ = t;
        this.window.requestAnimationFrame(this.frameTick);
      }
    }
  ]
});
