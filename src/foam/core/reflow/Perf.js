/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.ENUM({
  package: 'foam.core.reflow',
  name: 'PerfSeverity',

  documentation: 'Severity of a flagged performance issue, drives colour in the report.',

  values: [
    { name: 'OK',   label: 'OK' },
    { name: 'WARN', label: 'Warning' },
    { name: 'BAD',  label: 'Critical' }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'PerfRepeatedRequest',

  documentation: `A network request fired more than once in the capture window -
    same URL and request body, so a cache candidate (findings #3/#4).`,

  properties: [
    { class: 'String', name: 'url' },
    { class: 'Int',    name: 'count' },
    { class: 'Long',   name: 'requestBytes', documentation: 'request body size of one call' }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'PerfIssue',

  documentation: 'One flagged performance problem: a severity, a category and a human detail line.',

  properties: [
    { class: 'Enum', of: 'foam.core.reflow.PerfSeverity', name: 'severity' },
    { class: 'String', name: 'category' },
    { class: 'String', name: 'detail' }
  ]
});


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
    { class: 'Float',  name: 'loadEventMs', documentation: 'navigation timing loadEventEnd' },
    { class: 'Int',    name: 'domNodeCount', documentation: 'live attached element count (querySelectorAll(*)). Not the DevTools counter, which includes detached nodes.' },
    { class: 'Int',    name: 'tableCellCount', documentation: 'count of u2 div-grid table cells (.foam-u2-table-TableView-td). u2 tables are div grids, not <table>.' }
  ],

  methods: [
    function capture(perf, nav, doc) {
      /** Populate this snapshot from a Performance, a Navigator and a Document object. **/
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

      if ( doc && doc.querySelectorAll ) {
        this.domNodeCount   = doc.querySelectorAll('*').length;
        this.tableCellCount = doc.querySelectorAll('.foam-u2-table-TableView-td').length;
      }

      return this;
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'PerfReport',

  documentation: `A start/end pair of PerfSnapshots plus derived deltas, FPS,
    long-task, DOM, network and console statistics for the captured window, plus
    a list of flagged issues. This is the structured value stored on the perf
    block, so it serializes into saved flows and can be exported and compared
    across runs. toReport() renders a copy-friendly plain-text summary.`,

  requires: [
    'foam.core.reflow.PerfIssue',
    'foam.core.reflow.PerfSeverity'
  ],

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
    { class: 'Float', name: 'longTaskTotalMs' },
    { class: 'Float', name: 'longestTaskMs', documentation: 'duration of the single worst long task' },
    { class: 'Float', name: 'mainThreadBlockedPct', documentation: 'longTaskTotalMs / elapsedMs * 100 - GC / main-thread-busy proxy' },
    { class: 'Int',   name: 'domNodeDelta', documentation: 'live attached nodes added during the window (flow DOM cost)' },
    { class: 'Int',   name: 'tableCellDelta', documentation: 'u2 div-grid table cells added during the window' },
    { class: 'Int',   name: 'networkCallCount', documentation: 'fetch calls observed during the window' },
    { class: 'Long',  name: 'networkUploadBytes', documentation: 'sum of request body sizes' },
    { class: 'Long',  name: 'largestRequestBytes', documentation: 'largest single request body' },
    { class: 'Int',   name: 'repeatedRequestCount', documentation: 'distinct (url, body) keys fired more than once' },
    { class: 'FObjectArray', of: 'foam.core.reflow.PerfRepeatedRequest', name: 'repeatedRequests' },
    { class: 'Int',   name: 'warnCount', documentation: 'console.warn calls during the window' },
    { class: 'Float', name: 'warnRate', documentation: 'console.warn calls per second' },
    { class: 'FObjectArray', of: 'foam.core.reflow.PerfIssue', name: 'issues' }
  ],

  constants: {
    // Fixed thresholds. WARN crosses into yellow, BAD into red.
    MIN_FPS_WARN:        30,
    MIN_FPS_BAD:         15,
    BLOCKED_PCT_WARN:    30,
    BLOCKED_PCT_BAD:     50,
    LONGEST_TASK_WARN:   50,
    LONGEST_TASK_BAD:    100,
    DOM_DELTA_WARN:      5000,
    DOM_DELTA_BAD:       50000,
    REPEAT_COUNT_WARN:   1,
    REPEAT_COUNT_BAD:    5,
    REQUEST_BYTES_WARN:  102400,    // 100 KB
    REQUEST_BYTES_BAD:   1048576,   // 1 MB
    HEAP_DELTA_WARN:     52428800,  // 50 MB
    HEAP_DELTA_BAD:      209715200, // 200 MB
    WARN_RATE_WARN:      100
  },

  methods: [
    function finish(stats) {
      /** Compute derived metrics from start/end snapshots and counters, then flag issues.
          stats: {
            frameCount, frameTotalMs, worstFrameMs,
            longTaskCount, longTaskTotalMs, longestTaskMs,
            networkCallCount, networkUploadBytes, largestRequestBytes,
            repeatedRequestCount, repeatedRequests,
            warnCount
          } **/
      this.elapsedMs            = this.endSnapshot.now - this.startSnapshot.now;
      this.heapDeltaBytes       = this.endSnapshot.usedJSHeapSize - this.startSnapshot.usedJSHeapSize;
      this.resourceDeltaCount   = this.endSnapshot.resourceCount - this.startSnapshot.resourceCount;
      this.resourceDeltaBytes   = this.endSnapshot.resourceTransferBytes - this.startSnapshot.resourceTransferBytes;
      this.domNodeDelta         = this.endSnapshot.domNodeCount - this.startSnapshot.domNodeCount;
      this.tableCellDelta       = this.endSnapshot.tableCellCount - this.startSnapshot.tableCellCount;
      this.frameCount           = stats.frameCount;
      this.avgFps               = stats.frameTotalMs > 0 ? 1000 * stats.frameCount / stats.frameTotalMs : 0;
      this.minFps               = stats.worstFrameMs > 0 ? 1000 / stats.worstFrameMs : 0;
      this.longTaskCount        = stats.longTaskCount;
      this.longTaskTotalMs      = stats.longTaskTotalMs;
      this.longestTaskMs        = stats.longestTaskMs || 0;
      this.mainThreadBlockedPct = this.elapsedMs > 0 ? Math.min(100, 100 * stats.longTaskTotalMs / this.elapsedMs) : 0;
      this.networkCallCount     = stats.networkCallCount || 0;
      this.networkUploadBytes   = stats.networkUploadBytes || 0;
      this.largestRequestBytes  = stats.largestRequestBytes || 0;
      this.repeatedRequestCount = stats.repeatedRequestCount || 0;
      this.repeatedRequests     = stats.repeatedRequests || [];
      this.warnCount            = stats.warnCount || 0;
      this.warnRate             = this.elapsedMs > 0 ? 1000 * this.warnCount / this.elapsedMs : 0;

      this.buildIssues_();
      return this;
    },

    function buildIssues_() {
      /** Compare metrics against the fixed thresholds and produce the issues list. **/
      var self   = this;
      var issues = [];

      // higher value is worse
      function flagHigh(value, warnCut, badCut, category, detail) {
        var sev = value > badCut ? 'BAD' : value > warnCut ? 'WARN' : 'OK';
        if ( sev !== 'OK' ) issues.push(self.PerfIssue.create({ severity: self.PerfSeverity[sev], category: category, detail: detail }, self));
      }
      // lower value is worse
      function flagLow(value, warnCut, badCut, category, detail) {
        var sev = value < badCut ? 'BAD' : value < warnCut ? 'WARN' : 'OK';
        if ( sev !== 'OK' ) issues.push(self.PerfIssue.create({ severity: self.PerfSeverity[sev], category: category, detail: detail }, self));
      }

      // Frame rate only meaningful once we measured frames.
      if ( this.frameCount > 0 )
        flagLow(this.minFps, this.MIN_FPS_WARN, this.MIN_FPS_BAD, 'Rendering',
          'Min FPS ' + this.numStr(this.minFps, 0) + ' (worst frame) - UI janked during capture.');

      flagHigh(this.mainThreadBlockedPct, this.BLOCKED_PCT_WARN, this.BLOCKED_PCT_BAD, 'CPU',
        'Main thread blocked ' + this.numStr(this.mainThreadBlockedPct, 0) + '% of the window by long tasks / GC.');

      flagHigh(this.longestTaskMs, this.LONGEST_TASK_WARN, this.LONGEST_TASK_BAD, 'CPU',
        'Longest client task ' + this.numStr(this.longestTaskMs, 0) + ' ms - a single operation froze the UI.');

      flagHigh(this.domNodeDelta, this.DOM_DELTA_WARN, this.DOM_DELTA_BAD, 'DOM',
        '+' + this.numStr(this.domNodeDelta, 0) + ' nodes added' +
        ( this.tableCellDelta > 0 ? ' (' + this.numStr(this.tableCellDelta, 0) + ' table cells)' : '' ) +
        ' - hidden table blocks build their full grid; check shown:false blocks over large DAOs.');

      if ( this.repeatedRequestCount >= this.REPEAT_COUNT_WARN ) {
        var worst = this.repeatedRequests && this.repeatedRequests.length ?
          this.repeatedRequests.reduce((a, b) => b.count > a.count ? b : a) : null;
        flagHigh(this.repeatedRequestCount, this.REPEAT_COUNT_WARN - 1, this.REPEAT_COUNT_BAD, 'Network',
          this.numStr(this.repeatedRequestCount, 0) + ' request(s) fired more than once' +
          ( worst ? ' - worst fetched ' + worst.count + '× (' + this.shortUrl_(worst.url) + ')' : '' ) +
          ' - cache candidate.');
      }

      flagHigh(this.largestRequestBytes, this.REQUEST_BYTES_WARN, this.REQUEST_BYTES_BAD, 'Network',
        'Largest request body ' + this.byteStr(this.largestRequestBytes) + ' - oversized predicate / payload uploaded.');

      flagHigh(this.heapDeltaBytes, this.HEAP_DELTA_WARN, this.HEAP_DELTA_BAD, 'Memory',
        'Heap grew ' + this.byteStr(this.heapDeltaBytes) + ' during the window.');

      flagHigh(this.warnRate, this.WARN_RATE_WARN, Infinity, 'Console',
        this.numStr(this.warnCount, 0) + ' console warnings (' + this.numStr(this.warnRate, 0) + '/s) - noisy and costs CPU on stack capture.');

      this.issues = issues;
    },

    function shortUrl_(url) {
      if ( ! url ) return '';
      var q = url.indexOf('?');
      var u = q >= 0 ? url.substring(0, q) : url;
      return u.length > 60 ? '…' + u.substring(u.length - 57) : u;
    },

    function numStr(n, decimals) {
      /** Number with thousands separators. **/
      if ( n == null ) return '0';
      var d = decimals == undefined ? 1 : decimals;
      var s = Number(n).toFixed(d);
      var parts = s.split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return parts.join('.');
    },

    function byteStr(bytes) {
      /** Human byte size: bytes -> KB / MB. **/
      var b = Number(bytes) || 0;
      var sign = b < 0 ? '-' : '+';
      b = Math.abs(b);
      if ( b >= 1048576 ) return sign + this.numStr(b / 1048576, 1) + ' MB';
      if ( b >= 1024 )    return sign + this.numStr(b / 1024, 1) + ' KB';
      return sign + this.numStr(b, 0) + ' B';
    },

    function toReport() {
      /** Copy-friendly plain-text summary: ISSUES, METRICS, ENVIRONMENT. **/
      var L  = [];
      var nl = '\n';
      var pad = function(s, n) { s = String(s); return s + ' '.repeat(Math.max(1, n - s.length)); };

      L.push('PERF REPORT  — ' + ( this.label || 'capture' ));
      L.push('=====================================');

      var issues = this.issues || [];
      L.push('ISSUES (' + issues.length + ')');
      if ( ! issues.length ) {
        L.push('  ✓ none');
      } else {
        issues.forEach(function(i) {
          var bad = i.severity === foam.core.reflow.PerfSeverity.BAD;
          L.push('  ' + ( bad ? '✗ CRITICAL' : '⚠ WARNING ' ) + '  ' + i.category + ': ' + i.detail);
        });
      }
      L.push('');

      L.push('METRICS');
      L.push('  ' + pad('Elapsed', 21)             + this.numStr(this.elapsedMs, 0) + ' ms');
      L.push('  ' + pad('Avg / Min FPS', 21)       + this.numStr(this.avgFps, 0) + ' / ' + this.numStr(this.minFps, 0));
      L.push('  ' + pad('Main-thread blocked', 21) + this.numStr(this.mainThreadBlockedPct, 0) + ' %');
      L.push('  ' + pad('Longest task', 21)        + this.numStr(this.longestTaskMs, 0) + ' ms');
      L.push('  ' + pad('Heap delta', 21)          + this.byteStr(this.heapDeltaBytes));
      L.push('  ' + pad('DOM nodes added', 21)     + this.numStr(this.domNodeDelta, 0) + ( this.tableCellDelta > 0 ? ' (' + this.numStr(this.tableCellDelta, 0) + ' table cells)' : '' ));
      L.push('  ' + pad('Network calls', 21)       + this.numStr(this.networkCallCount, 0) + ' (' + this.numStr(this.repeatedRequestCount, 0) + ' repeated)');
      L.push('  ' + pad('Largest request', 21)     + this.byteStr(this.largestRequestBytes));
      L.push('  ' + pad('Warnings', 21)            + this.numStr(this.warnCount, 0));
      L.push('');

      var end = this.endSnapshot;
      L.push('ENVIRONMENT');
      if ( end ) {
        L.push('  CPU cores ' + ( end.hardwareConcurrency || '?' ) +
               ' · Connection ' + ( end.connectionType || '?' ) +
               ( end.deviceMemoryGB ? ' · Device memory ' + end.deviceMemoryGB + ' GB' : '' ));
        if ( end.userAgent ) L.push('  UA ' + end.userAgent);
      }

      return L.join(nl);
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'Perf',
  extends: 'foam.u2.View',

  documentation: `Reflow performance block. Start/Stop captures a PerfReport:
    snapshots at both ends, FPS via requestAnimationFrame, long tasks via
    PerformanceObserver, DOM node deltas, fetch calls (count, upload size,
    repeats) and console.warn rate. Metrics are scored against fixed thresholds
    into a colour-coded issues panel; Copy report yields a plain-text summary.
    The report is the block's structured value. Snapshot takes a one-shot
    snapshot without a window. The capture methods are callable headlessly
    (no rendered view) - see the loadPerf command.`,

  requires: [
    'foam.core.reflow.PerfReport',
    'foam.core.reflow.PerfSnapshot',
    'foam.core.reflow.PerfSeverity'
  ],

  imports: [ 'window' ],

  messages: [
    { name: 'CAPTURING_MSG',    message: 'Capturing…' },
    { name: 'IDLE_MSG',         message: 'Idle' },
    { name: 'NO_ISSUES_MSG',    message: 'No issues flagged' },
    { name: 'ELAPSED_LABEL',    message: 'Elapsed' },
    { name: 'AVG_FPS_LABEL',    message: 'Avg / Min FPS' },
    { name: 'BLOCKED_LABEL',    message: 'Main-thread blocked' },
    { name: 'LONGEST_LABEL',    message: 'Longest task' },
    { name: 'HEAP_LABEL',       message: 'Heap delta' },
    { name: 'DOM_LABEL',        message: 'DOM nodes added' },
    { name: 'NETWORK_LABEL',    message: 'Network calls' },
    { name: 'LARGEST_LABEL',    message: 'Largest request' },
    { name: 'WARN_LABEL',       message: 'Warnings' },
    { name: 'CPU_CORES_LABEL',  message: 'CPU cores' },
    { name: 'CONNECTION_LABEL', message: 'Connection' },
    { name: 'NA_MSG',           message: 'n/a' }
  ],

  css: `
    ^ { font-size: 13px; }
    ^ table { border-collapse: collapse; }
    ^ th { text-align: left; padding: 2px 16px 2px 0; font-weight: normal; color: #5a6572; }
    ^ td { padding: 2px 0; font-variant-numeric: tabular-nums; }
    ^status { font-weight: bold; padding-bottom: 8px; }

    ^issues { margin-bottom: 12px; }
    ^issue { display: flex; align-items: baseline; gap: 8px; padding: 4px 8px; border-radius: 4px; margin-bottom: 4px; }
    ^badge { font-weight: bold; white-space: nowrap; min-width: 78px; }
    ^issue-BAD  { background: #fdecec; }
    ^issue-WARN { background: #fef7e6; }
    ^issue-OK   { background: #eaf7ee; }
    ^BAD  { color: #c0392b; }
    ^WARN { color: #b9770e; }
    ^OK   { color: #1e7e45; }

    ^section-title { font-weight: bold; margin: 10px 0 4px; }
    ^env { color: #5a6572; padding-top: 8px; }
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
    { class: 'Float', name: 'longestTaskMs_',   hidden: true, transient: true },
    { class: 'Int',   name: 'warnCount_',       hidden: true, transient: true },
    { name: 'observer_',  hidden: true, transient: true },
    { name: 'netCalls_',  hidden: true, transient: true },
    { name: 'origFetch_', hidden: true, transient: true },
    { name: 'origWarn_',  hidden: true, transient: true }
  ],

  methods: [
    function render() {
      var self = this;
      this.addClass();

      this.start().addClass(this.myClass('status'))
        .add(this.running$.map(r => r ? self.CAPTURING_MSG : self.IDLE_MSG))
      .end();

      this.startContext({ data: this })
        .add(this.START_CAPTURE, this.STOP_CAPTURE, this.SNAPSHOT, this.COPY_REPORT)
      .endContext();

      // Watch report.elapsedMs (a dot-slot): refires both on report reassignment
      // (Start/Stop) and on copyFrom into the same instance (the loadPerf path).
      this.add(this.dynamic(function(report$elapsedMs) {
        var r = self.report;
        if ( ! r || ! r.endSnapshot ) return;
        self.renderIssues_(this, r);
        self.renderMetrics_(this, r);
        self.renderEnv_(this, r);
      }));

      this.onDetach(function() { self.stopCapture_(); });
    },

    function renderIssues_(el, r) {
      var self   = this;
      var issues = r.issues || [];
      var box = el.start().addClass(self.myClass('issues'));
      if ( ! issues.length ) {
        box.start().addClass(self.myClass('issue'), self.myClass('issue-OK'))
          .start('span').addClass(self.myClass('badge'), self.myClass('OK')).add('✓ OK').end()
          .start('span').add(self.NO_ISSUES_MSG).end()
        .end();
      } else {
        issues.forEach(function(i) {
          var bad   = i.severity === self.PerfSeverity.BAD;
          var sName = i.severity.name; // 'BAD' | 'WARN'
          box.start().addClass(self.myClass('issue'), self.myClass('issue-' + sName))
            .start('span').addClass(self.myClass('badge'), self.myClass(sName))
              .add( bad ? '✗ CRITICAL' : '⚠ WARNING' )
            .end()
            .start('span').add(i.category + ': ' + i.detail).end()
          .end();
        });
      }
      box.end();
    },

    function renderMetrics_(el, r) {
      var self = this;
      // Colour a value cell by comparing against this report's thresholds.
      var cls = function(sev) { return self.myClass(sev); }; // 'BAD'|'WARN'|'OK'
      var hi  = function(v, w, b) { return v > b ? 'BAD' : v > w ? 'WARN' : 'OK'; };
      var lo  = function(v, w, b) { return v < b ? 'BAD' : v < w ? 'WARN' : 'OK'; };

      var row = function(label, text, sev) {
        var tr = el2.start('tr');
        tr.start('th').add(label).end();
        var td = tr.start('td');
        if ( sev && sev !== 'OK' ) td.addClass(cls(sev));
        td.add(text).end();
        tr.end();
      };
      var el2 = el.start('table');
      row(self.ELAPSED_LABEL, r.numStr(r.elapsedMs, 0) + ' ms');
      row(self.AVG_FPS_LABEL, r.numStr(r.avgFps, 0) + ' / ' + r.numStr(r.minFps, 0),
        r.frameCount > 0 ? lo(r.minFps, r.MIN_FPS_WARN, r.MIN_FPS_BAD) : null);
      row(self.BLOCKED_LABEL, r.numStr(r.mainThreadBlockedPct, 0) + ' %',
        hi(r.mainThreadBlockedPct, r.BLOCKED_PCT_WARN, r.BLOCKED_PCT_BAD));
      row(self.LONGEST_LABEL, r.numStr(r.longestTaskMs, 0) + ' ms',
        hi(r.longestTaskMs, r.LONGEST_TASK_WARN, r.LONGEST_TASK_BAD));
      row(self.HEAP_LABEL, r.byteStr(r.heapDeltaBytes),
        hi(r.heapDeltaBytes, r.HEAP_DELTA_WARN, r.HEAP_DELTA_BAD));
      row(self.DOM_LABEL, r.numStr(r.domNodeDelta, 0) + ( r.tableCellDelta > 0 ? ' (' + r.numStr(r.tableCellDelta, 0) + ' cells)' : '' ),
        hi(r.domNodeDelta, r.DOM_DELTA_WARN, r.DOM_DELTA_BAD));
      row(self.NETWORK_LABEL, r.numStr(r.networkCallCount, 0) + ' (' + r.numStr(r.repeatedRequestCount, 0) + ' repeated)',
        r.repeatedRequestCount >= r.REPEAT_COUNT_BAD ? 'BAD' : r.repeatedRequestCount >= r.REPEAT_COUNT_WARN ? 'WARN' : 'OK');
      row(self.LARGEST_LABEL, r.byteStr(r.largestRequestBytes),
        hi(r.largestRequestBytes, r.REQUEST_BYTES_WARN, r.REQUEST_BYTES_BAD));
      row(self.WARN_LABEL, r.numStr(r.warnCount, 0),
        hi(r.warnRate, r.WARN_RATE_WARN, Infinity));
      el2.end();
    },

    function renderEnv_(el, r) {
      var self = this;
      var end  = r.endSnapshot;
      el.start().addClass(self.myClass('env'))
        .add(self.CPU_CORES_LABEL + ' ' + ( end.hardwareConcurrency || self.NA_MSG ))
        .add(' · ' + self.CONNECTION_LABEL + ' ' + ( end.connectionType || self.NA_MSG ))
        .add(end.deviceMemoryGB ? ' · ' + end.deviceMemoryGB + ' GB' : '')
      .end();
    },

    function takeSnapshot_() {
      return this.PerfSnapshot.create({}, this)
        .capture(this.window.performance, this.window.navigator, this.window.document);
    },

    function startCapture_() {
      /** Begin a capture window. Callable headlessly - no rendered view required. **/
      var self = this;
      this.frameCount_ = this.frameTotalMs_ = this.worstFrameMs_ = this.lastFrameTime_ = 0;
      this.longTaskCount_ = this.longTaskTotalMs_ = this.longestTaskMs_ = 0;
      this.warnCount_ = 0;
      this.report = this.PerfReport.create({ startSnapshot: this.takeSnapshot_() }, this);

      try {
        this.observer_ = new PerformanceObserver(function(list) {
          list.getEntries().forEach(function(e) {
            self.longTaskCount_++;
            self.longTaskTotalMs_ += e.duration;
            if ( e.duration > self.longestTaskMs_ ) self.longestTaskMs_ = e.duration;
          });
        });
        this.observer_.observe({ entryTypes: ['longtask'] });
      } catch (e) { /* longtask unsupported (Firefox/Safari) */ }

      this.wrapFetch_();
      this.wrapWarn_();

      this.running = true;
      this.window.requestAnimationFrame(this.frameTick);
    },

    function finishCapture_() {
      /** End the capture window and compute the report. Callable headlessly. **/
      var net = this.summarizeNetwork_(this.netCalls_ || []);
      this.stopCapture_();
      this.report.endSnapshot = this.takeSnapshot_();
      this.report.finish({
        frameCount:           this.frameCount_,
        frameTotalMs:         this.frameTotalMs_,
        worstFrameMs:         this.worstFrameMs_,
        longTaskCount:        this.longTaskCount_,
        longTaskTotalMs:      this.longTaskTotalMs_,
        longestTaskMs:        this.longestTaskMs_,
        networkCallCount:     net.networkCallCount,
        networkUploadBytes:   net.networkUploadBytes,
        largestRequestBytes:  net.largestRequestBytes,
        repeatedRequestCount: net.repeatedRequestCount,
        repeatedRequests:     net.repeatedRequests,
        warnCount:            this.warnCount_
      });
      return this.report;
    },

    function stopCapture_() {
      this.running = false;
      if ( this.observer_ ) { this.observer_.disconnect(); this.observer_ = null; }
      this.unwrapFetch_();
      this.unwrapWarn_();
    },

    function wrapFetch_() {
      /** Record {url, reqBytes, hash} for each fetch during the window. **/
      var self = this, w = this.window;
      if ( ! w || ! w.fetch ) return;
      this.netCalls_  = [];
      this.origFetch_ = w.fetch;
      var orig = this.origFetch_;
      w.fetch = function(input, init) {
        try {
          var url  = ( typeof input === 'string' ) ? input : ( input && input.url ) || '';
          var body = init && init.body;
          var bodyStr = ( typeof body === 'string' ) ? body : '';
          self.netCalls_.push({ url: url, reqBytes: bodyStr.length, hash: self.hashStr_(url + '|' + bodyStr) });
        } catch (e) { /* never break the real request */ }
        return orig.apply(this, arguments);
      };
    },

    function unwrapFetch_() {
      if ( this.origFetch_ ) { this.window.fetch = this.origFetch_; this.origFetch_ = null; }
    },

    function wrapWarn_() {
      var self = this, w = this.window;
      if ( ! w || ! w.console || ! w.console.warn ) return;
      this.origWarn_ = w.console.warn;
      var orig = this.origWarn_;
      w.console.warn = function() { self.warnCount_++; return orig.apply(this, arguments); };
    },

    function unwrapWarn_() {
      if ( this.origWarn_ ) { this.window.console.warn = this.origWarn_; this.origWarn_ = null; }
    },

    function summarizeNetwork_(calls) {
      /** Aggregate recorded fetch calls: totals, largest, and repeats by (url,body) hash. **/
      var byHash = {};
      var upload = 0, largest = 0;
      calls.forEach(function(c) {
        upload += c.reqBytes;
        if ( c.reqBytes > largest ) largest = c.reqBytes;
        var g = byHash[c.hash] || ( byHash[c.hash] = { url: c.url, count: 0, requestBytes: c.reqBytes } );
        g.count++;
      });
      var repeats = [];
      Object.keys(byHash).forEach(function(k) {
        var g = byHash[k];
        if ( g.count > 1 ) repeats.push(foam.core.reflow.PerfRepeatedRequest.create(g));
      });
      repeats.sort(function(a, b) { return b.count - a.count; });
      return {
        networkCallCount:     calls.length,
        networkUploadBytes:   upload,
        largestRequestBytes:  largest,
        repeatedRequestCount: repeats.length,
        repeatedRequests:     repeats
      };
    },

    function hashStr_(s) {
      /** Small 32-bit string hash (djb2-ish) for deduping identical requests. **/
      var h = 5381;
      for ( var i = 0 ; i < s.length ; i++ ) h = ( ( h << 5 ) + h + s.charCodeAt(i) ) | 0;
      return h;
    }
  ],

  actions: [
    {
      // 'start'/'stop' would install prototype methods that shadow Element.start()/stop
      name: 'startCapture',
      label: 'Start',
      isEnabled: function(running) { return ! running; },
      code: function() { this.startCapture_(); }
    },
    {
      name: 'stopCapture',
      label: 'Stop',
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
    },
    {
      name: 'copyReport',
      label: 'Copy report',
      isEnabled: function(running) { return ! running; },
      code: function() {
        var text = this.report.toReport();
        try {
          if ( this.window.navigator.clipboard ) this.window.navigator.clipboard.writeText(text);
        } catch (e) { /* clipboard blocked - report text still available via toReport() */ }
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
