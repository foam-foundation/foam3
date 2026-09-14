/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.rail',
  name: 'RailDiagramView',
  extends: 'foam.u2.View',

  documentation: `
    The page: a canvas host sized by a ResizeObserver, pointer handling (drag
    pans, wheel zooms about the pointer, hover shows the tooltip, click hits an
    element), a toolbar and a legend. Composition and wiring only: the scene
    owns the elements, the builder owns the mapping, later PRs add the trace.
  `,

  requires: [
    'foam.parse.rail.RailBuilder',
    'foam.parse.rail.RailScene',
    'foam.parse.rail.RailStrip',
    'foam.parse.rail.RailSymRef'
  ],

  css: `
    ^ { font-family: sans-serif; }
    ^host { width: 100%; height: calc(100vh - 150px); min-height: 480px; border: 1px solid #ccc; position: relative; overflow: hidden; touch-action: none; }
    ^host canvas { display: block; }
    ^bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 6px 0; }
    ^legend { font-size: 12px; color: #444; margin: 2px 0 8px; display: flex; flex-wrap: wrap; gap: 4px 14px; align-items: baseline; }
    ^status { font: 13px monospace; white-space: pre-wrap; min-height: 1.4em; margin: 6px 0; }
  `,

  messages: [
    { name: 'HINT',              message: 'Drag = pan · wheel = zoom · hover = tooltip' },
    { name: 'LEGEND_NOTATION',   message: 'Notation:' },
    { name: 'LEGEND_TERMINAL',   message: 'rounded yellow box = terminal (text to match)' },
    { name: 'LEGEND_RULE_REF',   message: 'blue box = rule reference' },
    { name: 'LEGEND_END_STOP',   message: '⊣ = end of input' },
    { name: 'LEGEND_PRIORITY',   message: '①②③ = branch priority, first match wins' },
    { name: 'LEGEND_LOOP',       message: '↺ = loop, greedy (never gives back)' },
    { name: 'LEGEND_MIN',        message: '×1+ = minimum repeats · ∅ = may match nothing' },
    { name: 'LEGEND_BYPASS',     message: 'track over a box = optional' },
    { name: 'LEGEND_GENERIC',    message: 'grey box = parser class with no drawing yet' },
    { name: 'LEGEND_UNFOLD',     message: '▾ = unfolded rule (click a blue box to unfold, its header to fold, shift-click to jump to the definition)' },
    { name: 'LEGEND_UNREACH',    message: 'muted name + (unreachable) = rule the start symbol never reaches' },
    { name: 'LEGEND_GATE',       message: '⊘ dashed frame = must NOT match next (nothing consumed) · ⟶? = must match next' },
    { name: 'LEGEND_BADGES',     message: '∅ no value · «» substring · ⊕ joined string · ⚙ action · 💬 suggestion/message · 🐞 debug' },
    { name: 'ALL_RULES',         message: 'all rules' },
    { name: 'UNREACHABLE_WORD', message: 'unreachable' },
    { name: 'FIT_WIDTH',         message: 'Fit width' },
    { name: 'FIT_ALL',           message: 'Fit all' },
    { name: 'NO_GRAMMAR',        message: 'no grammar loaded' },
    { name: 'NO_SYMBOLS',        message: 'no symbols' }
  ],

  constants: {
    ZOOM_STEP: 1.1,
    DRAG_THRESHOLD: 3,     // px of movement before a press counts as a drag, not a click
    TIP_OFFSET: 14         // tooltip sits this far right/below the pointer (viewport px)
  },

  properties: [
    { name: 'grammar', documentation: 'A foam.parse.Grammar; set it (or call useGrammar) to draw.' },
    { name: 'scene',   factory: function() { return this.RailScene.create(); } },
    { name: 'builder' },
    { class: 'String', name: 'startSymbol' },
    { class: 'String', name: 'status' },
    { class: 'Boolean', name: 'showAll', documentation: 'Include rules unreachable from the start symbol.', postSet: function() { this.rebuildStrips(); } },
    { class: 'Int', name: 'unreachableCount' },
    { name: 'hostEl' },
    { name: 'drag_' }
  ],

  methods: [
    function render() {
      var self = this;
      this.addClass(this.myClass())
        .start('div').addClass(this.myClass('bar'))
          .start('button').add(this.FIT_WIDTH).on('click', function() { self.scene.fitWidth(); }).end()
          .start('button').add(this.FIT_ALL).on('click', function() { self.scene.fitAll(); }).end()
          .start('label')
            .start('input').attrs({ type: 'checkbox' }).on('change', function(e) { self.showAll = e.target.checked; }).end()
            .add(' ', this.ALL_RULES, ' (', this.unreachableCount$, ' ', this.UNREACHABLE_WORD, ')')
          .end()
          .start('span').add(this.HINT).end()
        .end()
        .start('div').addClass(this.myClass('legend'))
          .start('b').add(this.LEGEND_NOTATION).end()
          .start('span').add(this.LEGEND_TERMINAL).end()
          .start('span').add(this.LEGEND_RULE_REF).end()
          .start('span').add(this.LEGEND_END_STOP).end()
          .start('span').add(this.LEGEND_PRIORITY).end()
          .start('span').add(this.LEGEND_LOOP).end()
          .start('span').add(this.LEGEND_MIN).end()
          .start('span').add(this.LEGEND_BYPASS).end()
          .start('span').add(this.LEGEND_GENERIC).end()
          .start('span').add(this.LEGEND_UNFOLD).end()
          .start('span').add(this.LEGEND_UNREACH).end()
          .start('span').add(this.LEGEND_GATE).end()
          .start('span').add(this.LEGEND_BADGES).end()
        .end()
        .start('div', null, this.hostEl$).addClass(this.myClass('host')).add(this.scene).end()
        .start('div').addClass(this.myClass('status')).add(this.status$).end();

      // The scene's viewport follows the host element's size.
      this.hostEl.el().then(function(el) {
        var size = function() { self.scene.viewWidth = el.clientWidth; self.scene.viewHeight = el.clientHeight; };
        new ResizeObserver(size).observe(el);
        size();
        if ( self.grammar ) self.useGrammar(self.grammar);
      });

      var canvas = this.scene.canvas;
      canvas.on('pointerdown',  function(e) { self.onDown(e); });
      canvas.on('pointermove',  function(e) { self.onMove(e); });
      canvas.on('pointerup',    function(e) { self.onUp(e); });
      canvas.on('pointerleave', function()  { self.scene.hideTooltip(); });
      canvas.on('wheel', function(e) {
        e.preventDefault();
        var v = self.viewPoint(e);
        self.scene.zoomAt(v.x, v.y, e.deltaY < 0 ? self.ZOOM_STEP : 1 / self.ZOOM_STEP);
      });
      canvas.on('dblclick', function(e) {
        var v = self.viewPoint(e), hit = self.scene.hitAtView(v.x, v.y);
        if ( hit && self.RailStrip.isInstance(hit) ) self.scene.centerOnStrip(hit.name);
      });
    },

    function useGrammar(grammar) {
      /** Rebuilds the strips for a grammar and frames them. The builder decides the start symbol. */
      this.grammar = grammar;
      if ( ! grammar ) { this.scene.setStrips([]); this.status = this.NO_GRAMMAR; return; }
      this.builder = this.RailBuilder.create({ grammar: grammar, theme: this.scene.theme, measure: this.scene.measure });
      this.startSymbol = this.builder.startSymbol;
      this.unreachableCount = this.builder.unreachableNames().length;
      this.rebuildStrips();
      this.status = grammar.symbols.length ? grammar.symbols.length + ' rules, start = ' + this.startSymbol : this.NO_SYMBOLS;
      this.scene.fitWidth();
    },

    function rebuildStrips() {
      /** Strips follow the showAll toggle; the camera is kept (a toggle should not jump the view). */
      if ( ! this.builder ) return;
      this.scene.setStrips(this.builder.buildReachableStrips(this.showAll));
    },

    // ---- pointer ---------------------------------------------------------

    function viewPoint(e) {
      var r = e.target.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    },

    function onDown(e) {
      var v = this.viewPoint(e);
      this.drag_ = { x: v.x, y: v.y, sx: this.scene.x, sy: this.scene.y, moved: false };
    },

    function onMove(e) {
      var v = this.viewPoint(e);
      if ( this.drag_ ) {
        var dx = v.x - this.drag_.x, dy = v.y - this.drag_.y;
        if ( Math.abs(dx) + Math.abs(dy) > this.DRAG_THRESHOLD ) this.drag_.moved = true;
        this.scene.x = this.drag_.sx + dx;
        this.scene.y = this.drag_.sy + dy;
        return;
      }
      var hit = this.scene.hitAtView(v.x, v.y);
      if ( hit && hit.tipText ) {
        var s = this.scene.toSceneFromView(v.x, v.y);
        this.scene.showTooltip(hit.tipText(), s.x + this.TIP_OFFSET / this.scene.zoom, s.y + this.TIP_OFFSET / this.scene.zoom);
      } else {
        this.scene.hideTooltip();
      }
    },

    function onUp(e) {
      var d = this.drag_; this.drag_ = null;
      if ( ! d || d.moved ) return;
      var v = this.viewPoint(e);
      var hit = this.scene.hitAtView(v.x, v.y);
      if ( hit ) this.onHit(hit, e);
    },

    function onHit(el, e) {
      /** Click policy. Rule reference: shift-click jumps to its definition, plain click unfolds/folds. */
      if ( this.RailSymRef.isInstance(el) ) {
        if ( e.shiftKey ) { this.scene.centerOnStrip(el.name); return; }
        if ( el.canUnfold() || el.unfolded ) { el.toggle(); this.afterToggle(el); }
      }
    },

    function afterToggle(el) {
      /** Hook for later PRs (re-apply trace lights to freshly built content). */
      this.scene.hideTooltip();
    }
  ]
});
