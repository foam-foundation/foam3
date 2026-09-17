/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.rail',
  name: 'RailScene',
  extends: 'foam.graphics.Scene',

  documentation: `
    The viewer's canvas: a content layer holding the rule strips stacked
    vertically, and an overlay layer holding the one tooltip. Camera, layers
    and hit order come from foam.graphics.Scene; this class adds strip
    stacking, element lookup by walking its own tree (no registry), and the
    two fits: width (default, tall grammars scroll) and all.
  `,

  requires: [
    'foam.graphics.SceneLayer',
    'foam.graphics.TooltipCView',
    'foam.graphics.Tween',
    'foam.parse.rail.Outcome',
    'foam.parse.rail.RailStrip',
    'foam.parse.rail.RailSymRef',
    'foam.parse.rail.RailTheme',
    'foam.parse.rail.Tier'
  ],

  properties: [
    { name: 'theme', factory: function() { return this.RailTheme.create(); } },
    { name: 'content', factory: function() { return this.addLayer(this.SceneLayer.create()); } },
    { name: 'overlay', factory: function() { return this.addLayer(this.SceneLayer.create()); } },
    {
      name: 'tooltip',
      factory: function() {
        var t = this.TooltipCView.create({ theme: this.theme, measure: this.measure, alpha: 0 });
        this.overlay.add(t);
        return t;
      }
    },
    { name: 'strips', factory: function() { return []; } },
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
    { class: 'Int', name: 'panDuration', value: 220 },
    { name: 'pulses_', factory: function() { return new Map(); }, documentation: 'element -> running Tween.' },
    { name: 'panTween_' },
    { name: 'highlighted_', factory: function() { return []; } },
    {
      class: 'Boolean',
      name: 'cacheStrips',
      value: true,
      documentation: 'Each strip is a cached bitmap (CView.cache): a trace step re-renders only the strips whose elements changed.',
      postSet: function(_, on) { this.strips.forEach(on ? function(s) { s.cache(); } : function(s) { s.uncache(); }); }
    }
  ],

  methods: [
    function init() {
      this.SUPER();
      // Touch the layer factories in paint order: content first, then overlay, then the tooltip inside it.
      this.content; this.overlay; this.tooltip;
    },

    function setStrips(strips) {
      /** Replaces the strips; they restack whenever any strip's height changes. */
      var self = this;
      if ( this.stackSub_ ) { this.stackSub_.detach(); this.stackSub_ = null; }
      this.strips.forEach(function(s) { self.content.remove(s); });
      this.strips = strips;
      // One label column for every strip, wide enough for the longest rule name, so the tracks line up.
      var T = this.theme, labelW = T.LABEL_W;
      strips.forEach(function(s) { labelW = Math.max(labelW, self.measure(s.name, T.font('ruleName')) + T.LABEL_GAP); });
      strips.forEach(function(s) { s.labelW = labelW; self.content.add(s); });
      if ( this.cacheStrips ) strips.forEach(function(s) { s.cache(); });
      if ( strips.length ) {
        this.stackSub_ = foam.lang.ArraySlot.create({ slots: strips.map(function(s) { return s.height$; }) }).sub(this.stackStrips);
      }
      this.stackStrips();
    },

    function eachElement(fn) {
      /** Visits every RailElement in paint order: strips, then everything inside, unfolded frames included. */
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

    function recacheStrip(strip) {
      /** After an unfold/fold the strip's subtree changed; the cache subscribes to the subtree at cache() time, so redo it. */
      if ( ! this.cacheStrips ) return;
      strip.uncache();
      strip.cache();
    },

    function stripOf(el) {
      for ( var p = el ; p ; p = p.parent ) if ( this.RailStrip.isInstance(p) ) return p;
      return null;
    },

    function stripFor(name) {
      return this.strips.find(function(s) { return s.name === name; });
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

    function sceneRectOf(el) {
      /** Element's box in scene coordinates: parents' translations summed, camera excluded. */
      var x = 0, y = 0;
      for ( var p = el ; p && p !== this ; p = p.parent ) { x += p.x; y += p.y; }
      return { x: x, y: y, width: el.width, height: el.height };
    },

    function contentBounds() {
      var T = this.theme, w = 0, h = 0;
      this.strips.forEach(function(s) { w = Math.max(w, s.x + s.width); h = Math.max(h, s.y + s.height); });
      return { x: 0, y: 0, width: w + T.CANVAS_MARGIN, height: h + T.CANVAS_MARGIN };
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

    function showTooltip(text, sx, sy) {
      /** Positions the tooltip at scene point (sx, sy) and reveals it. */
      this.tooltip.text = text;
      this.tooltip.layout();
      this.tooltip.x = sx; this.tooltip.y = sy;
      this.tooltip.alpha = 1;
    },

    function hideTooltip() { this.tooltip.alpha = 0; },

    // ---- trace ----------------------------------------------------------

    function applyTrace(snap) {
      /**
       * null clears everything. Otherwise: outcome + consumed per element by path
       * suffix, then tier by scope: a strip or unfolded frame is live while its rule
       * has an open activation; a finished trace has nothing open, so it renders as a
       * result view. Changed elements pulse; the element being tried is revealed.
       */
      var self = this, O = this.Outcome, T = this.Tier, focus = null;
      if ( ! snap ) {
        this.eachElement(function(el) { el.outcome = O.NONE; el.tier = T.LIVE; el.consumed = ''; });
        this.strips.forEach(function(s) { s.runs = 0; s.matches = 0; });
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
          el.consumed = snap.consumedBy(el.pathKey);
          el.tier     = el.outcome === O.NONE ? T.NEVER : live ? T.LIVE : T.HISTORY;
          if ( el.outcome !== before ) self.startPulse(el);
          if ( el.outcome === O.TRYING && ! focus ) focus = el;
        }
        el.children.forEach(function(c) { scope(c, live); });
      };
      this.strips.forEach(function(s) { scope(s, snap.finished); });
      if ( focus ) this.revealElement(focus);
    },

    function startPulse(el) {
      /** Stroke swell that settles over ~200 ms; one Tween per element, restarted on a new change. */
      if ( ! this.motion ) return;
      var old = this.pulses_.get(el);
      if ( old ) old.cancel();
      var tw = this.Tween.create({ onUpdate: function(t) { el.pulse = 1 - t; }, onDone: function() { el.pulse = 0; } }).start();
      this.pulses_.set(el, tw);
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
      /** Animated pan; the newest pan wins. Instant when motion is off. */
      var self = this;
      if ( this.panTween_ ) this.panTween_.cancel();
      if ( ! this.motion ) { this.x = tx; this.y = ty; return; }
      var sx = this.x, sy = this.y;
      this.panTween_ = this.Tween.create({ duration: this.panDuration, onUpdate: function(t) { self.x = sx + ( tx - sx ) * t; self.y = sy + ( ty - sy ) * t; } }).start();
    },

    function highlightParser(parser) {
      /** Heavy outline on every element for a parser (definition strip track + call sites); replaces the previous highlight. */
      this.clearHighlight();
      this.highlighted_ = this.elementsFor(parser);
      this.highlighted_.forEach(function(el) { el.highlighted = true; });
      return this.highlighted_;
    },

    function clearHighlight() {
      this.highlighted_.forEach(function(el) { el.highlighted = false; });
      this.highlighted_ = [];
    },

    function paintSelf(ctx) {
      this.SUPER(ctx);                                     // background
      if ( this.dividerY_ < 0 ) return;
      // Dashed divider across the content width, in scene space (the camera transform is already applied).
      var b = this.contentBounds(), T = this.theme;
      ctx.save();
      ctx.setLineDash([ 6, 4 ]); ctx.strokeStyle = T.resolve('muted'); ctx.lineWidth = T.STROKE_BASE;
      ctx.beginPath(); ctx.moveTo(T.CANVAS_MARGIN, this.dividerY_); ctx.lineTo(b.width, this.dividerY_); ctx.stroke();
      ctx.restore();
    }
  ],

  listeners: [
    function stackStrips() {
      var T = this.theme, y = T.CANVAS_MARGIN, divider = -1;
      this.strips.forEach(function(s, i) {
        // One extra gap (and a divider) where the unreachable block begins.
        if ( s.unreachable && ( i === 0 || ! this.strips[i - 1].unreachable ) && divider < 0 ) { divider = y + T.STRIP_GAP / 2; y += T.STRIP_GAP; }
        s.x = T.CANVAS_MARGIN; s.y = y; y += s.height + T.STRIP_GAP;
      }, this);
      this.dividerY_ = divider;
    }
  ]
});
