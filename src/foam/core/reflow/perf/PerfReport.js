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
    { class: 'FObjectArray', of: 'foam.core.reflow.perf.PerfBlockCost', name: 'blockProfile', documentation: 'per-block costs (with hottest functions), worst first (loadPerf only)' },
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
      /** Drop the host + everything up to /src/ so frames read 'foam/core/.../X.js'
          instead of the full localhost:8080/foam3/src/... repeated on every row. **/
      if ( ! url ) return '';
      var u = url.split('?')[0].split('#')[0];
      var i = u.indexOf('/src/');
      if ( i >= 0 ) return u.substring(i + 5);
      var parts = u.split('/').filter(Boolean);
      return parts.slice(-2).join('/');
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

    function durStr(ms) {
      /** Human duration (ms / s / min / h) via foam.lang.Duration. **/
      return foam.lang.Duration.duration(Math.round(Number(ms) || 0));
    },

    function frameLoc(f) {
      /** "resource:line:col" - locates the fn (in a prod one-file bundle, line/col is what matters). **/
      var loc = f.resource ? this.shortUrl_(f.resource) : '';
      if ( f.line ) loc += ':' + f.line + ( f.column ? ':' + f.column : '' );
      return loc;
    },

    function frameLabel(f) {
      /** "fn (resource:line:col)" for plain-text contexts. **/
      var loc = this.frameLoc(f);
      return f.name + ( loc ? '  (' + loc + ')' : '' );
    },

    function severityRank_(sev) {
      return sev === this.PerfSeverity.BAD ? 2 : sev === this.PerfSeverity.WARN ? 1 : 0;
    },

    function groupedIssues() {
      /** Issues bucketed by SEVERITY (Critical first, then Warning) - people triage by how
          bad it is, not by subsystem; the category travels as a tag on each issue. Shared
          by the view and toReport so both group identically. **/
      var self   = this;
      var groups = {};
      ( this.issues || [] ).forEach(function(i) {
        var k = i.severity.name;   // 'BAD' | 'WARN' | 'OK'
        ( groups[k] = groups[k] || [] ).push(i);
      });
      var LABELS = { BAD: 'Critical', WARN: 'Warning', OK: 'OK' };
      return [ 'BAD', 'WARN', 'OK' ]
        .filter(function(s) { return groups[s] && groups[s].length; })
        .map(function(s) { return { severity: self.PerfSeverity[s], label: LABELS[s], issues: groups[s] }; });
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
          L.push('  ' + g.label.toUpperCase() + ' (' + g.issues.length + ')');
          g.issues.forEach(function(i) {
            L.push('    [' + i.category + '] ' + i.detail);
          });
        });
      }
      L.push('');

      // Section order matches the UI: Per-block, Service calls, then Metrics.
      var blocks = this.blockProfile || [];
      if ( blocks.length ) {
        L.push('PER-BLOCK COST (worst first)');
        blocks.forEach(function(b) {
          L.push('  ' + pad(this.durStr(b.ms), 9) + pad('+' + this.numStr(b.domDelta, 0) + ' dom', 14) + pad(this.byteStr(b.heapDelta), 12) + b.flowName);
          ( b.hot || [] ).forEach(function(f) {
            L.push('       ' + pad(this.numStr(f.pct, 0) + '%', 6) + pad(this.durStr(f.ms), 9) + this.frameLabel(f));
          }.bind(this));
          ( b.calls || [] ).forEach(function(c) {
            L.push('       → ' + pad(c.count + '×', 5) + c.service + ' ' + ( c.operation || '' ) + ( c.sink ? ' · ' + c.sink : '' ));
          });
        }.bind(this));
        L.push('');
      }

      var calls = this.serviceCalls || [];
      if ( calls.length ) {
        L.push('SERVICE CALLS (most-called first)');
        calls.forEach(function(c) {
          var rep = c.count - ( c.distinct || c.count );
          var cnt = c.count + ( c.count === 1 ? ' call' : ' calls' ) + ( rep > 0 ? ' · ' + c.distinct + ' unique' : '' );
          var act = rep > 0 ? 'CACHE (' + rep + ' avoidable)' : '';
          L.push('  ' + pad(cnt, 20) + pad(c.service, 28) +
            pad(( c.operation || '' ) + ( c.sink ? ' · ' + c.sink : '' ), 26) +
            pad('↑' + this.sizeStr(c.requestBytes) + ' ↓' + this.sizeStr(c.responseBytes), 22) + act);
          // Only break out variants when there is more than one call to drill into.
          if ( c.count > 1 ) ( c.variants || [] ).forEach(function(v) {
            L.push('       ' + pad(v.count + '×', 5) + ( v.query || '' ) + ( v.count > 1 ? '  [identical re-fetch]' : '' ));
          });
        }.bind(this));
        L.push('');
      }

      L.push('METRICS');
      L.push('  ' + pad('Load time', 22)            + this.durStr(this.elapsedMs));
      L.push('  ' + pad('Frame rate (avg / min)', 22) + this.numStr(this.avgFps, 0) + ' / ' + this.numStr(this.minFps, 0));
      L.push('  ' + pad('UI frozen', 22)            + this.numStr(this.mainThreadBlockedPct, 0) + ' %');
      L.push('  ' + pad('Longest UI freeze', 22)    + this.durStr(this.longestTaskMs));
      L.push('  ' + pad('Memory change', 22)        + this.byteStr(this.heapDeltaBytes));
      L.push('  ' + pad('Page elements added', 22)  + this.numStr(this.domNodeDelta, 0) + ( this.tableCellDelta > 0 ? ' (' + this.numStr(this.tableCellDelta, 0) + ' table cells)' : '' ));
      L.push('  ' + pad('Server calls', 22)         + this.numStr(this.networkCallCount, 0) + ' (' + this.numStr(this.repeatedRequestCount, 0) + ' identical)');
      L.push('  ' + pad('Largest request sent', 22) + this.byteStr(this.largestRequestBytes));
      L.push('  ' + pad('Console warnings', 22)     + this.numStr(this.warnCount, 0));
      L.push('');

      var end = this.endSnapshot;
      L.push('ENVIRONMENT');
      if ( end ) {
        L.push('  CPU cores ' + ( end.hardwareConcurrency || '?' ) +
               ' · Connection ' + ( end.connectionType || '?' ) +
               ( end.deviceMemoryGB ? ' · Device memory ' + end.deviceMemoryGB + ' GB' : '' ));
        if ( end.userAgent ) L.push('  UA ' + end.userAgent);
      }
      if ( ! this.profilingSupported ) {
        L.push('');
        L.push('TIP in-page profiling off - server must send "Document-Policy: js-profiling" (then per-block hot functions fill in, no DevTools). Or capture manually via DevTools → Performance / tron-troff.');
      }

      return L.join(nl);
    }
  ]
});
