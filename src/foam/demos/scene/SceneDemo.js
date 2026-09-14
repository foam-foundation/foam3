/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.demos.scene',
  name: 'SceneDemo',
  extends: 'foam.u2.View',

  documentation: 'Pan (drag), zoom (wheel), hover (tooltip), click (hit region role) on a Scene with two layers.',

  requires: [
    'foam.graphics.Box',
    'foam.graphics.CViewTheme',
    'foam.graphics.HitRegion',
    'foam.graphics.Scene',
    'foam.graphics.SceneLayer',
    'foam.graphics.TooltipCView'
  ],

  constants: {
    GRID_SMALL: { count: 12,  cols: 4,  w: 120, h: 44, gap: 24 },
    GRID_LARGE: { count: 600, cols: 30, w: 24,  h: 16, gap: 6 },   // the rail-viewer shape: many static pieces, one moving highlight
    CORNER: 14,                 // side of the amber hit square in each box's top-right corner
    ZOOM_STEP: 1.1,
    PULSE_TICKS: 60
  },

  properties: [
    { name: 'scene' },
    { name: 'tip' },
    { class: 'String', name: 'status', value: 'drag to pan, wheel to zoom, hover a box, click the small square' },
    { name: 'drag_' },
    { class: 'Boolean', name: 'cacheBoxes', documentation: 'When true the whole content layer is cache()d as one bitmap; the pulsing box lives in the overlay layer, outside it.' },
    { class: 'Boolean', name: 'large', documentation: '600 small boxes instead of 12 big ones.' },
    { name: 'content' },
    { name: 'overlay' },
    { name: 'pulseBox' }
  ],

  methods: [
    function pulse() {
      /**
       * Toggles one box's border 60 times at ~16 ms, timing every canvas repaint, then writes the
       * average repaint cost to the status line so caching on/off can be compared without DevTools.
       */
      // Time scene.paint (the CView method the Canvas listener calls each frame); canvas.paint itself is a
      // framed listener already bound into the invalidated subscription, so wrapping it would never run.
      var self = this, scene = this.scene, b = this.pulseBox;
      var n = 0, on = false, paints = 0, total = 0, orig = scene.paint;
      scene.paint = function() { var t0 = performance.now(); orig.apply(scene, arguments); total += performance.now() - t0; paints++; };
      this.status = 'pulsing…';
      var t = setInterval(function() {
        on = ! on; b.border = on ? '#D55E00' : '#0072B2';
        if ( ++n < self.PULSE_TICKS ) return;
        clearInterval(t);
        delete scene.paint;                      // drop the instance override, back to the prototype method
        self.status = 'pulse done: ' + paints + ' repaints, avg ' + ( paints ? ( total / paints ).toFixed(2) : '?' ) + ' ms each, ' + ( self.large ? '600' : '12' ) + ' boxes, content cache ' + ( self.cacheBoxes ? 'ON' : 'OFF' );
      }, 16);
    },

    function init() {
      this.SUPER();
      var theme = this.CViewTheme.create({
        background: '#fafafa',
        colors: { boxFill: '#eaf3fb', boxBorder: '#0072B2', region: '#E69F00', tooltipBg: '#fff8e0', tooltipBorder: '#999', tooltipText: '#222' },
        fonts:  { tooltip: '12px sans-serif' }
      });
      this.theme_ = theme;
      this.scene = this.Scene.create({ viewWidth: 900, viewHeight: 500, theme: theme });
      this.content = this.scene.addLayer(this.SceneLayer.create());
      this.overlay = this.scene.addLayer(this.SceneLayer.create());
      this.tip = this.TooltipCView.create({ theme: theme, measure: this.scene.measure, alpha: 0 });
      this.buildGrid();
      this.scene.panBy(this.GRID_SMALL.gap, this.GRID_SMALL.gap);      // start with a margin so the first row is not glued to the edge
    },

    function buildGrid() {
      /** Fills the content layer with the chosen grid; the pulse box goes to the overlay so it sits outside any content cache. */
      var g = this.large ? this.GRID_LARGE : this.GRID_SMALL, theme = this.theme_;
      this.content.children.slice().forEach(function(c) { this.content.remove(c); }.bind(this));
      this.overlay.children.slice().forEach(function(c) { this.overlay.remove(c); }.bind(this));
      for ( var i = 0 ; i < g.count ; i++ ) {
        var box = this.Box.create({
          x: ( i % g.cols ) * ( g.w + g.gap ), y: Math.floor(i / g.cols) * ( g.h + g.gap ),
          width: g.w, height: g.h, color: theme.resolve('boxFill'), border: theme.resolve('boxBorder'), cornerRadius: 4
        });
        if ( ! this.large ) {
          var cx = g.w - this.CORNER - 4, cy = 4;
          box.add(this.HitRegion.create({ x: cx, y: cy, width: this.CORNER, height: this.CORNER, role: 'corner-' + i }));
          box.add(this.Box.create({ x: cx, y: cy, width: this.CORNER, height: this.CORNER, color: theme.resolve('region'), border: null }));
        }
        box.demoIndex = i;
        // box 5 is the one that pulses: it lives in the overlay layer so a cached content layer never has to re-render for it
        ( i === 5 ? this.overlay : this.content ).add(box);
        if ( i === 5 ) this.pulseBox = box;
      }
      this.overlay.add(this.tip);
      if ( this.cacheBoxes ) this.content.cache();
    },

    function render() {
      var self = this, s = this.scene;
      this.start('div').add(this.status$).end();
      this.start('div').style({ margin: '6px 0' })
        .start('label')
          .start('input').attrs({ type: 'checkbox' })
            .on('change', function(e) { self.cacheBoxes = e.target.checked; self.cacheBoxes ? self.content.cache() : self.content.uncache(); })
          .end().add(' cache content layer (one bitmap)')
        .end()
        .start('label').style({ 'margin-left': '12px' })
          .start('input').attrs({ type: 'checkbox' })
            .on('change', function(e) { self.large = e.target.checked; self.buildGrid(); })
          .end().add(' 600 boxes')
        .end()
        .start('button').style({ 'margin-left': '12px' }).add('pulse one box').on('click', function() { self.pulse(); }).end()
      .end();
      this
        .start(s)   // Scene.toE() binds the canvas to viewWidth/viewHeight
          .on('pointerdown', function(e) { self.drag_ = { x: e.clientX, y: e.clientY }; })
          .on('pointermove', function(e) {
            if ( self.drag_ ) { s.panBy(e.clientX - self.drag_.x, e.clientY - self.drag_.y); self.drag_ = { x: e.clientX, y: e.clientY }; return; }
            var hit = s.hitAt(e.clientX, e.clientY);
            var box = hit && ( hit.demoIndex !== undefined ? hit : hit.parent );
            if ( box && box.demoIndex !== undefined ) {
              var p = s.toScene(e.clientX, e.clientY);
              self.tip.text = 'box ' + box.demoIndex; self.tip.layout(); self.tip.x = p.x + 12; self.tip.y = p.y + 12; self.tip.alpha = 1;
            } else {
              self.tip.alpha = 0;
            }
          })
          .on('pointerup', function() { self.drag_ = null; })
          .on('wheel', function(e) {
            e.preventDefault();
            var r = e.currentTarget.getBoundingClientRect();
            s.zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? self.ZOOM_STEP : 1 / self.ZOOM_STEP);
          })
          .on('click', function(e) {
            var hit = s.hitAt(e.clientX, e.clientY);
            self.status = hit && hit.role ? 'clicked region: ' + hit.role : hit ? 'clicked a box' : 'clicked empty space';
          })
        .end();
    }
  ]
});
