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
        detail: function(r) { return 'Frame rate dropped to ' + r.numStr(r.minFps, 0) + ' fps - the screen stuttered.'; } },

      { metric: 'mainThreadBlockedPct', dir: 'high', warn: 30, bad: 50, category: 'Processing',
        detail: function(r) { return 'The screen was frozen ' + r.numStr(r.mainThreadBlockedPct, 0) + '% of the load - busy with heavy work.'; } },

      { metric: 'longestTaskMs', dir: 'high', warn: 50, bad: 100, category: 'Processing',
        detail: function(r) { return 'A single operation froze the screen for ' + r.durStr(r.longestTaskMs) + '.'; } },

      { metric: 'domNodeDelta', dir: 'high', warn: 5000, bad: 50000, category: 'Page',
        detail: function(r) { return '+' + r.numStr(r.domNodeDelta, 0) + ' page elements added' +
          ( r.tableCellDelta > 0 ? ' (' + r.numStr(r.tableCellDelta, 0) + ' table cells)' : '' ) +
          ' - heavy page growth during load.'; } },

      { metric: 'repeatedRequestCount', dir: 'high', warn: 1, bad: 5, category: 'Server',
        detail: function(r) {
          var worst = r.repeatedRequests && r.repeatedRequests.length ?
            r.repeatedRequests.reduce(function(a, b) { return b.count > a.count ? b : a; }) : null;
          return 'The same data was loaded ' + r.numStr(r.repeatedRequestCount, 0) + ' extra time(s)' +
            ( worst ? ' - worst loaded ' + worst.count + '× (' + r.shortUrl_(worst.url) + ')' : '' ) + ' - cache it.';
        } },

      { metric: 'largestRequestBytes', dir: 'high', warn: 102400, bad: 1048576, category: 'Server',
        detail: function(r) { return 'A single request sent ' + r.byteStr(r.largestRequestBytes) + ' to the server - oversized query or payload.'; } },

      { metric: 'heapDeltaBytes', dir: 'high', warn: 52428800, bad: 209715200, category: 'Memory',
        detail: function(r) { return 'Memory use grew ' + r.byteStr(r.heapDeltaBytes) + ' during load.'; } },

      { metric: 'warnRate', dir: 'high', warn: 100, bad: Infinity, category: 'Console',
        detail: function(r) { return r.numStr(r.warnCount, 0) + ' console warnings (' + r.numStr(r.warnRate, 0) + '/s) - noisy and slows the app.'; } }
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
