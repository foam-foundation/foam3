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
    The page: a scene host sized by a ResizeObserver, a toolbar, a legend, and
    the trace column (input ribbon, document view, derivation panel, controls).
    Composition and wiring only: the scene owns the elements and the pointer
    (drag pans, wheel zooms, hover tooltips, clicks come back through onHit),
    the builder owns the mapping, ParseTrace owns the parse; show(n) hands one
    snapshot to scene, ribbon, document view, panel and status line.
  `,

  requires: [
    'foam.parse.Grammar',
    'foam.parse.GrammarAxiom',
    'foam.parse.rail.DerivationPanel',
    'foam.parse.rail.DocumentView',
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
    ^ { font-family: sans-serif; display: flex; flex-direction: column; height: 100vh; box-sizing: border-box; overflow: hidden; background: #fff; }
    ^bar { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; padding: 6px 8px; border-bottom: 1px solid $foam.parse.rail.RailTheme.line; flex: none; }
    ^title { font-weight: bold; margin-right: 6px; }
    ^main { flex: 1; min-height: 0; display: flex; }
    ^left { flex: 1; min-width: 0; position: relative; }
    ^host { position: absolute; inset: 0; overflow: hidden; touch-action: none; }
    ^ribbon canvas { display: block; }
    ^legendPanel { position: absolute; left: 8px; bottom: 8px; max-width: 62%; max-height: 70%; overflow: auto; background: rgba(255,255,255,0.96);
                   border: 1px solid $foam.parse.rail.RailTheme.line; border-radius: 6px; padding: 8px 10px; font-size: 12px; color: $foam.parse.rail.RailTheme.inkSecondary; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
    ^legendGroup { display: flex; flex-wrap: wrap; gap: 3px 12px; align-items: baseline; margin: 2px 0 6px; }
    ^right { flex: none; display: flex; flex-direction: column; min-height: 0; }
    ^split { flex: none; width: 7px; cursor: col-resize; background: #eee; border-left: 1px solid $foam.parse.rail.RailTheme.line; border-right: 1px solid $foam.parse.rail.RailTheme.line; }
    ^split:hover { background: #d6e8f5; }
    .foam-u2-TooltipView { background: rgba(34, 34, 34, 0.92); color: $foam.parse.rail.RailTheme.inkOnDark; }   /* u2 turns title= into a tooltip whose colours come from theme tokens; the demo has no theme */
    ^section { padding: 6px 8px; border-bottom: 1px solid $foam.parse.rail.RailTheme.lineSoft; flex: none; }
    ^row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
    ^row select, ^row input[type=text] { min-width: 0; flex: 1; }
    ^gram textarea { width: 100%; box-sizing: border-box; font-size: 12px; font-family: monospace; height: 140px; margin: 6px 0 4px; }
    ^input { width: 100%; box-sizing: border-box; font-size: 13px; font-family: monospace; height: 30px; resize: vertical; }
    ^transport { display: flex; gap: 4px; margin: 6px 0 4px; }
    ^transport button { flex: 1; padding: 3px 0; white-space: nowrap; }
    ^slider { width: 100%; margin: 0; }
    ^ribbon { flex: none; overflow: hidden; border-bottom: 1px solid $foam.parse.rail.RailTheme.lineSoft; }
    ^doc { flex: 1 1 45%; min-height: 0; display: flex; flex-direction: column; border-bottom: 1px solid $foam.parse.rail.RailTheme.line; }
    ^docToggle { font-size: 12px; margin-left: auto; white-space: nowrap; }
    ^status { font-size: 12px; font-family: monospace; white-space: pre-wrap; overflow-wrap: anywhere; min-height: 2.6em; padding: 4px 8px; border-bottom: 1px solid $foam.parse.rail.RailTheme.line; background: #fafafa; flex: none; }
    ^panel { flex: 1; min-height: 0; overflow: auto; padding: 6px 0; }
    ^swatch { font-weight: bold; }
    ^toggle { cursor: pointer; color: $foam.parse.rail.RailTheme.matched; font-size: 12px; user-select: none; }
    ^hint { color: $foam.parse.rail.RailTheme.inkMuted; font-size: 12px; }
  `,

  messages: [
    { name: 'HINT',              message: 'drag = pan · wheel = zoom · hover = tooltip' },
    { name: 'TITLE',             message: 'foam.parse.rail' },
    { name: 'LEGEND_TOGGLE',     message: 'Legend' },
    { name: 'DOC_TOGGLE',        message: 'Document view' },
    { name: 'TIP_SPLIT',         message: 'drag to resize the panel' },
    { name: 'EDIT_GRAMMAR',      message: 'edit grammar' },
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
    { name: 'LEGEND_MATCHED',    message: '✓ matched' },
    { name: 'LEGEND_TRYING',     message: '▶ trying' },
    { name: 'LEGEND_FAILED',     message: '✗ failed' },
    { name: 'LEGEND_HISTORY',    message: '✓ ran earlier, rule idle now' },
    { name: 'LEGEND_NEVER',      message: 'not reached' },
    { name: 'VALUES_TOGGLE',     message: 'values on boxes' },
    { name: 'LANES_TOGGLE',      message: 'values per rule' },
    { name: 'LEGEND_VALUES',     message: 'text under a box = what it matched so far, in order (…+n = more, hover lists them) · row under a rule = every value that rule matched' },
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
    { name: 'START',             message: 'Parse' },
    { name: 'BACK',              message: '◀' },
    { name: 'STEP_ONE',          message: '▶' },
    { name: 'STEP_OVER',         message: '⏭ over' },
    { name: 'NEXT_RULE',         message: '⏭ rule' },
    { name: 'PLAY',              message: '▶▶ play' },
    { name: 'PAUSE',             message: '❚❚ pause' },
    { name: 'RUN_TO_END',        message: '⏭⏭ end' },
    { name: 'TIP_PARSE',         message: 'record the parse of the input, then stand at step 0' },
    { name: 'TIP_BACK',          message: 'one event back' },
    { name: 'TIP_STEP',          message: 'one event forward' },
    { name: 'TIP_OVER',          message: 'skip to the end of the attempt just started' },
    { name: 'TIP_RULE',          message: 'skip to the next rule entry' },
    { name: 'TIP_PLAY',          message: 'auto-step; any other button pauses' },
    { name: 'TIP_END',           message: 'jump to the last event' },
    { name: 'SLIDER_HINT',       message: 'scrub through the recorded parse' },
    { name: 'NOT_PARSED',        message: 'input changed — press Start to parse it' },
    { name: 'LOAD_FIRST',        message: 'load a grammar first' },
    { name: 'PRESET_PLACEHOLDER',     message: 'preset…' },
    { name: 'REGISTERED_PLACEHOLDER', message: 'registered in this page…' },
    { name: 'CLASS_ID_PLACEHOLDER',   message: 'class id, Enter' },
    { name: 'TYPED_TITLE',            message: 'body of a foam.parse symbols() function (dev only)' },
    { name: 'LOAD_TYPED',             message: 'Load grammar' },
    { name: 'FIND_PLACEHOLDER',       message: 'find rule…' },
    { name: 'UNFOLD_PATH',            message: 'Unfold path' },
    { name: 'FOLD_ALL',               message: 'Fold all' },
  ],

  constants: {
    PANEL_WIDTH: 440,      // right column default width (px)
    PANEL_MIN: 240,        // splitter floor for either column (px)
    DOC_SHARE: 0.5,        // opening the document view widens the right column to this share of the window
    PLAY_INTERVAL_MS: 140, // auto-step pace
    // The foam.parse.Parsers vocabulary injected into typed grammar text, by parameter name.
    PARSER_NAMES: [ 'seq', 'seq0', 'seq1', 'alt', 'repeat', 'repeat0', 'plus', 'optional', 'sym', 'literal', 'literalIC',
                    'range', 'chars', 'notChars', 'anyChar', 'eof', 'not', 'peek', 'until', 'until0', 'join', 'substring', 'str' ],
    DEFAULT_PRESETS: {
      'comma list (toy)': { input: '[1, [ab, 22], x]', grammar: "{\n  START:   alt(seq(sym('list'), eof()), seq(sym('keyword'), eof())),\n  list:    seq(literal('['), optional(sym('ws')), repeat(sym('item'), seq(optional(sym('ws')), literal(','), optional(sym('ws')))), optional(sym('ws')), literal(']')),\n  item:    alt(sym('number'), sym('word'), sym('list')),\n  number:  plus(range('0', '9')),\n  word:    plus(range('a', 'z')),\n  ws:      plus(literal(' ')),\n  keyword: alt(literal('do'), literal('double'))\n}" },
      'key=value pairs': { input: 'name=alex;city="new york";tz=est', grammar: "{\n  START: seq(sym('pair'), repeat(seq(literal(';'), sym('pair'))), eof()),\n  pair:  seq(sym('key'), literal('='), sym('value')),\n  key:   plus(range('a', 'z')),\n  value: alt(sym('quoted'), sym('bare')),\n  quoted: seq(literal('\"'), repeat(notChars('\"')), literal('\"')),\n  bare:  plus(notChars(';'))\n}" },
      'ordered-choice trap': { input: 'integer', grammar: "{\n  START: seq(sym('word'), eof()),\n  word:  alt(literal('in'), literal('int'), literal('integer'))\n}" },
      'gates and badges': { input: '/* hi */"x"', grammar: "{\n  START:   seq(sym('comment'), sym('quoted'), eof()),\n  comment: seq(literal('/*'), until(literal('*/'))),\n  quoted:  seq(literal('\"'), repeat(not(literal('\"'), anyChar())), literal('\"')),\n  upper:   str(plus(range('a', 'z')))\n}" },
      'BAD: loop over empty match': { input: 'b', grammar: "{\n  START: seq(sym('as'), eof()),\n  as:    repeat(optional(literal('a')))\n}" },
      'BAD: left recursion': { input: '1,2', grammar: "{\n  START: seq(sym('list'), eof()),\n  list:  alt(seq(sym('list'), literal(','), sym('item')), sym('item')),\n  item:  range('0', '9')\n}" }
    }
  },

  properties: [
    { name: 'grammar', documentation: 'A foam.parse.Grammar; set it (or call useGrammar) to draw.' },
    { name: 'scene',   factory: function() { return this.RailScene.create(); } },
    { name: 'builder' },
    { class: 'String', name: 'startSymbol' },
    { class: 'String', name: 'status' },
    { class: 'Boolean', name: 'showAll', documentation: 'Include rules unreachable from the start symbol.', postSet: function() { this.rebuildStrips(); } },
    { class: 'Int', name: 'unreachableCount' },
    { class: 'String', name: 'findText', documentation: 'Substring filter on rule names; empty = every rule.', postSet: function() { this.rebuildStrips(); } },
    { class: 'String', name: 'input', value: '' },
    { name: 'trace', documentation: 'The recorded ParseTrace, or null before Start.' },
    { class: 'Int', name: 'step' },
    { name: 'ribbon', factory: function() { return this.RailInputRibbon.create({ theme: this.scene.theme, measure: this.scene.measure }); } },
    { name: 'panel',  factory: function() { var self = this; return this.DerivationPanel.create({ onSelect: function(p) { self.highlight(p); } }); } },
    { name: 'doc',    factory: function() { var self = this; return this.DocumentView.create({ onSelect: function(p) { self.highlight(p); } }); } },
    { name: 'hostEl' },
    { name: 'inputEl' },
    { name: 'sliderEl' },
    { name: 'playBtn' },
    { name: 'ribbonEl' },
    { name: 'playTimer_' },
    { name: 'presets', factory: function() { return this.DEFAULT_PRESETS; }, documentation: 'name -> { input, grammar: symbols() body as text }.' },
    { class: 'Boolean', name: 'allowTypedGrammar', documentation: 'Dev only: show the textarea that compiles typed grammar text. Off by default; the demo page turns it on.' },
    { class: 'String', name: 'grammarText' },
    { name: 'grammarEl' },
    { name: 'registeredEl' },
    { name: 'classIdEl' },
    { name: 'registered_', factory: function() { return []; }, documentation: '[{ label, load }] grammars found in the page by scanRegistered().' },
    { class: 'Boolean', name: 'legendShown',  documentation: 'Legend panel over the canvas corner; off by default.' },
    { class: 'Boolean', name: 'grammarShown', documentation: 'Typed-grammar editor unfolded (dev only).' },
    { class: 'Boolean', name: 'documentShown', documentation: 'Whole input as decorated text in place of the one-line ribbon.',
      postSet: function(_, on) { if ( on && this.rightWidth === this.PANEL_WIDTH ) this.rightWidth = Math.max(this.PANEL_WIDTH, Math.round(window.innerWidth * this.DOC_SHARE)); } },
    { class: 'Int', name: 'rightWidth', factory: function() { return this.PANEL_WIDTH; }, documentation: 'Right column width in px; the splitter drags it, opening the document view widens it once.' },
    { class: 'Boolean', name: 'debugHook', documentation: 'Expose window.__rail so scripted checks can drive the page deterministically.' }
  ],

  methods: [
    function render() {
      var self = this;
      this.addClass(this.myClass())
        .start('div').addClass(this.myClass('bar')).call(function() { self.renderBar(this); }).end()
        .start('div').addClass(this.myClass('main'))
          .start('div').addClass(this.myClass('left')).call(function() { self.renderCanvas(this); }).end()
          .start('div').addClass(this.myClass('split')).attrs({ title: this.TIP_SPLIT }).on('pointerdown', function(e) { self.startSplit(e); }).end()
          .start('div').addClass(this.myClass('right')).style({ width: this.rightWidth$.map(function(w) { return w + 'px'; }) })
            .call(function() { self.renderPanels(this); })
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
      this.doc.text = this.input;

      // The scene owns the pointer; clicks that did not drag come back here.
      this.scene.onHit = function(el, e) { self.onHit(el, e); };

      this.scanRegistered();

      if ( this.debugHook && typeof window !== 'undefined' ) {
        window.__rail = {
          view:  this,
          hit:   function(vx, vy) {
            var r = self.scene.viewport_.element_.getBoundingClientRect();
            var h = self.scene.elementAt({ target: document.elementFromPoint(r.left + vx, r.top + vy) });
            return h ? { cls: h.cls_.name, tip: h.tipText ? h.tipText() : '', path: h.pathKey } : null;
          },
          show:  function(n) { self.show(n); return self.status; },
          step:  function() { return self.step; },
          total: function() { return self.trace ? self.trace.length() : 0; },
          strips: function() { return self.scene.strips.map(function(s) { return s.name; }); }
        };
      }
    },

    function renderBar(e) {
      /** Top toolbar: camera, rule filter, find/unfold, cache and legend toggles. */
      var self = this;
      e.start('span').addClass(this.myClass('title')).add(this.TITLE).end()
        .start('button').add(this.FIT_WIDTH).on('click', function() { self.scene.fitWidth(); }).end()
        .start('button').add(this.FIT_ALL).on('click', function() { self.scene.fitAll(); }).end()
        .start('label')
          .start('input').attrs({ type: 'checkbox' }).on('change', function(e) { self.showAll = e.target.checked; }).end()
          .add(' ', this.ALL_RULES, ' (', this.unreachableCount$, ' ', this.UNREACHABLE_WORD, ')')
        .end()
        .start('input').attrs({ placeholder: this.FIND_PLACEHOLDER })
          .on('input', function(e) { self.findText = e.target.value.trim(); })
          .on('keydown', function(e) { if ( e.key === 'Enter' && self.scene.strips.length ) self.goToRule(self.scene.strips[0].name); })
        .end()
        .start('button').add(this.UNFOLD_PATH).on('click', function() { self.unfoldPath(); }).end()
        .start('button').add(this.FOLD_ALL).on('click', function() { self.foldAll(); }).end()
        .start('label')
          .start('input').attrs({ type: 'checkbox', checked: this.scene.showValues$ }).on('change', function(e) { self.scene.showValues = e.target.checked; }).end()
          .add(' ', this.VALUES_TOGGLE)
        .end()
        .start('label')
          .start('input').attrs({ type: 'checkbox', checked: this.scene.showLanes$ }).on('change', function(e) { self.scene.showLanes = e.target.checked; }).end()
          .add(' ', this.LANES_TOGGLE)
        .end()
        .start('label')
          .start('input').attrs({ type: 'checkbox', checked: this.legendShown$ }).on('change', function(e) { self.legendShown = e.target.checked; }).end()
          .add(' ', this.LEGEND_TOGGLE)
        .end()
        .start('span').addClass(this.myClass('hint')).add(this.HINT).end();
    },

    function renderCanvas(e) {
      /** Left column: the scene host and the legend under it. */
      var self = this, T = this.scene.theme, O = this.Outcome;
      var tone = function(outcome) { return { color: T.outcomeColor(outcome) }; };
      var legendGroup = function(e, title) { return e.start('div').addClass(self.myClass('legendGroup')).start('b').add(title).end(); };
      // Swatch carries the colour or the fade; the words stay full contrast, so a dim
      // state is never explained by dim text.
      var swatch = function(e, style, label) {
        return e.start('span')
          .start('span').addClass(self.myClass('swatch')).style(style).add('▬').end()
          .add(' ' + label)
        .end();
      };
      e.start('div', null, this.hostEl$).addClass(this.myClass('host')).add(this.scene).end()
        .start('div').addClass(this.myClass('legendPanel')).show(this.legendShown$)
          .call(function() {
            legendGroup(this, self.LEGEND_NOTATION)
              .start('span').add(self.LEGEND_TERMINAL).end()
              .start('span').add(self.LEGEND_RULE_REF).end()
              .start('span').add(self.LEGEND_END_STOP).end()
              .start('span').add(self.LEGEND_PRIORITY).end()
              .start('span').add(self.LEGEND_LOOP).end()
              .start('span').add(self.LEGEND_MIN).end()
              .start('span').add(self.LEGEND_BYPASS).end()
              .start('span').add(self.LEGEND_GENERIC).end()
              .start('span').add(self.LEGEND_UNFOLD).end()
              .start('span').add(self.LEGEND_UNREACH).end()
              .start('span').add(self.LEGEND_GATE).end()
              .start('span').add(self.LEGEND_BADGES).end()
            .end();
            legendGroup(this, self.LEGEND_TRACE)
              .call(function() { swatch(this, tone(O.MATCHED), self.LEGEND_MATCHED); })
              .call(function() { swatch(this, tone(O.TRYING),  self.LEGEND_TRYING); })
              .call(function() { swatch(this, tone(O.FAILED),  self.LEGEND_FAILED); })
              .call(function() { swatch(this, { color: T.outcomeColor(O.MATCHED), opacity: self.Tier.HISTORY.alpha }, self.LEGEND_HISTORY); })
              .call(function() { swatch(this, { color: T.resolve('text'), opacity: self.Tier.NEVER.alpha }, self.LEGEND_NEVER); })
              .start('span').add(self.LEGEND_VALUES).end()
              .start('span').add(self.LEGEND_COUNTER).end()
              .start('span').add(self.LEGEND_SELECTED).end()
            .end();
            legendGroup(this, self.LEGEND_RIBBON)
              .start('span').style({ background: T.resolve('consumedBg') }).add(self.LEGEND_CONSUMED).end()
              .start('span').style({ borderBottom: '3px solid ' + T.outcomeColor(O.TRYING) }).add(self.LEGEND_OPEN).end()
              .start('span').style({ background: T.resolve('failBg') }).add(self.LEGEND_DIED).end()
              .start('span').style({ border: '1px dashed ' + T.resolve('muted'), padding: '0 3px' }).add(self.LEGEND_CURRENT).end()
              .start('span').style({ border: '2px solid ' + T.outcomeColor(O.TRYING), padding: '0 3px' }).add(self.LEGEND_UNDER_TEST).end()
              .start('span').add(self.LEGEND_CARET).end()
            .end();
            legendGroup(this, self.LEGEND_DERIV)
              .start('span').style(tone(O.MATCHED)).add(self.LEGEND_DERIV_MATCHED).end()
              .start('span').style(tone(O.TRYING)).add(self.LEGEND_DERIV_OPEN).end()
            .end();
          })
        .end();
    },

    function renderPanels(e) {
      /** Right column: grammar sources, input + transport, then ribbon or document view, status, derivation. */
      var self = this;
      e.start('div').addClass(this.myClass('section')).addClass(this.myClass('gram'))
          .start('div').addClass(this.myClass('row'))
            .start('select').on('change', function(e) { if ( e.target.value ) self.usePreset(e.target.value); })
              .start('option').attrs({ value: '' }).add(this.PRESET_PLACEHOLDER).end()
              .forEach(Object.keys(this.presets), function(k) { this.start('option').attrs({ value: k }).add(k).end(); })
            .end()
            .start('select', null, this.registeredEl$).on('change', function(e) { if ( e.target.value ) self.loadRegistered(e.target.value); })
              .start('option').attrs({ value: '' }).add(this.REGISTERED_PLACEHOLDER).end()
            .end()
            .start('input', null, this.classIdEl$).attrs({ type: 'text', placeholder: this.CLASS_ID_PLACEHOLDER })
              .on('keydown', function(e) { if ( e.key === 'Enter' ) self.loadClassId(e.target.value.trim()); }).end()
            .callIf(this.allowTypedGrammar, function() {
              this.start('span').addClass(self.myClass('toggle'))
                .add(self.grammarShown$.map(function(o) { return ( o ? '▾ ' : '▸ ' ) + self.EDIT_GRAMMAR; }))
                .on('click', function() { self.grammarShown = ! self.grammarShown; })
              .end();
            })
          .end()
          .callIf(this.allowTypedGrammar, function() {
            this.start('div').show(self.grammarShown$)
              .start('div').addClass(self.myClass('hint')).add(self.TYPED_TITLE).end()
              .start('textarea', null, self.grammarEl$).attrs({ value: self.grammarText$, spellcheck: false }).on('input', function(e) { self.grammarText = e.target.value; }).end()
              .start('button').add(self.LOAD_TYPED).on('click', function() { self.loadTyped(); }).end()
            .end();
          })
        .end()
        .start('div').addClass(this.myClass('section'))
          .start('textarea', null, this.inputEl$).addClass(this.myClass('input')).attrs({ value: this.input$, spellcheck: false }).on('input', function(e) { self.setInput(e.target.value); }).end()
          .start('div').addClass(this.myClass('transport'))
            .start('button').attrs({ title: this.TIP_PARSE }).add(this.START).on('click', function() { self.stopPlay(); self.record(0); }).end()
            .start('button').attrs({ title: this.TIP_BACK }).add(this.BACK).on('click', function() { self.stepBack(); }).end()
            .start('button').attrs({ title: this.TIP_STEP }).add(this.STEP_ONE).on('click', function() { self.stepOne(); }).end()
            .start('button').attrs({ title: this.TIP_OVER }).add(this.STEP_OVER).on('click', function() { self.stepOver(); }).end()
            .start('button').attrs({ title: this.TIP_RULE }).add(this.NEXT_RULE).on('click', function() { self.nextRule(); }).end()
            .start('button', null, this.playBtn$).attrs({ title: this.TIP_PLAY }).add(this.PLAY).on('click', function() { self.togglePlay(); }).end()
            .start('button').attrs({ title: this.TIP_END }).add(this.RUN_TO_END).on('click', function() { self.runToEnd(); }).end()
          .end()
          .start('input', null, this.sliderEl$).attrs({ type: 'range', min: 0, max: 0, value: 0, step: 1, title: this.SLIDER_HINT }).addClass(this.myClass('slider'))
            .on('input', function(e) { self.stopPlay(); self.show(+e.target.value); }).end()
          .start('label').addClass(this.myClass('docToggle'))
            .start('input').attrs({ type: 'checkbox', checked: this.documentShown$ }).on('change', function(e) { self.documentShown = e.target.checked; }).end()
            .add(' ', this.DOC_TOGGLE)
          .end()
        .end()
        .start('div', null, this.ribbonEl$).addClass(this.myClass('ribbon')).hide(this.documentShown$).add(this.ribbon).end()
        .start('div').addClass(this.myClass('doc')).show(this.documentShown$).add(this.doc).end()
        .start('div').addClass(this.myClass('status')).add(this.status$).end()
        .start('div').addClass(this.myClass('panel')).add(this.panel).end();
    },

    // ---- grammar sources -------------------------------------------------

    function compileGrammar(text) {
      /**
       * The text is the body of a foam.parse symbols() function; the Parsers vocabulary
       * is injected by parameter name. Grammar.SYMBOLS.adapt reads those names off
       * fn.toString() with a single-line regex, so the parameter list stays on ONE line.
       * Dev-only: this evaluates typed code on the user's own page.
       */
      var fn = new Function('return function(' + this.PARSER_NAMES.join(', ') + ') { return (' + text + '); };')();
      return this.Grammar.create({ symbols: fn });
    },

    function loadTyped() {
      if ( ! this.allowTypedGrammar ) return;
      try { this.useGrammar(this.compileGrammar(this.grammarText)); }
      catch (x) { this.status = 'grammar error: ' + ( x.message || x ); }
    },

    function usePreset(name) {
      /** A preset swaps grammar and sample input together and loads at once. */
      var p = this.presets[name];
      if ( ! p ) return;
      this.grammarText = p.grammar;
      this.syncGrammarEl();
      this.setInput(p.input);
      try { this.useGrammar(this.compileGrammar(p.grammar)); }
      catch (x) { this.status = 'preset error: ' + ( x.message || x ); }
    },

    function syncGrammarEl() {
      var self = this;
      if ( this.grammarEl ) this.grammarEl.el().then(function(el) { el.value = self.grammarText; });
    },

    function scanRegistered() {
      /**
       * Grammars already in this page: classes that extend foam.parse.Grammar or declare
       * grammars: axioms. Built classes are inspected directly; lazy models are peeked at
       * (extends / grammars keys) before building, because building everything is slow and
       * floods the console with unrelated errors.
       */
      var self = this, found = [];
      var consider = function(id) {
        try {
          var cls = foam.lookup(id, true);
          if ( ! cls || ! cls.getAxiomsByClass ) return;
          if ( self.Grammar.isSubClass(cls) && cls !== self.Grammar ) found.push({ label: id, load: function() { return cls.create(); } });
          cls.getAxiomsByClass(self.GrammarAxiom).forEach(function(ax) {
            found.push({ label: id + '.' + ax.name, load: function() { return cls.create()[ax.name]; } });
          });
        } catch (x) { /* a class that refuses to build is not a grammar we can show */ }
      };
      Object.keys(foam.USED || {}).forEach(consider);
      Object.keys(foam.UNUSED || {}).forEach(function(id) {
        var m = foam.UNUSED[id];
        if ( m && ( m.extends === 'foam.parse.Grammar' || ( m.grammars && m.grammars.length ) ) ) consider(id);
      });
      found.sort(function(a, b) { return a.label < b.label ? -1 : 1; });
      this.registered_ = found;
      if ( this.registeredEl ) this.registeredEl.el().then(function(el) {
        found.forEach(function(f, i) { var o = document.createElement('option'); o.value = String(i); o.textContent = f.label; el.appendChild(o); });
      });
    },

    function loadRegistered(i) {
      try {
        var f = this.registered_[+i];
        this.grammarText = '// loaded from ' + f.label + ' (read-only; pick a preset to type your own)';
        this.syncGrammarEl();
        this.useGrammar(f.load());
      } catch (x) { this.status = 'could not load: ' + ( x.message || x ); }
    },

    function loadClassId(id) {
      /** Third path: a class id typed by hand. Grammar subclass, or Class.axiomName for a grammars: axiom. */
      var parts = id.split('.'), cls = foam.lookup(id, true), ax = null;
      if ( ! cls && parts.length > 1 ) { cls = foam.lookup(parts.slice(0, -1).join('.'), true); ax = parts[parts.length - 1]; }
      if ( ! cls ) { this.status = 'no class ' + id; return; }
      try {
        var obj = cls.create();
        var g = ax ? obj[ax] : obj;
        if ( ! this.Grammar.isInstance(g) ) { this.status = id + ' is not a grammar'; return; }
        this.useGrammar(g);
      } catch (x) { this.status = 'could not load ' + id + ': ' + ( x.message || x ); }
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
      this.doc.text = this.input; this.doc.snapshot = null;
      this.panel.snapshot = null; this.panel.filterParser = null;
      this.status = grammar.symbols.length ? grammar.symbols.length + ' rules, start = ' + this.startSymbol : this.NO_SYMBOLS;
      this.scene.fitWidth();
    },

    function rebuildStrips() {
      /** Strips follow the showAll toggle; the camera is kept (a toggle should not jump the view). */
      if ( ! this.builder ) return;
      this.scene.setStrips(this.builder.buildReachableStrips(this.showAll, this.findText));
      if ( this.trace ) this.show(this.step);
    },

    function goToRule(name) {
      if ( ! this.scene.stripFor(name) ) this.findText = '';     // filtered out: show all again first
      this.scene.flashStrip(name);
    },

    function unfoldPath() {
      /** Open every rule reference on the derivation path, inside the start strip only, top-down; then re-light and re-fit. */
      if ( ! this.trace ) return;
      var self = this, snap = this.trace.at(this.step);
      if ( ! snap.derivation ) return;
      var startStrip = this.scene.stripFor(this.startSymbol);
      var inStart = function(el) { for ( var p = el ; p ; p = p.parent ) if ( p === startStrip ) return true; return false; };
      var todo = [ snap.derivation ], node;
      while ( todo.length ) {                                    // explicit stack: a recursion staircase is deep
        node = todo.pop();
        if ( foam.parse.Symbol.isInstance(node.parser) ) {
          self.scene.elementsFor(node.parser).forEach(function(el) { if ( self.RailSymRef.isInstance(el) && inStart(el) ) el.unfold(); });
        }
        for ( var i = node.kids.length - 1 ; i >= 0 ; i-- ) todo.push(node.kids[i]);
      }
      this.scene.rebuildStrip(startStrip);
      this.show(this.step);
      this.scene.fitWidth();
    },

    function foldAll() {
      var self = this, open;
      do {
        open = [];
        this.scene.eachElement(function(el) { if ( self.RailSymRef.isInstance(el) && el.unfolded ) open.push(el); });
        open.forEach(function(el) { el.fold(); });
      } while ( open.length );
      this.scene.strips.forEach(function(s) { self.scene.rebuildStrip(s); });
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
      this.doc.text = text; this.doc.snapshot = null;
      this.scene.applyTrace(null);
      this.panel.snapshot = null;
      this.status = this.NOT_PARSED;
    },

    function record(opt_step) {
      if ( ! this.grammar ) { this.status = this.LOAD_FIRST; return; }
      this.trace = this.ParseTrace.create({ grammar: this.grammar, startSymbol: this.startSymbol, input: this.input }).record();
      this.show(opt_step === undefined ? this.trace.length() : opt_step);   // the camera stays where the user put it; follow-pan takes over while stepping
    },

    function show(n) {
      /** Everything visible follows one snapshot. */
      if ( ! this.trace ) return;
      var snap = this.trace.at(n);
      this.step = snap.step;
      this.scene.applyTrace(snap);
      this.ribbon.snapshot = snap;
      this.doc.snapshot = snap;
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

    function startSplit(e) {
      /** Splitter drag: the right column follows the pointer until release. */
      var self = this, x0 = e.clientX, w0 = this.rightWidth;
      var move = function(ev) { self.rightWidth = Math.max(self.PANEL_MIN, Math.min(window.innerWidth - self.PANEL_MIN, w0 + x0 - ev.clientX)); };
      var up = function() { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
      e.preventDefault();
    },

    // ---- clicks (the scene resolves the element) ----------------------------

    function onHit(el, e) {
      /** Click policy. Rule reference: shift-click jumps to its definition, plain click unfolds/folds. Rule name: list its runs. */
      if ( this.RailSymRef.isInstance(el) ) {
        if ( e.shiftKey ) { this.goToRule(el.name); return; }
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
      /** Freshly built (or removed) content needs the strip redrawn and the current lights. */
      this.scene.hideTooltip();
      var strip = this.scene.stripOf(el);
      if ( strip ) this.scene.rebuildStrip(strip);
      if ( this.trace ) this.show(this.step);
    }
  ]
});
