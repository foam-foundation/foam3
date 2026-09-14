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
    { name: 'LEGEND_GENERIC',    message: 'grey box = parser class with no drawing yet' },
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
          .start('span').add(this.HINT).end()
        .end()
        .start('div').addClass(this.myClass('legend'))
          .start('b').add(this.LEGEND_NOTATION).end()
          .start('span').add(this.LEGEND_TERMINAL).end()
          .start('span').add(this.LEGEND_RULE_REF).end()
          .start('span').add(this.LEGEND_END_STOP).end()
          .start('span').add(this.LEGEND_GENERIC).end()
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
    },

    function startSymbolOf(grammar) {
      /** START if the grammar has it, else the first rule. */
      if ( grammar.symbolMap_['START'] ) return 'START';
      return grammar.symbols.length ? grammar.symbols[0].name : 'START';
    },

    function useGrammar(grammar) {
      /** Rebuilds the strips for a grammar and frames them. */
      this.grammar = grammar;
      if ( ! grammar ) { this.scene.setStrips([]); this.status = this.NO_GRAMMAR; return; }
      this.startSymbol = this.startSymbolOf(grammar);
      this.builder = this.RailBuilder.create({ grammar: grammar, theme: this.scene.theme, measure: this.scene.measure });
      var strips = this.builder.buildStrips();
      this.scene.setStrips(strips);
      this.status = strips.length ? strips.length + ' rules, start = ' + this.startSymbol : this.NO_SYMBOLS;
      this.scene.fitWidth();
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
      /** Click policy. Later PRs: unfold a rule reference; list a rule's runs from its strip label. */
      if ( this.RailSymRef.isInstance(el) && el.canUnfold() ) el.toggle();
    }
  ]
});
