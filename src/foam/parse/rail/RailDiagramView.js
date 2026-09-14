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
    element), a toolbar, a legend, and the trace column (input ribbon,
    derivation panel, controls). Composition and wiring only: the scene owns
    the elements, the builder owns the mapping, ParseTrace owns the parse;
    show(n) hands one snapshot to scene, ribbon, panel and status line.
  `,

  requires: [
    'foam.parse.rail.DerivationPanel',
    'foam.parse.rail.Outcome',
    'foam.parse.rail.ParseTrace',
    'foam.parse.rail.RailBuilder',
    'foam.parse.rail.RailInputRibbon',
    'foam.parse.rail.RailScene',
    'foam.parse.rail.RailStrip',
    'foam.parse.rail.RailSymRef',
    'foam.parse.rail.Tier'
  ],

  css: `
    ^ { font-family: sans-serif; }
    ^main { display: flex; align-items: stretch; }
    ^left { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    ^host { width: 100%; height: calc(100vh - 150px); min-height: 480px; border: 1px solid #ccc; position: relative; overflow: hidden; touch-action: none; }
    ^host canvas, ^ribbon canvas { display: block; }
    ^right { width: 420px; min-width: 0; display: flex; flex-direction: column; border: 1px solid #ccc; border-left: none; }
    ^ribbon { border-bottom: 1px solid #ccc; overflow: hidden; }
    ^panel { flex: 1; min-height: 0; overflow: auto; padding: 6px 0; }
    ^controls { border-top: 1px solid #ccc; padding: 8px; }
    ^controls textarea { width: 100%; box-sizing: border-box; font: 13px monospace; height: 34px; }
    ^bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 6px 0; }
    ^slider { width: 100%; }
    ^status { font: 13px monospace; white-space: pre-wrap; overflow-wrap: anywhere; min-height: 2.6em; }
    ^legend { font-size: 12px; color: #444; margin: 2px 0 8px; display: flex; flex-wrap: wrap; gap: 4px 14px; align-items: baseline; }
    ^hint { color: #777; font-size: 12px; }
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
    { name: 'LEGEND_TRACE',      message: 'Trace:' },
    { name: 'LEGEND_MATCHED',    message: '▬ ✓ matched' },
    { name: 'LEGEND_TRYING',     message: '▬ ▶ trying' },
    { name: 'LEGEND_FAILED',     message: '▬ ✗ failed' },
    { name: 'LEGEND_HISTORY',    message: '▬ ✓ ran earlier, rule idle now' },
    { name: 'LEGEND_NEVER',      message: '▬ not reached' },
    { name: 'LEGEND_COUNTER',    message: '"tried ×n · ✓m" under a rule = attempts and matches so far · click the rule name to list the matches' },
    { name: 'LEGEND_SELECTED',   message: 'heavy outline = selected from the derivation panel' },
    { name: 'LEGEND_RIBBON',     message: 'Ribbon:' },
    { name: 'LEGEND_CONSUMED',   message: 'consumed so far' },
    { name: 'LEGEND_OPEN',       message: 'attempt in progress' },
    { name: 'LEGEND_DIED',       message: 'char it died on' },
    { name: 'LEGEND_CURRENT',    message: 'current char' },
    { name: 'LEGEND_UNDER_TEST', message: 'char under test' },
    { name: 'LEGEND_CARET',      message: '▏ caret = stream position · small numbers = char index' },
    { name: 'LEGEND_DERIV',      message: 'Derivation:' },
    { name: 'LEGEND_DERIV_MATCHED', message: '✓ matched, pruned of dead ends' },
    { name: 'LEGEND_DERIV_OPEN', message: '▶ still open at this step' },
    { name: 'ALL_RULES',         message: 'all rules' },
    { name: 'UNREACHABLE_WORD',  message: 'unreachable' },
    { name: 'FIT_WIDTH',         message: 'Fit width' },
    { name: 'FIT_ALL',           message: 'Fit all' },
    { name: 'NO_GRAMMAR',        message: 'no grammar loaded' },
    { name: 'NO_SYMBOLS',        message: 'no symbols' },
    { name: 'START',             message: 'Start' },
    { name: 'BACK',              message: '◀ Back' },
    { name: 'STEP_ONE',          message: 'Step ▶' },
    { name: 'STEP_OVER',         message: 'Step over' },
    { name: 'NEXT_RULE',         message: 'Next rule' },
    { name: 'PLAY',              message: '▶ Play' },
    { name: 'PAUSE',             message: '❚❚ Pause' },
    { name: 'RUN_TO_END',        message: 'Run to end' },
    { name: 'SLIDER_HINT',       message: 'slider = scrub through the recorded parse; the input box above is the text being parsed' },
    { name: 'NOT_PARSED',        message: 'input changed — press Start to parse it' },
    { name: 'LOAD_FIRST',        message: 'load a grammar first' }
  ],

  constants: {
    ZOOM_STEP: 1.1,
    DRAG_THRESHOLD: 3,     // px of movement before a press counts as a drag, not a click
    TIP_OFFSET: 14,        // tooltip sits this far right/below the pointer (viewport px)
    PLAY_INTERVAL_MS: 140  // auto-step pace
  },

  properties: [
    { name: 'grammar', documentation: 'A foam.parse.Grammar; set it (or call useGrammar) to draw.' },
    { name: 'scene',   factory: function() { return this.RailScene.create(); } },
    { name: 'builder' },
    { class: 'String', name: 'startSymbol' },
    { class: 'String', name: 'status' },
    { class: 'Boolean', name: 'showAll', documentation: 'Include rules unreachable from the start symbol.', postSet: function() { this.rebuildStrips(); } },
    { class: 'Int', name: 'unreachableCount' },
    { class: 'String', name: 'input', value: '' },
    { name: 'trace', documentation: 'The recorded ParseTrace, or null before Start.' },
    { class: 'Int', name: 'step' },
    { name: 'ribbon', factory: function() { return this.RailInputRibbon.create({ theme: this.scene.theme, measure: this.scene.measure }); } },
    { name: 'panel',  factory: function() { var self = this; return this.DerivationPanel.create({ onSelect: function(p) { self.highlight(p); } }); } },
    { name: 'hostEl' },
    { name: 'inputEl' },
    { name: 'sliderEl' },
    { name: 'playBtn' },
    { name: 'ribbonEl' },
    { name: 'playTimer_' },
    { name: 'drag_' }
  ],

  methods: [
    function render() {
      var self = this, T = this.scene.theme, O = this.Outcome;
      var tone = function(outcome) { return { color: T.outcomeColor(outcome) }; };
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
        .start('div').addClass(this.myClass('legend'))
          .start('b').add(this.LEGEND_TRACE).end()
          .start('span').style(tone(O.MATCHED)).add(this.LEGEND_MATCHED).end()
          .start('span').style(tone(O.TRYING)).add(this.LEGEND_TRYING).end()
          .start('span').style(tone(O.FAILED)).add(this.LEGEND_FAILED).end()
          .start('span').style({ color: T.outcomeColor(O.MATCHED), opacity: this.Tier.HISTORY.alpha }).add(this.LEGEND_HISTORY).end()
          .start('span').style({ opacity: this.Tier.NEVER.alpha }).add(this.LEGEND_NEVER).end()
          .start('span').add(this.LEGEND_COUNTER).end()
          .start('span').add(this.LEGEND_SELECTED).end()
          .start('b').add(this.LEGEND_RIBBON).end()
          .start('span').style({ background: T.resolve('consumedBg') }).add(this.LEGEND_CONSUMED).end()
          .start('span').style({ borderBottom: '3px solid ' + T.outcomeColor(O.TRYING) }).add(this.LEGEND_OPEN).end()
          .start('span').style({ background: T.resolve('failBg') }).add(this.LEGEND_DIED).end()
          .start('span').style({ border: '1px dashed ' + T.resolve('muted'), padding: '0 3px' }).add(this.LEGEND_CURRENT).end()
          .start('span').style({ border: '2px solid ' + T.outcomeColor(O.TRYING), padding: '0 3px' }).add(this.LEGEND_UNDER_TEST).end()
          .start('span').add(this.LEGEND_CARET).end()
          .start('b').add(this.LEGEND_DERIV).end()
          .start('span').style(tone(O.MATCHED)).add(this.LEGEND_DERIV_MATCHED).end()
          .start('span').style(tone(O.TRYING)).add(this.LEGEND_DERIV_OPEN).end()
        .end()
        .start('div').addClass(this.myClass('main'))
          .start('div').addClass(this.myClass('left'))
            .start('div', null, this.hostEl$).addClass(this.myClass('host')).add(this.scene).end()
          .end()
          .start('div').addClass(this.myClass('right'))
            .start('div', null, this.ribbonEl$).addClass(this.myClass('ribbon')).add(this.ribbon).end()
            .start('div').addClass(this.myClass('panel')).add(this.panel).end()
            .start('div').addClass(this.myClass('controls'))
              .start('textarea', null, this.inputEl$).attrs({ value: this.input$ }).on('input', function(e) { self.setInput(e.target.value); }).end()
              .start('div').addClass(this.myClass('bar'))
                .start('button').add(this.START).on('click', function() { self.stopPlay(); self.record(0); }).end()
                .start('button').add(this.BACK).on('click', function() { self.stepBack(); }).end()
                .start('button').add(this.STEP_ONE).on('click', function() { self.stepOne(); }).end()
                .start('button').add(this.STEP_OVER).on('click', function() { self.stepOver(); }).end()
                .start('button').add(this.NEXT_RULE).on('click', function() { self.nextRule(); }).end()
                .start('button', null, this.playBtn$).add(this.PLAY).on('click', function() { self.togglePlay(); }).end()
                .start('button').add(this.RUN_TO_END).on('click', function() { self.runToEnd(); }).end()
              .end()
              .start('input', null, this.sliderEl$).attrs({ type: 'range', min: 0, max: 0, value: 0, step: 1 }).addClass(this.myClass('slider'))
                .on('input', function(e) { self.stopPlay(); self.show(+e.target.value); }).end()
              .start('div').addClass(this.myClass('hint')).add(this.SLIDER_HINT).end()
              .start('div').addClass(this.myClass('status')).add(this.status$).end()
            .end()
          .end()
        .end();

      // The scene's viewport follows the host element's size; the ribbon follows its column.
      this.hostEl.el().then(function(el) {
        var size = function() { self.scene.viewWidth = el.clientWidth; self.scene.viewHeight = el.clientHeight; };
        new ResizeObserver(size).observe(el);
        size();
        if ( self.grammar ) self.useGrammar(self.grammar);
      });
      this.ribbonEl.el().then(function(el) {
        var size = function() { self.ribbon.width = el.clientWidth; };
        new ResizeObserver(size).observe(el);
        size();
      });
      this.ribbon.text = this.input;

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
      /** Rebuilds the strips for a grammar and frames them; any recorded trace is dropped. The builder decides the start symbol. */
      this.stopPlay();
      this.grammar = grammar;
      if ( ! grammar ) { this.scene.setStrips([]); this.status = this.NO_GRAMMAR; return; }
      this.builder = this.RailBuilder.create({ grammar: grammar, theme: this.scene.theme, measure: this.scene.measure });
      this.startSymbol = this.builder.startSymbol;
      this.unreachableCount = this.builder.unreachableNames().length;
      this.rebuildStrips();
      this.trace = null;
      this.ribbon.text = this.input; this.ribbon.snapshot = null;
      this.panel.snapshot = null; this.panel.filterParser = null;
      this.status = grammar.symbols.length ? grammar.symbols.length + ' rules, start = ' + this.startSymbol : this.NO_SYMBOLS;
      this.scene.fitWidth();
    },

    function rebuildStrips() {
      /** Strips follow the showAll toggle; the camera is kept (a toggle should not jump the view). */
      if ( ! this.builder ) return;
      this.scene.setStrips(this.builder.buildReachableStrips(this.showAll));
      if ( this.trace ) this.show(this.step);
    },

    // ---- trace lifecycle -------------------------------------------------

    function setInput(text) {
      /** Editing the input invalidates the trace: back to plain text until Start. */
      this.stopPlay();
      this.input = text;
      if ( this.inputEl ) this.inputEl.el().then(function(el) { if ( el.value !== text ) el.value = text; });
      this.trace = null;
      this.ribbon.text = text; this.ribbon.snapshot = null;
      this.scene.applyTrace(null);
      this.panel.snapshot = null;
      this.status = this.NOT_PARSED;
    },

    function record(opt_step) {
      if ( ! this.grammar ) { this.status = this.LOAD_FIRST; return; }
      this.trace = this.ParseTrace.create({ grammar: this.grammar, startSymbol: this.startSymbol, input: this.input }).record();
      this.show(opt_step === undefined ? this.trace.length() : opt_step);
    },

    function show(n) {
      /** Everything visible follows one snapshot. */
      if ( ! this.trace ) return;
      var snap = this.trace.at(n);
      this.step = snap.step;
      this.scene.applyTrace(snap);
      this.ribbon.snapshot = snap;
      this.panel.snapshot = snap;
      this.status = snap.summary();
      if ( this.sliderEl ) this.sliderEl.el().then(function(el) { el.max = snap.total; el.value = snap.step; });
    },

    function stepBack() { this.stopPlay(); if ( this.trace ) this.show(this.step - 1); },
    function stepOne()  { this.stopPlay(); if ( ! this.trace ) this.record(0); else this.show(this.step + 1); },
    function stepOver() { this.stopPlay(); if ( ! this.trace ) this.record(0); else this.show(this.trace.stepOverFrom(this.step)); },
    function nextRule() { this.stopPlay(); if ( ! this.trace ) this.record(0); else this.show(this.trace.nextRuleFrom(this.step)); },
    function runToEnd() { this.stopPlay(); if ( ! this.trace ) this.record(); else this.show(this.trace.length()); },

    function togglePlay() {
      /** Auto-step at a human pace; stops at the end or on any other navigation. Background tabs throttle timers. */
      if ( this.playTimer_ ) { this.stopPlay(); return; }
      if ( ! this.trace ) this.record(0);
      if ( ! this.trace ) return;                                  // no grammar
      if ( this.step >= this.trace.length() ) this.show(0);
      var self = this;
      this.playTimer_ = setInterval(function() {
        if ( self.step >= self.trace.length() ) { self.stopPlay(); return; }
        self.show(self.step + 1);
      }, this.PLAY_INTERVAL_MS);
      if ( this.playBtn ) this.playBtn.removeAllChildren().add(this.PAUSE);
    },

    function stopPlay() {
      if ( ! this.playTimer_ ) return;
      clearInterval(this.playTimer_);
      this.playTimer_ = null;
      if ( this.playBtn ) this.playBtn.removeAllChildren().add(this.PLAY);
    },

    function highlight(parser) { this.scene.highlightParser(parser); },

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
      /** Click policy. Rule reference: shift-click jumps to its definition, plain click unfolds/folds. Rule name: list its runs. */
      if ( this.RailSymRef.isInstance(el) ) {
        if ( e.shiftKey ) { this.scene.centerOnStrip(el.name); return; }
        if ( el.canUnfold() || el.unfolded ) { el.toggle(); this.afterToggle(el); }
        return;
      }
      if ( this.RailStrip.isInstance(el) ) {
        // Rule name clicked: list that rule's runs in the panel (click again to go back).
        var same = this.panel.filterParser === el.parser;
        this.panel.filterName   = el.name;
        this.panel.filterParser = same ? null : el.parser;
      }
    },

    function afterToggle(el) {
      /** Freshly built (or removed) content needs the current lights. */
      this.scene.hideTooltip();
      if ( this.trace ) this.show(this.step);
    }
  ]
});
