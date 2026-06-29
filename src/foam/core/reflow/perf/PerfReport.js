/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.perf',
  name: 'PerfReport',

  documentation: `A start/end pair of PerfSnapshots plus derived deltas, FPS,
    long-task, DOM, network and console statistics for the captured window, plus
    a list of flagged issues. This is the structured value stored on the perf
    block, so it serializes into saved flows and can be exported and compared
    across runs.

    Analysis is delegated to PerfMarkers (see markers_): finish() computes the raw
    metrics, analyze() runs every marker and collects their issues. toReport()
    renders a copy-friendly plain-text summary.`,

  requires: [
    'foam.core.reflow.perf.PerfIssue',
    'foam.core.reflow.perf.PerfSeverity',
    'foam.core.reflow.perf.MetricThresholdMarker'
  ],

  properties: [
    { class: 'String', name: 'label', documentation: 'optional user label for comparing runs' },
    { class: 'FObjectProperty', of: 'foam.core.reflow.perf.PerfSnapshot', name: 'startSnapshot' },
    { class: 'FObjectProperty', of: 'foam.core.reflow.perf.PerfSnapshot', name: 'endSnapshot' },
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
    { class: 'FObjectArray', of: 'foam.core.reflow.perf.PerfRepeatedRequest', name: 'repeatedRequests' },
    { class: 'FObjectArray', of: 'foam.core.reflow.perf.PerfServiceCall', name: 'serviceCalls', documentation: 'all calls grouped by service+operation+sink, most-called first' },
    { class: 'Int',   name: 'warnCount', documentation: 'console.warn calls during the window' },
    { class: 'Float', name: 'warnRate', documentation: 'console.warn calls per second' },
    { class: 'Boolean', name: 'profilingSupported', documentation: 'true if the JS Self-Profiling API captured a CPU trace' },
    { class: 'FObjectArray', of: 'foam.core.reflow.perf.PerfHotFrame', name: 'hotFunctions' },
    { class: 'FObjectArray', of: 'foam.core.reflow.perf.PerfBlockCost', name: 'blockProfile', documentation: 'per-block costs, worst first (loadPerf only)' },
    { class: 'FObjectArray', of: 'foam.core.reflow.perf.PerfIssue', name: 'issues' },
    {
      name: 'markers_',
      documentation: 'The PerfMarkers analyze() runs. Add a check by adding a marker here.',
      hidden: true,
      transient: true,
      factory: function() {
        return [ this.MetricThresholdMarker.create({}, this) ];
      }
    }
  ],

  methods: [
    function finish(stats) {
      /** Compute derived metrics from start/end snapshots and counters, then analyze.
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
      this.serviceCalls         = stats.serviceCalls || [];
      this.warnCount            = stats.warnCount || 0;
      this.warnRate             = this.elapsedMs > 0 ? 1000 * this.warnCount / this.elapsedMs : 0;

      this.analyze();
      return this;
    },

    function analyze() {
      /** Run every marker over this report and collect their issues. Idempotent -
          rebuilds issues from scratch each call. **/
      var self = this, issues = [];
      this.markers_.forEach(function(m) { issues = issues.concat(m.mark(self) || []); });
      this.issues = issues;
      return this;
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
      /** Signed human byte size for deltas: +/- KB / MB. **/
      var b = Number(bytes) || 0;
      var sign = b < 0 ? '-' : '+';
      return sign + this.sizeStr(Math.abs(b));
    },

    function sizeStr(bytes) {
      /** Unsigned human byte size for absolute sizes (request / response). **/
      var b = Math.abs(Number(bytes) || 0);
      if ( b >= 1048576 ) return this.numStr(b / 1048576, 1) + ' MB';
      if ( b >= 1024 )    return this.numStr(b / 1024, 1) + ' KB';
      return this.numStr(b, 0) + ' B';
    },

    function severityRank_(sev) {
      return sev === this.PerfSeverity.BAD ? 2 : sev === this.PerfSeverity.WARN ? 1 : 0;
    },

    function groupedIssues() {
      /** Issues bucketed by category, worst-severity group first, BAD before WARN
          within a group. Shared by the view and toReport so both group identically. **/
      var self   = this;
      var groups = {};
      ( this.issues || [] ).forEach(function(i) {
        ( groups[i.category] = groups[i.category] || [] ).push(i);
      });
      return Object.keys(groups).map(function(c) {
        var list = groups[c].slice().sort(function(a, b) { return self.severityRank_(b.severity) - self.severityRank_(a.severity); });
        var rank = list.reduce(function(m, i) { return Math.max(m, self.severityRank_(i.severity)); }, 0);
        return { category: c, issues: list, rank: rank };
      }).sort(function(a, b) { return b.rank - a.rank || ( a.category < b.category ? -1 : 1 ); });
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
        this.groupedIssues().forEach(function(g) {
          L.push('  ' + g.category.toUpperCase());
          g.issues.forEach(function(i) {
            var bad = i.severity === foam.core.reflow.perf.PerfSeverity.BAD;
            L.push('    ' + ( bad ? '✗ CRITICAL' : '⚠ WARNING ' ) + '  ' + i.detail);
          });
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

      var calls = this.serviceCalls || [];
      if ( calls.length ) {
        L.push('SERVICE CALLS (most-called first)');
        calls.forEach(function(c) {
          L.push('  ' + pad(c.count + '×', 5) + pad(c.service, 32) +
            pad(( c.operation || '' ) + ( c.sink ? ' · ' + c.sink : '' ), 26) +
            '↑' + this.sizeStr(c.requestBytes) + '  ↓' + this.sizeStr(c.responseBytes));
        }.bind(this));
        L.push('');
      }

      var blocks = this.blockProfile || [];
      if ( blocks.length ) {
        L.push('PER-BLOCK COST (worst first)');
        blocks.forEach(function(b) {
          L.push('  ' + pad(this.numStr(b.ms, 0) + ' ms', 9) + pad('+' + this.numStr(b.domDelta, 0) + ' dom', 14) + pad(this.byteStr(b.heapDelta), 12) + b.flowName);
        }.bind(this));
        L.push('');
      }

      var hot = this.hotFunctions || [];
      if ( hot.length ) {
        L.push('HOTTEST FUNCTIONS (self-profiled)');
        hot.forEach(function(f) {
          L.push('  ' + pad(this.numStr(f.pct, 0) + '%', 6) + f.name + ( f.resource ? '  (' + this.shortUrl_(f.resource) + ')' : '' ));
        }.bind(this));
        L.push('');
      }

      var end = this.endSnapshot;
      L.push('ENVIRONMENT');
      if ( end ) {
        L.push('  CPU cores ' + ( end.hardwareConcurrency || '?' ) +
               ' · Connection ' + ( end.connectionType || '?' ) +
               ( end.deviceMemoryGB ? ' · Device memory ' + end.deviceMemoryGB + ' GB' : '' ));
        if ( end.userAgent ) L.push('  UA ' + end.userAgent);
      }
      if ( ! hot.length ) {
        L.push('');
        L.push('TIP in-page profiling off - server must send "Document-Policy: js-profiling" (then no DevTools needed). Or capture manually via DevTools → Performance / tron-troff.');
      }

      return L.join(nl);
    }
  ]
});
