/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.rail',
  name: 'RailScene',
  extends: 'foam.u2.View',

  documentation: `
    The viewer's drawing surface, as DOM: a viewport div holding a world div
    whose CSS transform is the camera (x, y, zoom), one absolutely positioned
    <svg> per rule strip inside the world, and one HTML tooltip. The browser
    does hit-testing (pointer events land on the element's <g>), text
    rendering and scrolling; this class owns the camera maths, strip stacking,
    element lookup by walking its own tree (no registry), the trace-to-state
    mapping, the stylesheet generated from the theme, and viewport culling
    (strips outside the viewport are display:none).
  `,

  requires: [
    'foam.parse.rail.Outcome',
    'foam.parse.rail.RailStrip',
    'foam.parse.rail.RailSymRef',
    'foam.parse.rail.RailTheme',
    'foam.parse.rail.Tier'
  ],

  constants: {
    DEFAULT_FIT_PAD: 40,
    MAX_FIT_ZOOM:    1,        // fit never enlarges content past its natural size
    DRAG_THRESHOLD:  4,        // px of movement before a press counts as a drag, not a click
    ZOOM_RATE:       0.0015,   // zoom factor = e^(-deltaY * rate): one mouse notch (100) ≈ ×1.16, a pinch tick ≈ ×1.01
    ZOOM_MAX_DELTA:  100,      // one wheel event never zooms more than a mouse notch
    TIP_OFFSET:      14,       // tooltip sits this far right/below the pointer
    STRIP_MARGIN:    8,        // svg canvas around each strip so strokes at the edge are not clipped
    PULSE_MS:        220,
    TIP_VALUES_MAX:  8,        // values listed in the tooltip of a box that matched several times
    PAN_MS:          220
  },

  css: `
    ^ { position: absolute; inset: 0; }
    ^viewport { position: absolute; inset: 0; overflow: hidden; touch-action: none; cursor: grab; user-select: none; }
    ^viewport.dragging { cursor: grabbing; }
    ^world { position: absolute; left: 0; top: 0; transform-origin: 0 0; }
    ^world.animate { transition: transform 220ms ease-out; }
    ^strip { position: absolute; overflow: visible; }
    ^overlay { position: absolute; user-select: text; cursor: auto; }
    ^divider { position: absolute; left: 0; border-top: 1px dashed #777; }
    ^tip { position: absolute; z-index: 2; pointer-events: none; white-space: pre; padding: 4px 7px; border-radius: 4px;
           box-shadow: 0 2px 8px rgba(0,0,0,0.2); max-width: 60%; }
    ^tip[hidden] { display: none; }
    /* Element groups: hit targets take the pointer; composites and decorations let it through to the strip behind. */
    ^ [data-rail] { cursor: pointer; }
    ^ text { dominant-baseline: central; pointer-events: none; }
    ^ .emphasis-text { dominant-baseline: auto; }
    ^ path, ^ rect, ^ circle { pointer-events: visible; }
    ^ .track, ^ .branch, ^ .stub { fill: none; pointer-events: none; }
    ^ .flash { opacity: 0; }
    /* Value tags (A) and rule lanes (B) are toggles on the scene root. */
    ^ text.value, ^ text.lane { display: none; }
    ^.values text.value { display: inline; }
    ^.lanes  text.lane  { display: inline; }
    @keyframes rail-pulse { from { stroke-width: 4.5; } }   /* only a from-frame: it settles on the element's own stroke width */
    @keyframes rail-flash { from { opacity: 0.35; } to { opacity: 0; } }
    ^ .pulse > .box, ^ .pulse > .track, ^ .pulse > .gate { animation: rail-pulse 220ms ease-out; }
    ^ .pulse > .flash { animation: rail-flash 600ms ease-out; }
  `,

  properties: [
    { class: 'Float', name: 'x' },
    { class: 'Float', name: 'y' },
    { class: 'Float', name: 'zoom', value: 1 },
    { class: 'Float', name: 'minZoom', value: 0.15 },
    { class: 'Float', name: 'maxZoom', value: 4 },
    { class: 'Float', name: 'viewWidth',  documentation: 'Viewport size in CSS px; the owner keeps it in sync with the host element.' },
    { class: 'Float', name: 'viewHeight' },
    { name: 'theme', factory: function() { return this.RailTheme.create(); } },
    {
      name: 'measure',
      documentation: 'function(text, font) -> px. Browser: canvas measureText (SVG text uses the same fonts). Tests inject an estimate.',
      factory: function() {
        var ctx = typeof document !== 'undefined' && document.createElement ? document.createElement('canvas').getContext('2d') : null;
        return ctx ? foam.graphics.TextUtil.canvasMeasurer(ctx) : foam.graphics.TextUtil.estimateMeasurer(7);
      }
    },
    { name: 'strips', factory: function() { return []; } },
    { class: 'Boolean', name: 'showValues', value: true,  documentation: 'A: the text each box matched, under the box (×n when it matched several times).' },
    {
      class: 'Boolean', name: 'showLanes', value: false,
      documentation: 'B: every text a rule matched, in a row under its strip. Lane data is computed only while on.',
      postSet: function(_, on) { this.stackStrips(); if ( on && this.snapshot_ ) this.applyTrace(this.snapshot_); }
    },
    { name: 'snapshot_', documentation: 'The applied snapshot, for the tooltip\'s value list.' },
    { name: 'stackSub_' },
    { class: 'Float', name: 'dividerY_', value: -1, documentation: 'Scene y of the dashed divider before the unreachable block, or -1.' },
    {
      class: 'Boolean',
      name: 'motion',
      documentation: 'Change pulse, follow-pan, label flash. Off under prefers-reduced-motion; tests set false.',
      factory: function() {
        return typeof window !== 'undefined' && window.matchMedia ? ! window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;
      }
    },
    { class: 'Int', name: 'followMargin', value: 40, documentation: 'Viewport px kept clear around the element being followed.' },
    { name: 'highlighted_', factory: function() { return []; } },
    { name: 'onHit', documentation: 'function(element, event) the owner sets; called on a click that did not drag.' },
    { name: 'byId_',  factory: function() { return new Map(); }, documentation: 'data-rail id -> element, rebuilt with the strips.' },
    { class: 'Int', name: 'nextId_' },
    { name: 'world_' },
    { name: 'tip_' },
    { name: 'viewport_' },
    { name: 'stripEls_', factory: function() { return new Map(); }, documentation: 'strip -> its <svg> u2 element.' },
    { name: 'overlays_', factory: function() { return []; }, documentation: '[{ el, x, y }] u2 elements placed in the world at scene coordinates; they pan and zoom with the strips.' },
    { name: 'dividerEl_' },
    { name: 'drag_' },
    { name: 'cullReq_' },
    { name: 'animateTimer_' }
  ],

  methods: [
    function init() {
      this.SUPER();
      // Any camera or viewport change re-applies the transform and reconsiders which strips are visible.
      this.onDetach(foam.lang.ArraySlot.create({ slots: [ this.x$, this.y$, this.zoom$, this.viewWidth$, this.viewHeight$ ] }).sub(this.onCamera));
    },

    function render() {
      var self = this;
      this.addClass(this.myClass()).enableClass('values', this.showValues$).enableClass('lanes', this.showLanes$);
      this.start('style').add(this.cssText()).end();
      this.viewport_ = this.start('div').addClass(this.myClass('viewport'))
        .style({ background: this.theme.background })
        .on('pointerdown',  function(e) { self.onDown(e); })
        .on('pointermove',  function(e) { self.onMove(e); })
        .on('pointerup',    function(e) { self.onUp(e); })
        .on('pointercancel',function()  { self.drag_ = null; })
        .on('pointerleave', function()  { self.hideTooltip(); })
        .on('wheel',        function(e) { self.onWheel(e); })
        .on('dblclick',     function(e) { self.onDouble(e); });
      this.world_ = this.viewport_.start('div').addClass(this.myClass('world'));
      this.world_.end();
      this.tip_ = this.viewport_.start('div').addClass(this.myClass('tip')).attrs({ hidden: true })
        .style({ background: this.theme.resolve('tooltipBg'), color: this.theme.resolve('tooltipText'), font: this.theme.font('tooltip') });
      this.tip_.end();
      this.viewport_.end();
      this.applyCamera();
      this.mountStrips();
    },

    function cssText() {
      /** Colours, fonts and stroke weights from the theme, keyed on the state classes the elements emit. */
      var T = this.theme, O = this.Outcome, Ti = this.Tier, p = '.' + this.myClass() + ' ', c = [];
      var box = function(w) { return p + '.rail-el > .box, ' + p + '.rail-el > .gate'; };
      c.push(p + '.box.terminal { fill: ' + T.resolve('terminalBg') + '; }');
      c.push(p + '.box.ruleref  { fill: ' + T.resolve('ruleRefBg')  + '; }');
      c.push(p + '.box.generic  { fill: ' + T.resolve('genericBg')  + '; }');
      c.push(p + '.gate         { fill: ' + T.resolve('gateBg')     + '; stroke-dasharray: 3 3; }');
      c.push(p + '.frame        { fill: ' + T.resolve('frameBg')    + '; stroke: ' + T.resolve('muted') + '; stroke-width: ' + T.STROKE_BASE + '; stroke-dasharray: 4 3; }');
      c.push(p + '.emphasis     { fill: none; stroke: ' + T.resolve('muted') + '; stroke-width: ' + T.STROKE_BASE + '; stroke-dasharray: 2 2; }');
      c.push(p + '.flash        { fill: currentColor; }');
      c.push(p + '.end-stop     { fill: currentColor; }');
      c.push(p + '.dot          { fill: currentColor; }');
      c.push(p + '.stub         { stroke: currentColor; stroke-width: ' + T.BRANCH_STROKE + '; }');
      c.push(p + '.priority-halo { fill: ' + T.background + '; }');
      c.push(p + '.priority      { fill: ' + T.resolve('muted') + '; }');
      c.push(p + '.priority-text { fill: ' + T.background + '; font: ' + T.font('priority') + '; }');
      c.push(p + 'text.label      { fill: ' + T.resolve('text')  + '; font: ' + T.font('label') + '; }');
      c.push(p + 'text.muted, ' + p + 'text.badge, ' + p + 'text.counter, ' + p + 'text.frame-head, ' + p + 'text.emphasis-text { fill: ' + T.resolve('muted') + '; }');
      c.push(p + 'text.badge, ' + p + 'text.counter, ' + p + 'text.frame-head, ' + p + 'text.emphasis-text { font: ' + T.font('badge') + '; }');
      c.push(p + 'text.glyph      { font: ' + T.font('glyph') + '; text-anchor: middle; }');
      c.push(p + 'text.gate-glyph { font: ' + T.font('label') + '; }');
      c.push(p + 'text.rule-name  { fill: ' + T.resolve('text') + '; font: ' + T.font('ruleName') + '; }');
      c.push(p + 'text.rule-name.muted { fill: ' + T.resolve('muted') + '; }');
      c.push(p + 'text.value { fill: ' + T.resolve('text') + '; font: ' + T.font('value') + '; }');
      c.push(p + 'text.lane  { fill: ' + T.resolve('muted') + '; font: ' + T.font('value') + '; }');
      // Outcome colours: the element's own shapes (direct children of its group) and its glyph. currentColor carries it to dot/stub/end-stop.
      O.VALUES.forEach(function(o) {
        var col = T.outcomeColor(o), s = p + '.outcome-' + o.name;
        c.push(s + ' { color: ' + col + '; }');
        c.push(s + ' > .box, ' + s + ' > .track, ' + s + ' > .gate { stroke: ' + col + '; }');
        c.push(s + ' > .glyph, ' + s + ' > .gate-glyph { fill: ' + col + '; }');
        c.push(p + '.branch.outcome-' + o.name + ' { stroke: ' + col + '; }');
      });
      c.push(p + '.missing > .box { stroke: ' + T.outcomeColor(O.FAILED) + '; }');
      // Weight: state by stroke width as well as hue.
      c.push(p + '.rail-el > .box, ' + p + '.rail-el > .gate { stroke-width: ' + T.STROKE_BASE + '; }');
      c.push(p + '.rail-el > .track { stroke-width: ' + ( T.STROKE_BASE + 0.5 ) + '; }');
      c.push(p + '.visited > .box, ' + p + '.visited > .gate { stroke-width: ' + T.STROKE_VISITED + '; }');
      c.push(p + '.visited > .track { stroke-width: ' + ( T.STROKE_VISITED + 0.5 ) + '; }');
      c.push(p + '.highlighted > .box, ' + p + '.highlighted > .gate { stroke-width: ' + T.STROKE_HIGHLIGHT + '; }');
      c.push(p + '.highlighted > .track { stroke-width: ' + ( T.STROKE_HIGHLIGHT + 0.5 ) + '; }');
      c.push(p + '.branch { stroke-width: ' + T.BRANCH_STROKE + '; }');
      c.push(p + '.branch.visited { stroke-width: ' + T.BRANCH_STROKE_VISITED + '; }');
      // Attention tiers fade the whole group; a highlighted element is exempt.
      Ti.VALUES.forEach(function(t) { c.push(p + '.tier-' + t.name + ' { opacity: ' + t.alpha + '; }'); });
      c.push(p + '.highlighted { opacity: 1; }');
      return c.join('\n');
    },

    // ---- strips -----------------------------------------------------------

    function setStrips(strips) {
      /** Replaces the strips; they restack whenever any strip's height changes. */
      var self = this;
      if ( this.stackSub_ ) { this.stackSub_.detach(); this.stackSub_ = null; }
      this.strips = strips;
      // One label column for every strip, wide enough for the longest rule name, so the tracks line up.
      var T = this.theme, labelW = T.LABEL_W;
      strips.forEach(function(s) { labelW = Math.max(labelW, self.measure(s.name, T.font('ruleName')) + T.LABEL_GAP); });
      strips.forEach(function(s) { s.labelW = labelW; });
      if ( strips.length ) {
        this.stackSub_ = foam.lang.ArraySlot.create({ slots: strips.map(function(s) { return s.height$; }) }).sub(this.stackStrips);
      }
      this.stackStrips();
      this.mountStrips();
    },

    function mountStrips() {
      /** Rebuilds every strip's <svg>; called on setStrips and once the view renders. */
      var self = this;
      if ( ! this.world_ ) return;
      // Remove only what this method owns: removeAllChildren() would detach the overlays too,
      // and a detached u2 element keeps its DOM but can never add children or fire listeners again.
      this.stripEls_.forEach(function(svg) { svg.remove(); });
      if ( this.dividerEl_ ) this.dividerEl_.remove();
      this.stripEls_ = new Map();
      this.byId_ = new Map();
      this.nextId_ = 0;
      this.dividerEl_ = this.world_.start('div').addClass(this.myClass('divider')).attrs({ hidden: true });
      this.dividerEl_.end();
      this.strips.forEach(function(s) { self.buildStrip(s); });
      this.overlays_.forEach(function(o) { if ( ! o.mounted ) self.mountOverlay(o); });
      this.placeStrips();
    },

    function addOverlay(el, sx, sy) {
      /** Places any u2 element in the world at scene point (sx, sy): HTML inside the pan/zoom camera, no <foreignObject>. */
      var o = { el: el, x: sx, y: sy };
      this.overlays_.push(o);
      if ( this.world_ ) this.mountOverlay(o);
      return el;
    },

    function mountOverlay(o) {
      this.positionOverlay(o);
      this.world_.add(o.el);
      o.mounted = true;
    },

    function positionOverlay(o) {
      /** x may be 'right': just past the widest strip, re-resolved whenever the strips move. */
      var x = o.x === 'right' ? this.contentBounds().width + 20 : o.x;
      o.el.addClass(this.myClass('overlay')).style({ left: x + 'px', top: o.y + 'px' });
    },

    function buildStrip(strip) {
      /** One <svg> per strip; the strip's group draws itself and its subtree. */
      var self = this, m = this.STRIP_MARGIN;
      var svg = this.world_.start('svg').addClass(this.myClass('strip'));
      var g = svg.start('g').attrs({ transform: 'translate(' + m + ' ' + m + ')' });
      this.assignIds(strip);
      strip.svg(g);
      g.end(); svg.end();
      this.stripEls_.set(strip, svg);
      this.sizeStrip(strip);
      strip.width$.sub(function() { self.sizeStrip(strip); });
      strip.height$.sub(function() { self.sizeStrip(strip); });
      return svg;
    },

    function rebuildStrip(strip) {
      /** After an unfold/fold the strip's subtree changed: redraw that strip only, keeping its <svg>. */
      var svg = this.stripEls_.get(strip);
      if ( ! svg ) return;
      var m = this.STRIP_MARGIN;
      svg.removeAllChildren();
      var g = svg.start('g').attrs({ transform: 'translate(' + m + ' ' + m + ')' });
      this.assignIds(strip);
      strip.svg(g);
      g.end();
      this.sizeStrip(strip);
    },

    function assignIds(root) {
      /** Every hit target gets a data-rail id the pointer handlers map back to the element. */
      var self = this, walk = function(el) {
        if ( el.isHitTarget && el.isHitTarget() ) { el.railId = 'r' + ( self.nextId_++ ); self.byId_.set(el.railId, el); }
        el.children.forEach(walk);
      };
      walk(root);
    },

    function sizeStrip(strip) {
      var svg = this.stripEls_.get(strip), m = this.STRIP_MARGIN;
      if ( ! svg ) return;
      svg.attrs({ width: Math.ceil(strip.width + 2 * m), height: Math.ceil(Math.max(strip.height, this.theme.BOX_H) + 2 * m) });
    },

    function placeStrips() {
      /** Strip origins in world coordinates; the divider before the unreachable block. */
      var self = this, m = this.STRIP_MARGIN;
      this.strips.forEach(function(s) {
        var svg = self.stripEls_.get(s);
        if ( svg ) svg.style({ left: ( s.x - m ) + 'px', top: ( s.y - m ) + 'px' });
      });
      this.overlays_.forEach(function(o) { self.positionOverlay(o); });
      if ( this.dividerEl_ ) {
        var b = this.contentBounds();
        this.dividerEl_.attrs({ hidden: this.dividerY_ < 0 }).style({ top: this.dividerY_ + 'px', left: this.theme.CANVAS_MARGIN + 'px', width: Math.max(0, b.width - this.theme.CANVAS_MARGIN) + 'px' });
      }
      this.requestCull();
    },

    function eachElement(fn) {
      /** Visits every RailElement in draw order: strips, then everything inside, unfolded frames included. */
      var walk = function(el) {
        if ( el.parser !== undefined ) fn(el);
        el.children.forEach(walk);
      };
      this.strips.forEach(walk);
    },

    function elementsFor(parser) {
      /** Every element standing for a parser object (a call site appears once per place it is drawn). */
      var out = [];
      this.eachElement(function(el) { if ( el.parser === parser ) out.push(el); });
      return out;
    },

    function stripOf(el) {
      for ( var p = el ; p ; p = p.parent ) if ( this.RailStrip.isInstance(p) ) return p;
      return null;
    },

    function stripFor(name) {
      return this.strips.find(function(s) { return s.name === name; });
    },

    function sceneRectOf(el) {
      /** Element's box in scene coordinates: parents' translations summed, camera excluded. */
      var x = 0, y = 0;
      for ( var p = el ; p ; p = p.parent ) { x += p.x; y += p.y; }
      return { x: x, y: y, width: el.width, height: el.height };
    },

    function contentBounds() {
      var T = this.theme, w = 0, h = 0;
      this.strips.forEach(function(s) { w = Math.max(w, s.x + s.width); h = Math.max(h, s.y + s.height); });
      return { x: 0, y: 0, width: w + T.CANVAS_MARGIN, height: h + T.CANVAS_MARGIN };
    },

    // ---- camera -----------------------------------------------------------

    function applyCamera() {
      if ( ! this.world_ ) return;
      this.world_.style({ transform: 'translate(' + this.x + 'px, ' + this.y + 'px) scale(' + this.zoom + ')' });
    },

    function toSceneFromView(vx, vy) {
      return { x: ( vx - this.x ) / this.zoom, y: ( vy - this.y ) / this.zoom };
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

    function fitWidth() {
      /** Default fit: the widest strip spans the viewport; a tall grammar scrolls instead of shrinking to slivers. */
      var b = this.contentBounds(), pad = this.DEFAULT_FIT_PAD;
      if ( ! this.viewWidth || ! b.width ) return;
      this.zoom = Math.max(this.minZoom, Math.min(( this.viewWidth - 2 * pad ) / b.width, this.MAX_FIT_ZOOM));
      this.x = pad - b.x * this.zoom;
      this.y = pad - b.y * this.zoom;
    },

    function fitAll() {
      /** Secondary action: the whole grammar in view, however small. */
      this.fit(this.contentBounds());
    },

    function centerOnStrip(name) {
      /** Centres the viewport on a rule's strip at the current zoom; returns the strip or undefined. */
      var s = this.stripFor(name);
      if ( ! s ) return undefined;
      var r = this.sceneRectOf(s);
      this.centerOn(r.x + Math.min(r.width, this.viewWidth / this.zoom) / 2, r.y + r.height / 2, this.zoom);
      return s;
    },

    function flashStrip(name) {
      /** Centres on a strip and pulses its label so the eye finds it. */
      var s = this.centerOnStrip(name);
      if ( s ) this.startPulse(s);
      return s;
    },

    function revealElement(el) {
      /** Pans so el is inside the viewport minus the margin; no-op when already visible. */
      var r = this.sceneRectOf(el), z = this.zoom, m = this.followMargin;
      var vx0 = r.x * z + this.x, vy0 = r.y * z + this.y, vx1 = vx0 + r.width * z, vy1 = vy0 + r.height * z;
      var dx = 0, dy = 0;
      if ( vx0 < m ) dx = m - vx0; else if ( vx1 > this.viewWidth - m ) dx = this.viewWidth - m - vx1;
      if ( vy0 < m ) dy = m - vy0; else if ( vy1 > this.viewHeight - m ) dy = this.viewHeight - m - vy1;
      if ( dx || dy ) this.panTo(this.x + dx, this.y + dy);
    },

    function panTo(tx, ty) {
      /** Follow-pan: a CSS transition carries the world to the new offset; instant when motion is off. */
      var self = this;
      if ( this.motion && this.world_ ) {
        this.world_.addClass('animate');
        clearTimeout(this.animateTimer_);
        this.animateTimer_ = setTimeout(function() { self.world_.removeClass('animate'); }, this.PAN_MS + 30);
      }
      this.x = tx; this.y = ty;
    },

    function requestCull() {
      /** Coalesces culling to one pass per frame. */
      var self = this;
      if ( this.cullReq_ || typeof requestAnimationFrame === 'undefined' ) { if ( ! this.cullReq_ ) this.cull(); return; }
      this.cullReq_ = requestAnimationFrame(function() { self.cullReq_ = null; self.cull(); });
    },

    function cull() {
      /** Strips whose scene rect misses the viewport are not rendered at all; the unit is the strip because it is the <svg> unit. */
      var self = this, z = this.zoom, W = this.viewWidth, H = this.viewHeight;
      if ( ! W || ! H ) return;
      this.strips.forEach(function(s) {
        var svg = self.stripEls_.get(s);
        if ( ! svg ) return;
        var x0 = s.x * z + self.x, y0 = s.y * z + self.y, x1 = x0 + s.width * z, y1 = y0 + Math.max(s.height, self.theme.BOX_H) * z;
        var out = x1 < 0 || y1 < 0 || x0 > W || y0 > H;
        svg.style({ display: out ? 'none' : '' });
      });
    },

    function isStripVisible(strip) {
      var svg = this.stripEls_.get(strip);
      return !! svg && svg.element_.style.display !== 'none';
    },

    // ---- pointer ------------------------------------------------------------

    function viewPoint(e) {
      var r = this.viewport_.element_.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    },

    function elementAt(e) {
      /** The RailElement whose group the event landed on, or null. */
      var node = e.target && e.target.closest ? e.target.closest('[data-rail]') : null;
      return node ? this.byId_.get(node.getAttribute('data-rail')) || null : null;
    },

    function onDown(e) {
      if ( e.button !== 0 ) return;
      // Inside an overlay the browser owns the gesture (focus, click, text selection); no pan, no capture.
      if ( e.target.closest && e.target.closest('.' + this.myClass('overlay')) ) return;
      var v = this.viewPoint(e);
      // Resolve the element now: after pointer capture the up event's target is the viewport, not the shape.
      this.drag_ = { x: v.x, y: v.y, sx: this.x, sy: this.y, moved: false, el: this.elementAt(e) };
      this.viewport_.element_.setPointerCapture && this.viewport_.element_.setPointerCapture(e.pointerId);
    },

    function onMove(e) {
      var v = this.viewPoint(e);
      if ( this.drag_ ) {
        var dx = v.x - this.drag_.x, dy = v.y - this.drag_.y;
        if ( Math.abs(dx) + Math.abs(dy) > this.DRAG_THRESHOLD ) { this.drag_.moved = true; this.viewport_.addClass('dragging'); this.hideTooltip(); }
        if ( this.drag_.moved ) { this.x = this.drag_.sx + dx; this.y = this.drag_.sy + dy; }
        return;
      }
      var el = this.elementAt(e);
      if ( el && el.tipText ) this.showTooltip(el.tipText() + this.valuesTip(el), v.x + this.TIP_OFFSET, v.y + this.TIP_OFFSET);
      else this.hideTooltip();
    },

    function onUp(e) {
      var d = this.drag_; this.drag_ = null;
      this.viewport_.removeClass('dragging');
      if ( ! d || d.moved ) return;
      if ( d.el && this.onHit ) this.onHit(d.el, e);
    },

    function onWheel(e) {
      e.preventDefault();
      var v = this.viewPoint(e);
      // Proportional to the wheel delta so a pinch (many small deltas) zooms gradually and a notch stays a notch.
      var d = Math.max(-this.ZOOM_MAX_DELTA, Math.min(this.ZOOM_MAX_DELTA, e.deltaY));
      this.zoomAt(v.x, v.y, Math.exp(-d * this.ZOOM_RATE));
    },

    function onDouble(e) {
      var el = this.elementAt(e), strip = el && this.stripOf(el);
      if ( strip ) this.centerOnStrip(strip.name);
    },

    function valuesTip(el) {
      /** For a box that matched several times: its values in order, so ×n can be read out. */
      if ( ! this.snapshot_ || ! el.parser || el.matchCount < 2 ) return '';
      var vals = this.snapshot_.valuesOf(el.parser), n = this.TIP_VALUES_MAX;
      var shown = vals.slice(0, n).map(function(v) { return '"' + v + '"'; }).join(' · ');
      return '\nvalues: ' + shown + ( vals.length > n ? ' …+' + ( vals.length - n ) + ' more' : '' );
    },

    function showTooltip(text, vx, vy) {
      if ( ! this.tip_ ) return;
      this.tip_.element_.textContent = text;
      this.tip_.attrs({ hidden: false }).style({ left: vx + 'px', top: vy + 'px' });
    },

    function hideTooltip() { if ( this.tip_ ) this.tip_.attrs({ hidden: true }); },

    // ---- trace ----------------------------------------------------------

    function applyTrace(snap) {
      /**
       * null clears everything. Otherwise: outcome + consumed per element by path
       * suffix, then tier by scope: a strip or unfolded frame is live while its rule
       * has an open activation; a finished trace has nothing open, so it renders as a
       * result view. Changed elements pulse; the element being tried is revealed.
       * Every element then rewrites its classes, so the DOM follows in one pass.
       */
      var self = this, O = this.Outcome, T = this.Tier, focus = null, byParser = snap ? snap.valuesByParser() : null;
      this.snapshot_ = snap;
      if ( ! snap ) {
        this.eachElement(function(el) { el.outcome = O.NONE; el.tier = T.LIVE; el.consumed = ''; el.matchCount = 0; el.values = []; });
        this.strips.forEach(function(s) { s.runs = 0; s.matches = 0; s.values = []; });
        this.syncAll();
        return;
      }
      var scope = function(el, live) {
        if ( self.RailStrip.isInstance(el) ) {
          live = live || snap.isActive(el.parser);
          var wasOutcome = el.outcome, wasRuns = el.runs;
          el.runs    = snap.runsOf(el.parser);
          el.matches = snap.matchesOf(el.parser);
          el.outcome = snap.outcomeOf(el.pathKey);
          if ( el.outcome !== wasOutcome || el.runs !== wasRuns ) self.startPulse(el);    // rule entered or exited: label flash
          el.children.forEach(function(c) { scope(c, live); });
          return;
        }
        if ( self.RailSymRef.isInstance(el) && el.unfolded ) live = live || snap.isActive(el.parser);
        if ( el.parser !== undefined ) {
          var before = el.outcome;
          el.outcome  = snap.outcomeOf(el.pathKey);
          // Values come from the derivation, not the activation map: a loop ends with a failed
          // attempt that overwrites the call site's map entry, so consumedBy() would read empty.
          var vals = byParser.get(el.parser) || [];
          el.values     = vals;
          el.consumed   = vals.length ? vals[vals.length - 1] : '';
          el.matchCount = vals.length;
          el.tier     = el.outcome === O.NONE ? T.NEVER : live ? T.LIVE : T.HISTORY;
          if ( el.outcome !== before ) self.startPulse(el);
          if ( el.outcome === O.TRYING && ! focus ) focus = el;
        }
        el.children.forEach(function(c) { scope(c, live); });
      };
      this.strips.forEach(function(s) { scope(s, snap.finished); });
      if ( this.showLanes ) this.strips.forEach(function(s) { s.values = byParser.get(s.parser) || []; });
      this.syncAll();
      if ( focus ) this.revealElement(focus);
    },

    function syncAll() {
      var walk = function(el) { if ( el.syncState ) el.syncState(); el.children.forEach(walk); };
      this.strips.forEach(walk);
    },

    function startPulse(el) {
      /** CSS keyframe restart on the element's group; nothing to tick. */
      if ( ! this.motion ) return;
      el.pulse();
    },

    function highlightParser(parser) {
      /** Heavy outline on every element for a parser (definition strip track + call sites); replaces the previous highlight. */
      this.clearHighlight();
      this.highlighted_ = this.elementsFor(parser);
      this.highlighted_.forEach(function(el) { el.highlighted = true; el.syncState(); });
      return this.highlighted_;
    },

    function clearHighlight() {
      this.highlighted_.forEach(function(el) { el.highlighted = false; el.syncState(); });
      this.highlighted_ = [];
    }
  ],

  listeners: [
    function onCamera() { this.applyCamera(); this.requestCull(); },

    function stackStrips() {
      var T = this.theme, y = T.CANVAS_MARGIN, divider = -1;
      this.strips.forEach(function(s, i) {
        // One extra gap (and a divider) where the unreachable block begins.
        if ( s.unreachable && ( i === 0 || ! this.strips[i - 1].unreachable ) && divider < 0 ) { divider = y + T.STRIP_GAP / 2; y += T.STRIP_GAP; }
        s.x = T.CANVAS_MARGIN; s.y = y; y += s.height + T.STRIP_GAP + ( this.showLanes ? s.LANE_GAP : 0 );
      }, this);
      this.dividerY_ = divider;
      this.placeStrips();
    }
  ]
});
