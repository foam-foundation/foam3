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
