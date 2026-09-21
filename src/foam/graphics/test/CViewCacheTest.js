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
        drawImage: function() { calls.drawImage++; calls.lastBlit = Array.prototype.slice.call(arguments, 1); },
        globalAlpha: 1, lineWidth: 1, fillStyle: '', strokeStyle: '', font: ''
      };
    },

    function scaledContext(calls, scale) {
      /** fakeContext plus getTransform, reporting a uniform scale the way a zoomed real context does. */
      var ctx = this.fakeContext(calls);
      ctx.scaleNow = scale;
      ctx.getTransform = function() { return { a: ctx.scaleNow, b: 0, c: 0, d: ctx.scaleNow, e: 0, f: 0 }; };
      return ctx;
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
        x.test(group.cacheX_ === 300 && group.cacheY_ === 120 && group.cacheW_ === 40 + 2 * pad && group.cacheH_ === 20 + 2 * pad, 'a sizeless group caches the extent of its children (not from its origin) plus edge padding on every side');
        group.paint(ctx);
        x.test(far.paints === 1,            'the child inside the group bitmap is painted once, then blitted');

        // A child left of / above the origin extends the bitmap that way; the blit starts at the extent's corner.
        var wide = this.Box.create({ width: 0, height: 0, border: null });
        wide.add(this.CountingBox.create({ x: -50, y: -20, width: 40, height: 20 }), this.CountingBox.create({ x: 100, y: 0, width: 40, height: 20 }));
        wide.cache();
        wide.paint(ctx);
        x.test(wide.cacheX_ === -50 && wide.cacheY_ === -20 && wide.cacheW_ === 190 + 2 * pad && wide.cacheH_ === 40 + 2 * pad, 'a negative child extent widens the bitmap left/up');
        wide.paint(ctx);
        x.test(calls.lastBlit[0] === -50 - pad && calls.lastBlit[1] === -20 - pad, 'the bitmap is blitted from the extent corner, not the origin');

        // The bitmap is sized from the context's scale alone: paint() already put this node's scaleX on the context.
        var big = this.Box.create({ width: 100, height: 100, scaleX: 2, scaleY: 2 });
        big.cache();
        big.paint(this.scaledContext(calls, 2));
        x.test(big.cacheCanvas_.width === Math.ceil((100 + 2 * pad) * 2), 'bitmap pixels = extent x context scale (scaleX is not applied twice)');

        // Zoom drift: one 1.1 step either way reuses the bitmap; three steps re-render. Same threshold in and out.
        var zctx = this.scaledContext(calls, 1);
        var zoomed = this.Box.create({ width: 100, height: 100 }), zchild = this.CountingBox.create({ width: 10, height: 10 });
        zoomed.add(zchild);
        zoomed.cache();
        zoomed.paint(zctx);
        zctx.scaleNow = 1.1;   zoomed.paint(zctx);
        zctx.scaleNow = 1.21;  zoomed.paint(zctx);
        x.test(zchild.paints === 1,         'zooming in by 1.1 twice reuses the bitmap');
        zctx.scaleNow = 1.331; zoomed.paint(zctx);
        x.test(zchild.paints === 2,         'a third 1.1 step in re-renders');
        zctx.scaleNow = 1.331 / 1.21; zoomed.paint(zctx);
        x.test(zchild.paints === 2,         'zooming out by 1.1 twice reuses the bitmap');
        zctx.scaleNow = 1;     zoomed.paint(zctx);
        x.test(zchild.paints === 3,         'a third 1.1 step out re-renders');

        // Structural changes: add and remove both drop the bitmap and re-subscribe.
        var tree = this.Box.create({ width: 100, height: 100 }), kept = this.CountingBox.create({ width: 10, height: 10 }), gone = this.CountingBox.create({ width: 10, height: 10 });
        tree.add(kept); tree.add(gone);
        tree.cache();
        tree.paint(ctx);
        var late = this.CountingBox.create({ width: 10, height: 10 });
        tree.add(late);
        x.test(! tree.cacheCanvas_,         'add() under a cached node drops its bitmap');
        tree.paint(ctx);
        late.width = 20;
        x.test(! tree.cacheCanvas_,         'a child added after cache() is watched');
        tree.paint(ctx);
        var keptSubs = 0, keptSub = kept.propertyChange.sub;
        kept.propertyChange.sub = function() { keptSubs++; return keptSub.apply(this, arguments); };
        tree.remove(gone);
        x.test(! tree.cacheCanvas_,         'remove() under a cached node drops its bitmap');
        x.test(keptSubs === 0,              'remove() unsubscribes only the removed subtree; siblings keep their subscription');
        tree.paint(ctx);
        gone.width = 20;
        x.test(!! tree.cacheCanvas_,        'a removed child no longer invalidates the bitmap');
        kept.width = 20;
        x.test(! tree.cacheCanvas_,         'a sibling of the removed child still invalidates the bitmap');

        // Removing every child one at a time (SceneDemo.buildGrid) costs one walk per child, not one per remaining child.
        var many = this.Box.create({ width: 100, height: 100 }), subs = 0;
        for ( var i = 0 ; i < 50 ; i++ ) many.add(this.CountingBox.create({ width: 1, height: 1 }));
        many.cache();
        many.children.forEach(function(c) { var s = c.propertyChange.sub; c.propertyChange.sub = function() { subs++; return s.apply(this, arguments); }; });
        many.children.slice().forEach(function(c) { many.remove(c); });
        x.test(subs === 0,                  'removing 50 children singly re-subscribes nothing (saw ' + subs + ' re-subscriptions)');
      } finally {
        if ( hadOffscreen ) globalThis.OffscreenCanvas = saved; else delete globalThis.OffscreenCanvas;
      }
    }
  ]
});
