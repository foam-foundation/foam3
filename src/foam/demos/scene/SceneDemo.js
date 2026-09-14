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
    BOX_COUNT: 12,
    BOX_W: 120, BOX_H: 44, GAP: 24,
    CORNER: 14,                 // side of the amber hit square in each box's top-right corner
    ZOOM_STEP: 1.1,
    PULSE_TICKS: 60
  },

  properties: [
    { name: 'scene' },
    { name: 'tip' },
    { class: 'String', name: 'status', value: 'drag to pan, wheel to zoom, hover a box, click the small square' },
    { name: 'drag_' },
    { class: 'Boolean', name: 'cacheBoxes', documentation: 'When true every box is cache()d; used to compare frame cost with the pulse button.' }
  ],

  methods: [
    function pulse() {
      /** Toggles one box's border 60 times at ~16 ms so a DevTools Performance recording shows the per-frame paint cost. */
      var b = this.scene.layers[0].children[5], n = 0, on = false, self = this;
      var t = setInterval(function() { on = ! on; b.border = on ? '#D55E00' : '#0072B2'; if ( ++n >= self.PULSE_TICKS ) clearInterval(t); }, 16);
    },

    function init() {
      this.SUPER();
      var theme = this.CViewTheme.create({
        background: '#fafafa',
        colors: { boxFill: '#eaf3fb', boxBorder: '#0072B2', region: '#E69F00', tooltipBg: '#fff8e0', tooltipBorder: '#999', tooltipText: '#222' },
        fonts:  { tooltip: '12px sans-serif' }
      });
      this.scene = this.Scene.create({ viewWidth: 900, viewHeight: 500, theme: theme });
      var content = this.scene.addLayer(this.SceneLayer.create());
      var overlay = this.scene.addLayer(this.SceneLayer.create());

      // A grid of boxes, each with a small hit region (and a visible amber square) in its top-right corner.
      for ( var i = 0 ; i < this.BOX_COUNT ; i++ ) {
        var box = this.Box.create({
          x: ( i % 4 ) * ( this.BOX_W + this.GAP ), y: Math.floor(i / 4) * ( this.BOX_H + this.GAP ),
          width: this.BOX_W, height: this.BOX_H, color: theme.resolve('boxFill'), border: theme.resolve('boxBorder'), cornerRadius: 6
        });
        var cx = this.BOX_W - this.CORNER - 4, cy = 4;
        box.add(this.HitRegion.create({ x: cx, y: cy, width: this.CORNER, height: this.CORNER, role: 'corner-' + i }));
        box.add(this.Box.create({ x: cx, y: cy, width: this.CORNER, height: this.CORNER, color: theme.resolve('region'), border: null }));
        box.demoIndex = i;
        content.add(box);
      }
      this.tip = this.TooltipCView.create({ theme: theme, measure: this.scene.measure, alpha: 0 });
      overlay.add(this.tip);
      this.scene.panBy(this.GAP, this.GAP);      // start with a margin so the first row is not glued to the edge
    },

    function render() {
      var self = this, s = this.scene;
      this.start('div').add(this.status$).end();
      this.start('div').style({ margin: '6px 0' })
        .start('label')
          .start('input').attrs({ type: 'checkbox' })
            .on('change', function(e) { self.cacheBoxes = e.target.checked; s.layers[0].children.forEach(function(b) { self.cacheBoxes ? b.cache() : b.uncache(); }); })
          .end().add(' cache boxes')
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
