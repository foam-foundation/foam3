/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.graphics',
  name: 'SceneLayer',
  extends: 'foam.graphics.CView',

  documentation: 'Transparent grouping node inside a Scene. Paints nothing of its own and is never a hit target.',

  methods: [
    function hitTest(p) { return false; },
    function paintSelf(x) {}
  ]
});


foam.CLASS({
  package: 'foam.graphics',
  name: 'Scene',
  extends: 'foam.graphics.CView',

  documentation: `
    Root CView of a pannable, zoomable canvas. Owns the camera (x, y, zoom),
    the viewport size (viewWidth, viewHeight, kept in sync by the owner), and
    ordered layers. Hit-testing walks the layers topmost first so an overlay
    never swallows a click meant for the content beneath it.
  `,

  requires: [
    'foam.graphics.CViewTheme',
    'foam.graphics.Point',
    'foam.graphics.SceneLayer'
  ],

  constants: {
    DEFAULT_FIT_PAD: 40,
    MAX_FIT_ZOOM:    1      // fit() never enlarges content past its natural size
  },

  properties: [
    {
      class: 'Float',
      name: 'zoom',
      value: 1,
      documentation: 'Scene units to CSS px. Writing it also writes scaleX and scaleY so CView paints and hit-tests through it.',
      postSet: function(_, z) { this.scaleX = z; this.scaleY = z; }
    },
    { class: 'Float', name: 'minZoom', value: 0.15 },
    { class: 'Float', name: 'maxZoom', value: 4 },
    {
      class: 'Float',
      name: 'viewWidth',
      documentation: 'CSS-px width of the hosting canvas; the owner keeps it in sync (ResizeObserver on the host element).'
    },
    { class: 'Float', name: 'viewHeight' },
    {
      name: 'theme',
      documentation: 'A foam.graphics.CViewTheme; only its background is used by the scene itself.',
      factory: function() { return this.CViewTheme.create(); }
    },
    {
      name: 'layers',
      documentation: 'SceneLayers in paint order (first is painted first, so it is the bottom).',
      factory: function() { return []; }
    },
    {
      name: 'measure',
      documentation: 'function(text, font) -> width in px. Defaults to the canvas context on first paint; tests inject an estimate.',
      factory: function() {
        var self = this;
        // Lazy: the canvas context does not exist until the scene is painted once.
        return function(text, font) {
          var ctx = self.canvas && self.canvas.context;
          // TextUtil is a LIB (not a class), so it is referenced directly rather than through requires.
          if ( ! ctx ) return foam.graphics.TextUtil.estimateMeasurer(7)(text, font);
          self.measure = foam.graphics.TextUtil.canvasMeasurer(ctx);
          return self.measure(text, font);
        };
      }
    }
  ],

  methods: [
    function addLayer(layer) {
      /** Appends a layer on top of the existing ones. */
      this.layers.push(layer);
      this.add(layer);
      return layer;
    },

    function measureText(text, font) {
      return this.measure(text, font);
    },

    function toE(args, X) {
      /**
       * CView.toE() binds the canvas size to the content size (x + width*scaleX),
       * which is wrong for a viewport: bind it to viewWidth/viewHeight instead.
       */
      return this.Canvas.create({
        cview: this,
        width$:  this.viewWidth$,
        height$: this.viewHeight$
      }, X);
    },

    function toSceneFromView(vx, vy) {
      /** Viewport (canvas-relative CSS px) -> scene coordinates. */
      return { x: ( vx - this.x ) / this.zoom, y: ( vy - this.y ) / this.zoom };
    },

    function toScene(clientX, clientY) {
      /** Pointer-event client coordinates -> scene coordinates. Needs the canvas element. */
      var r = this.canvas.el_().getBoundingClientRect();
      return this.toSceneFromView(clientX - r.left, clientY - r.top);
    },

    function hitAtView(vx, vy) {
      /** Deepest non-layer CView under a viewport point, checking the topmost layer first. */
      for ( var i = this.layers.length - 1 ; i >= 0 ; i-- ) {
        var p = this.Point.create({ x: vx, y: vy, w: 1 });
        this.parentToLocalCoordinates(p);           // apply the camera once, then descend into the layer
        var hit = this.layers[i].findFirstChildAt(p);
        if ( hit && hit !== this.layers[i] ) return hit;
      }
      return undefined;
    },

    function hitAt(clientX, clientY) {
      var r = this.canvas.el_().getBoundingClientRect();
      return this.hitAtView(clientX - r.left, clientY - r.top);
    },

    function hitTest(p) { return false; },      // the scene itself is never "what was clicked"

    function panBy(dx, dy) {
      this.x += dx;
      this.y += dy;
    },

    function zoomAt(vx, vy, factor) {
      /** Multiplies zoom by factor while keeping the scene point under viewport point (vx, vy) fixed. */
      var z2 = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * factor));
      this.x = vx - ( vx - this.x ) * z2 / this.zoom;
      this.y = vy - ( vy - this.y ) * z2 / this.zoom;
      this.zoom = z2;
    },

    function centerOn(sx, sy, z) {
      /** Centres the viewport on scene point (sx, sy) at zoom z (clamped). */
      this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, z));
      this.x = this.viewWidth  / 2 - sx * this.zoom;
      this.y = this.viewHeight / 2 - sy * this.zoom;
    },

    function fit(bounds, pad) {
      /** Frames bounds ({x, y, width, height} in scene units), never enlarging past MAX_FIT_ZOOM. */
      if ( pad === undefined ) pad = this.DEFAULT_FIT_PAD;
      if ( ! this.viewWidth || ! this.viewHeight || ! bounds || ! bounds.width || ! bounds.height ) return;
      var raw = Math.min(( this.viewWidth - 2 * pad ) / bounds.width, ( this.viewHeight - 2 * pad ) / bounds.height);
      var z   = Math.max(this.minZoom, Math.min(raw, this.MAX_FIT_ZOOM));
      this.centerOn(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, z);
    },

    function paintSelf(ctx) {
      /** Optional background fill covering the viewport, painted in device space before the camera transform. */
      var bg = this.theme.background;
      if ( ! bg ) return;
      var dpr = this.canvas ? this.canvas.devicePixelRatio : 1;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, this.viewWidth * dpr, this.viewHeight * dpr);
      ctx.restore();
    }
  ]
});
