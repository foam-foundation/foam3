/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.perf',
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
  package: 'foam.core.reflow.perf',
  name: 'PerfRequestVariant',

  documentation: `One distinct request body within a service-call group: how many times
    this exact request was sent (count > 1 = byte-identical re-fetch = cache candidate)
    and the query/predicate it carried.`,

  properties: [
    { class: 'Int',    name: 'count' },
    { class: 'Long',   name: 'requestBytes' },
    { class: 'Long',   name: 'responseBytes' },
    { class: 'String', name: 'query', documentation: 'predicate / id the request asked for' }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow.perf',
  name: 'PerfServiceCall',

  documentation: `Aggregated client->server calls grouped by service + operation + sink
    (e.g. base2Tc33CASUnifiedDAO · select · GroupBy). count > 1 means the same shape of
    request hit the server repeatedly during the load - the "is this being fetched many
    times" signal. Bytes are summed over the group's calls.`,

  properties: [
    { class: 'String', name: 'service',   documentation: 'service/DAO from the request URL path' },
    { class: 'String', name: 'operation', documentation: 'RPC method: select / find / put / cmd / remove' },
    { class: 'String', name: 'sink',      documentation: 'sink class for a select (ArraySink / GroupBy / Count / ...)' },
    { class: 'Int',    name: 'count',     documentation: 'number of calls in this group' },
    { class: 'Int',    name: 'distinct',  documentation: 'unique request bodies; count - distinct = identical re-fetches (cache candidates)' },
    { class: 'FObjectArray', of: 'foam.core.reflow.perf.PerfRequestVariant', name: 'variants', documentation: 'distinct request bodies in this group, most-repeated first' },
    { class: 'Long',   name: 'requestBytes',  documentation: 'summed request-body bytes' },
    { class: 'Long',   name: 'responseBytes', documentation: 'summed response wire bytes (content-length)' }
  ],

  constants: {
    CACHEABLE_OPS: { select: true, find: true }
  },

  methods: [
    function avoidable() {
      /** Identical re-fetches a cache would remove. Only reads qualify: sending the same
          control message (cmd) or the same write twice is the caller asking for the work
          to happen twice, not a cache miss. **/
      if ( ! foam.core.reflow.perf.PerfServiceCall.CACHEABLE_OPS[this.operation] ) return 0;
      return this.count - ( this.distinct || this.count );
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow.perf',
  name: 'PerfHotFrame',

  documentation: `One hot stack frame from the JS Self-Profiling API: a function that
    cost the most self-time during the capture window (wish #1 - per-operation attribution).`,

  properties: [
    { class: 'String', name: 'name' },
    { class: 'String', name: 'resource', documentation: 'source URL the frame came from' },
    { class: 'Int',    name: 'line',   documentation: 'line in the source (locates the fn in a prod one-file bundle)' },
    { class: 'Int',    name: 'column', documentation: 'column in the source' },
    { class: 'Int',    name: 'selfSamples', documentation: 'samples whose leaf was this frame' },
    { class: 'Float',  name: 'pct', documentation: 'percent of samples within its scope (block)' },
    { class: 'Float',  name: 'ms', documentation: 'estimated CPU time = selfSamples × sampleInterval' }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow.perf',
  name: 'PerfBlockCost',

  documentation: `Per-block runtime cost during a flow load - how much one block added
    while it executed (wish #1, per-block attribution). DOM is approximate: async
    work that finishes after the block's await lands in whichever block was running.`,

  properties: [
    { class: 'String', name: 'flowName' },
    { class: 'String', name: 'cmd' },
    { class: 'Float',  name: 'ms', documentation: 'wall time the block held the load loop, its nested blocks included' },
    { class: 'Float',  name: 'selfMs', documentation: 'ms minus the blocks that ran inside it - the work this block did itself' },
    { class: 'Int',    name: 'domDelta', documentation: 'live nodes added while the block ran' },
    { class: 'Long',   name: 'heapDelta', documentation: 'heap growth while the block ran, bytes' },
    { class: 'FObjectArray', of: 'foam.core.reflow.perf.PerfHotFrame', name: 'hot', documentation: 'hottest functions sampled in this block\'s own time, nested blocks excluded' },
    { class: 'FObjectArray', of: 'foam.core.reflow.perf.PerfServiceCall', name: 'calls', documentation: 'server calls this block made itself; a nested block\'s calls belong to that block' },
    { class: 'FObjectArray', of: 'foam.core.reflow.perf.PerfBlockCost', name: 'children', documentation: 'blocks that ran inside this one, worst first; their cost is part of this row total' }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow.perf',
  name: 'PerfIssue',

  documentation: `One flagged performance problem: a severity, a category, a human
    detail line, and the metric key it concerns (so the view can colour the matching row).`,

  properties: [
    { class: 'Enum', of: 'foam.core.reflow.perf.PerfSeverity', name: 'severity' },
    { class: 'String', name: 'category' },
    { class: 'String', name: 'metric', documentation: 'the report metric this concerns (blank for structural issues)' },
    { class: 'String', name: 'detail' }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow.perf',
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
