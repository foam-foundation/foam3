/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.perf',
  name: 'MetricThresholdMarker',
  implements: [ 'foam.core.reflow.perf.PerfMarker' ],

  documentation: `Marks captured metrics that breach fixed thresholds. Table-driven:
    each METRICS row is one check (which report property, direction, warn/bad cuts,
    category and detail text). Add or tune a metric by editing one row - no new code
    path. Each emitted issue is tagged with its metric key so the view can colour the
    matching row from the issues alone (no duplicated thresholds in the view).`,

  requires: [
    'foam.core.reflow.perf.PerfIssue',
    'foam.core.reflow.perf.PerfSeverity'
  ],

  constants: {
    // dir: 'high' = bigger is worse, 'low' = smaller is worse.
    // when (optional): only check if it returns true. detail: fn(report) -> String.
    METRICS: [
      { metric: 'minFps', dir: 'low', warn: 30, bad: 15, category: 'Rendering',
        when:   function(r) { return r.frameCount > 0; },
        detail: function(r) { return 'Min FPS ' + r.numStr(r.minFps, 0) + ' (worst frame) - UI janked during capture.'; } },

      { metric: 'mainThreadBlockedPct', dir: 'high', warn: 30, bad: 50, category: 'CPU',
        detail: function(r) { return 'Main thread blocked ' + r.numStr(r.mainThreadBlockedPct, 0) + '% of the window by long tasks / GC.'; } },

      { metric: 'longestTaskMs', dir: 'high', warn: 50, bad: 100, category: 'CPU',
        detail: function(r) { return 'Longest client task ' + r.numStr(r.longestTaskMs, 0) + ' ms - a single operation froze the UI.'; } },

      { metric: 'domNodeDelta', dir: 'high', warn: 5000, bad: 50000, category: 'DOM',
        detail: function(r) { return '+' + r.numStr(r.domNodeDelta, 0) + ' nodes added' +
          ( r.tableCellDelta > 0 ? ' (' + r.numStr(r.tableCellDelta, 0) + ' table cells)' : '' ) +
          ' - hidden table blocks build their full grid; check shown:false blocks over large DAOs.'; } },

      { metric: 'repeatedRequestCount', dir: 'high', warn: 1, bad: 5, category: 'Network',
        detail: function(r) {
          var worst = r.repeatedRequests && r.repeatedRequests.length ?
            r.repeatedRequests.reduce(function(a, b) { return b.count > a.count ? b : a; }) : null;
          return r.numStr(r.repeatedRequestCount, 0) + ' request(s) fired more than once' +
            ( worst ? ' - worst fetched ' + worst.count + '× (' + r.shortUrl_(worst.url) + ')' : '' ) + ' - cache candidate.';
        } },

      { metric: 'largestRequestBytes', dir: 'high', warn: 102400, bad: 1048576, category: 'Network',
        detail: function(r) { return 'Largest request body ' + r.byteStr(r.largestRequestBytes) + ' - oversized predicate / payload uploaded.'; } },

      { metric: 'heapDeltaBytes', dir: 'high', warn: 52428800, bad: 209715200, category: 'Memory',
        detail: function(r) { return 'Heap grew ' + r.byteStr(r.heapDeltaBytes) + ' during the window.'; } },

      { metric: 'warnRate', dir: 'high', warn: 100, bad: Infinity, category: 'Console',
        detail: function(r) { return r.numStr(r.warnCount, 0) + ' console warnings (' + r.numStr(r.warnRate, 0) + '/s) - noisy and costs CPU on stack capture.'; } }
    ]
  },

  methods: [
    function mark(report) {
      var self = this, out = [];
      this.METRICS.forEach(function(m) {
        if ( m.when && ! m.when(report) ) return;
        var v   = report[m.metric];
        var sev = m.dir === 'low'
          ? ( v < m.bad ? 'BAD' : v < m.warn ? 'WARN' : 'OK' )
          : ( v > m.bad ? 'BAD' : v > m.warn ? 'WARN' : 'OK' );
        if ( sev === 'OK' ) return;
        out.push(self.PerfIssue.create({
          severity: self.PerfSeverity[sev],
          category: m.category,
          metric:   m.metric,
          detail:   m.detail(report)
        }));
      });
      return out;
    }
  ]
});
