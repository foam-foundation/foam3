/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.graphics.test',
  name: 'CountingBox',
  extends: 'foam.graphics.Box',
  flags: [ 'js' ],   // Box has no Java side; keep this helper out of the Java build the test pom triggers

  documentation: 'A Box that counts how many times it is painted.',

  properties: [ { class: 'Int', name: 'paints' } ],

  methods: [ function paintSelf(x) { this.paints++; this.SUPER(x); } ]
});


foam.CLASS({
  package: 'foam.graphics.test',
  name: 'CViewCacheTest',
  extends: 'foam.core.test.JSTest',

  requires: [ 'foam.graphics.Box', 'foam.graphics.test.CountingBox' ],

  documentation: 'A cached CView paints its children once, reuses the bitmap, and repaints only after invalidateCache() or a property change.',

  methods: [
    function fakeContext(calls) {
      /** The subset of CanvasRenderingContext2D that CView.paint and the cache blit touch. */
      var noop = function() {};
      return {
        save: noop, restore: noop, transform: noop, setTransform: noop, scale: noop, translate: noop,
        beginPath: noop, rect: noop, stroke: noop, fill: noop, clip: noop, setLineDash: noop, roundRect: noop,
        drawImage: function() { calls.drawImage++; },
        globalAlpha: 1, lineWidth: 1, fillStyle: '', strokeStyle: '', font: ''
      };
    },

    async function runTest(x) {
      var self = this, calls = { drawImage: 0 };
      // Headless: give renderCache_ a bitmap to draw into (the shim is removed in finally).
      var hadOffscreen = typeof OffscreenCanvas !== 'undefined', saved = hadOffscreen ? OffscreenCanvas : undefined;
      globalThis.OffscreenCanvas = function(w, h) { this.width = w; this.height = h; this.getContext = function() { return self.fakeContext(calls); }; };
      try {
        var parent = this.Box.create({ width: 100, height: 100 });
        var child  = this.CountingBox.create({ width: 10, height: 10 });
        parent.add(child);
        var ctx = this.fakeContext(calls);

        parent.paint(ctx); parent.paint(ctx);
        x.test(child.paints === 2, 'uncached: the child paints on every parent paint');

        parent.cache();
        parent.paint(ctx);
        var afterFirst = child.paints;
        parent.paint(ctx); parent.paint(ctx);
        x.test(afterFirst === 3,            'cached: the first paint renders the subtree once (into the bitmap)');
        x.test(child.paints === 3,          'cached: later paints reuse the bitmap, the child is not painted');
        x.test(calls.drawImage >= 2,        'cached: later paints blit the bitmap');

        child.width = 20;                   // a descendant change invalidates the parent bitmap
        parent.paint(ctx);
        x.test(child.paints === 4,          'a descendant property change re-renders the bitmap once');

        parent.invalidateCache();
        parent.paint(ctx);
        x.test(child.paints === 5,          'invalidateCache() forces one re-render');

        parent.uncache();
        parent.paint(ctx); parent.paint(ctx);
        x.test(child.paints === 7,          'uncache(): live painting again');

        // A sizeless group (like a SceneLayer) sizes its bitmap from its children instead of coming out 1px.
        var group = this.Box.create({ width: 0, height: 0, border: null });
        var far   = this.CountingBox.create({ x: 300, y: 120, width: 40, height: 20 });
        group.add(far);
        group.cache();
        group.paint(ctx);
        var pad = foam.graphics.CView.CACHE_PAD;
        x.test(group.cacheW_ === 340 + 2 * pad && group.cacheH_ === 140 + 2 * pad, 'a sizeless group caches the extent of its children plus edge padding on every side');
        group.paint(ctx);
        x.test(far.paints === 1,            'the child inside the group bitmap is painted once, then blitted');
      } finally {
        if ( hadOffscreen ) globalThis.OffscreenCanvas = saved; else delete globalThis.OffscreenCanvas;
      }
    }
  ]
});
