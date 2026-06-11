/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.test',
  name: 'PerfCaptureTest',
  extends: 'foam.core.test.JSTest',

  documentation: 'Tests PerfSnapshot.capture feature detection and PerfReport.finish derived metrics.',

  methods: [
    async function runTest(x) {
      var Snapshot = foam.core.reflow.PerfSnapshot;
      var Report   = foam.core.reflow.PerfReport;

      // --- Full-featured (Chrome-like) environment ---
      var chromePerf = {
        now: function() { return 1234.5; },
        memory: { usedJSHeapSize: 1000, totalJSHeapSize: 2000, jsHeapSizeLimit: 4000 },
        getEntriesByType: function(type) {
          if ( type === 'navigation' ) return [ { domContentLoadedEventEnd: 300, loadEventEnd: 500 } ];
          if ( type === 'resource' )   return [ { transferSize: 100 }, { transferSize: 250 } ];
          return [];
        }
      };
      var chromeNav = {
        userAgent: 'TestChrome',
        hardwareConcurrency: 8,
        deviceMemory: 16,
        connection: { effectiveType: '4g', downlink: 10.5, rtt: 50 }
      };

      var s = Snapshot.create();
      try {
        s.capture(chromePerf, chromeNav);
        x.test(s.now === 1234.5,                 'capture sets now from performance.now()');
        x.test(s.usedJSHeapSize === 1000,        'capture reads performance.memory.usedJSHeapSize');
        x.test(s.jsHeapSizeLimit === 4000,       'capture reads performance.memory.jsHeapSizeLimit');
        x.test(s.hardwareConcurrency === 8,      'capture reads navigator.hardwareConcurrency');
        x.test(s.deviceMemoryGB === 16,          'capture reads navigator.deviceMemory');
        x.test(s.connectionType === '4g',        'capture reads navigator.connection.effectiveType');
        x.test(s.downlinkMbps === 10.5,          'capture reads navigator.connection.downlink');
        x.test(s.rttMs === 50,                   'capture reads navigator.connection.rtt');
        x.test(s.resourceCount === 2,            'capture counts resource timing entries');
        x.test(s.resourceTransferBytes === 350,  'capture sums resource transferSize');
        x.test(s.domContentLoadedMs === 300,     'capture reads navigation timing DCL');
        x.test(s.loadEventMs === 500,            'capture reads navigation timing loadEventEnd');
        x.test(s.userAgent === 'TestChrome',     'capture reads navigator.userAgent');
      } catch (e) {
        x.test(false, 'capture(full env) threw: ' + e.message);
      }

      // --- Minimal (Safari/Firefox-like) environment ---
      var minPerf = {
        now: function() { return 10; },
        getEntriesByType: function() { return []; }
      };
      var minNav = { userAgent: 'TestSafari', hardwareConcurrency: 4 };

      var s2 = Snapshot.create();
      try {
        s2.capture(minPerf, minNav);
        x.test(s2.usedJSHeapSize === 0,    'missing performance.memory leaves heap fields 0');
        x.test(s2.connectionType === '',   'missing navigator.connection leaves connectionType empty');
        x.test(s2.deviceMemoryGB === 0,    'missing navigator.deviceMemory leaves deviceMemoryGB 0');
        x.test(s2.resourceCount === 0,     'empty resource entries give resourceCount 0');
      } catch (e) {
        x.test(false, 'capture(minimal env) threw: ' + e.message);
      }

      // --- PerfReport.finish derived metrics ---
      var start = Snapshot.create({ now: 1000, usedJSHeapSize: 1000, resourceCount: 2, resourceTransferBytes: 350 });
      var end   = Snapshot.create({ now: 3000, usedJSHeapSize: 1500, resourceCount: 5, resourceTransferBytes: 950 });
      var r = Report.create({ startSnapshot: start, endSnapshot: end });
      try {
        // 120 frames over 2000ms, worst frame 100ms, 3 long tasks totalling 240ms
        r.finish({ frameCount: 120, frameTotalMs: 2000, worstFrameMs: 100, longTaskCount: 3, longTaskTotalMs: 240 });
        x.test(r.elapsedMs === 2000,             'finish computes elapsedMs = end.now - start.now');
        x.test(r.heapDeltaBytes === 500,         'finish computes heap delta');
        x.test(r.resourceDeltaCount === 3,       'finish computes resource count delta');
        x.test(r.resourceDeltaBytes === 600,     'finish computes resource bytes delta');
        x.test(r.avgFps === 60,                  'finish computes avgFps = 1000 * frames / frameTotalMs');
        x.test(r.minFps === 10,                  'finish computes minFps = 1000 / worstFrameMs');
        x.test(r.longTaskCount === 3,            'finish stores longTaskCount');
        x.test(r.longTaskTotalMs === 240,        'finish stores longTaskTotalMs');
      } catch (e) {
        x.test(false, 'finish threw: ' + e.message);
      }

      // --- finish with zero frames must not divide by zero ---
      var r2 = Report.create({ startSnapshot: Snapshot.create({now: 0}), endSnapshot: Snapshot.create({now: 100}) });
      try {
        r2.finish({ frameCount: 0, frameTotalMs: 0, worstFrameMs: 0, longTaskCount: 0, longTaskTotalMs: 0 });
        x.test(r2.avgFps === 0, 'zero frames gives avgFps 0 (no NaN/Infinity)');
        x.test(r2.minFps === 0, 'zero worst frame gives minFps 0 (no Infinity)');
      } catch (e) {
        x.test(false, 'finish(zero frames) threw: ' + e.message);
      }
    }
  ]
});
