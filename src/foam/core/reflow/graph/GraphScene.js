/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.graph',
  name: 'GraphLayer',
  extends: 'foam.graphics.CView',

  documentation: `
    A transparent grouping layer inside a GraphScene. It paints nothing of
    its own and is never itself a hit target: hitTest() always returns
    false, so CView.findFirstChildAt() falls straight through to whatever
    it is grouping (containers, edges, nodes, or overlay elements).
  `,

  methods: [
    function hitTest(p) { return false; }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow.graph',
  name: 'GraphScene',
  extends: 'foam.graphics.CView',

  documentation: `
    Root CView for the canvas-based Reflow graph. Owns pan (the inherited
    x/y) and zoom (scaleX/scaleY, driven off the 'zoom' property), and four
    paint-order layers -- containers, edges, nodes, overlay -- that
    FlowGraphView populates and mutates directly.

    Hit-testing goes through CView.findFirstChildAt(), which checks
    children before testing this CView itself; hitTest() always returns
    false here so the scene is never the hit result, only its children.
  `,

  requires: [ 'foam.core.reflow.graph.GraphLayer' ],

  properties: [
    {
      class: 'Float',
      name: 'zoom',
      value: 1,
      documentation: 'Drives scaleX/scaleY (inherited from CView) so the whole scene paints scaled.',
      postSet: function(_, z) {
        this.scaleX = z;
        this.scaleY = z;
      }
    },
    { class: 'Float', name: 'minZoom', value: 0.15 },
    { class: 'Float', name: 'maxZoom', value: 4 },
    { name: 'theme' },
    {
      class: 'Int',
      name: 'viewWidth',
      documentation: 'CSS-px width of the hosting canvas, kept in sync by the owner (a ResizeObserver on the host element).'
    },
    {
      class: 'Int',
      name: 'viewHeight',
      documentation: 'CSS-px height of the hosting canvas, kept in sync by the owner.'
    },
    { name: 'containers', factory: function() { return this.GraphLayer.create(); } },
    { name: 'edges',      factory: function() { return this.GraphLayer.create(); } },
    { name: 'nodes',      factory: function() { return this.GraphLayer.create(); } },
    { name: 'overlay',    factory: function() { return this.GraphLayer.create(); } }
  ],

  methods: [
    function init() {
      this.SUPER();
      this.add(this.containers, this.edges, this.nodes, this.overlay);
    },

    function hitTest(p) {
      /** The scene itself is never a hit; only its children can be. */
      return false;
    },
    function findFirstChildAt(p) {
      /**
       * Topmost first: CView walks children in paint order, which would let
       * an expanded container's box swallow the click meant for a node drawn
       * over it. Test nodes, then edges, then containers; the overlay
       * (tooltip, marquee) is never a hit target.
       */
      this.parentToLocalCoordinates(p);
      var layers = [ this.nodes, this.edges, this.containers ];
      for ( var i = 0 ; i < layers.length ; i++ ) {
        var p2 = foam.graphics.Point.create({ x: p.x, y: p.y, w: p.w });
        var c  = layers[i].findFirstChildAt(p2);
        if ( c ) return c;
      }
    },

    function toE(args, X) {
      /**
       * Overrides CView.toE(): its default binds the Canvas element's CSS
       * width/height to (x + width*scaleX), which assumes the CView sizes
       * the canvas to its own content. This scene is sized by its owner
       * instead (a ResizeObserver on the host element driving viewWidth/
       * viewHeight), so bind the Canvas directly to those.
       */
      return this.Canvas.create({
        cview: this,
        width$: this.viewWidth$,
        height$: this.viewHeight$
      }, X);
    },

    function toScene(clientX, clientY) {
      /** Pointer-event client coordinates -> scene coordinates. */
      var rect = this.canvas.el_().getBoundingClientRect();
      return {
        x: ( clientX - rect.left - this.x ) / this.zoom,
        y: ( clientY - rect.top  - this.y ) / this.zoom
      };
    },

    function panBy(dx, dy) {
      /** dx, dy: viewport (CSS-px) deltas. */
      this.x += dx;
      this.y += dy;
    },

    function zoomAt(vx, vy, factor) {
      /** vx, vy: viewport (canvas-relative) coordinates to keep fixed under the pointer. */
      var z2 = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * factor));
      this.x = vx - ( vx - this.x ) * z2 / this.zoom;
      this.y = vy - ( vy - this.y ) * z2 / this.zoom;
      this.zoom = z2;
    },

    function fit(bounds, pad) {
      /** Frames `bounds` (scene-space {x,y,width,height}), capped so a small graph is not blown up past its natural size. */
      pad = pad === undefined ? 40 : pad;
      if ( ! this.viewWidth || ! this.viewHeight || ! bounds || ! bounds.width || ! bounds.height ) return;
      var raw = Math.min(
        ( this.viewWidth  - 2 * pad ) / bounds.width,
        ( this.viewHeight - 2 * pad ) / bounds.height
      );
      var z = Math.max(this.minZoom, Math.min(raw, 1));
      this.centerOn(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, z);
    },

    function centerOn(sx, sy, z) {
      /** Centres the viewport on scene point (sx, sy) at zoom z. */
      this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, z));
      this.x = this.viewWidth  / 2 - sx * this.zoom;
      this.y = this.viewHeight / 2 - sy * this.zoom;
    },

    function hitAt(clientX, clientY) {
      /** Pointer-event client coordinates -> deepest CView under the pointer, or undefined. */
      var rect = this.canvas.el_().getBoundingClientRect();
      var p = foam.graphics.Point.create({
        x: clientX - rect.left,
        y: clientY - rect.top,
        w: 1
      });
      return this.findFirstChildAt(p);
    },

    function paintSelf(ctx) {
      // Runs after this CView's own transform (pan + zoom) is applied
      // (CView.paint() calls doTransform() then paintSelf()), so ctx is
      // already in scene coordinates: derive the visible scene-space
      // rectangle from the viewport size and the current pan/zoom.
      var theme = this.theme;
      if ( ! theme ) return;

      var x0 = -this.x / this.zoom;
      var y0 = -this.y / this.zoom;
      var x1 = ( this.viewWidth  - this.x ) / this.zoom;
      var y1 = ( this.viewHeight - this.y ) / this.zoom;

      ctx.fillStyle = theme.colors.canvas;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

      if ( this.zoom < 0.4 ) return;

      var step = 24;
      ctx.fillStyle = theme.colors.gridDot;
      var startX = Math.floor(x0 / step) * step;
      var startY = Math.floor(y0 / step) * step;
      for ( var gx = startX ; gx < x1 ; gx += step ) {
        for ( var gy = startY ; gy < y1 ; gy += step ) {
          ctx.beginPath();
          ctx.arc(gx, gy, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  ]
});
