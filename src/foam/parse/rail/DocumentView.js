/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.rail',
  name: 'DocumentView',
  extends: 'foam.u2.View',

  documentation: `
    The whole input as scrollable text, decorated from one TraceSnapshot: the
    three text states (consumed / under test / not reached, plus the char a
    failed parse died on) as backgrounds, and every rule activation on the
    match path as a nested span with a label chip naming the rule above its
    first character. Rules only, terminals are not labelled. Columns stay put:
    chips are positioned over the text, never inserted into it. Click a chip to
    locate the rule on the canvas. tokens() is the pure part: it turns text +
    snapshot into a flat open/text/close stream the render walks.
  `,

  requires: [ 'foam.parse.rail.RailTheme' ],

  css: `
    ^ { display: flex; flex-direction: column; min-height: 0; font: 13px sans-serif; color: #222; }
    ^legend { flex: none; display: flex; flex-wrap: wrap; gap: 3px 10px; align-items: baseline; padding: 4px 8px; font-size: 12px; color: #444; border-bottom: 1px solid #eee; }
    ^legend b { font-weight: normal; padding: 0 3px; }
    ^body { flex: 1; min-height: 0; overflow: auto; padding: 4px 8px 8px; }
    ^line { position: relative; font: 13px/1.5 monospace; white-space: pre; color: #222; min-height: 1.5em; }
    ^consumed { background: #d6e8f5; }
    ^open { background: #fff1cc; }
    ^probe { outline: 2px solid #E69F00; outline-offset: -1px; }
    ^died { background: #f8d9c4; outline: 2px solid #D55E00; outline-offset: -1px; }
    ^unreached { color: #888; }
    ^rule { border-bottom: 2px solid #0072B2; }   /* colour overridden per depth */
    ^pending { border-bottom-style: dashed; border-bottom-color: #E69F00 !important; }
    ^hot { background: #cfe0f5; }
    ^at { position: absolute; }
    ^chip { display: inline-block; font: 11px/1.2 sans-serif; color: #fff; background: #0072B2; border-radius: 3px; padding: 1px 5px; cursor: pointer; white-space: nowrap; border: 2px solid transparent; }
    ^chip:hover { outline: 2px solid #222; }
    ^chipPending { border: 2px dashed #E69F00; }
    ^depths b { color: #fff; padding: 0 5px; border-radius: 3px; margin-right: 2px; }
    ^empty { color: #666; padding: 4px 8px; }
  `,

  messages: [
    { name: 'LEGEND_TITLE',    message: 'Document:' },
    { name: 'LEGEND_CONSUMED', message: 'consumed' },
    { name: 'LEGEND_OPEN',     message: 'attempt in progress' },
    { name: 'LEGEND_PROBE',    message: 'char under test' },
    { name: 'LEGEND_DIED',     message: 'char it died on' },
    { name: 'LEGEND_UNREACH',  message: 'not reached' },
    { name: 'LEGEND_CHIP',     message: 'chip = rule that matched the text under it · click to locate' },
    { name: 'LEGEND_DEPTH',    message: 'colour = nesting depth' },
    { name: 'LEGEND_PENDING',  message: 'dashed = still open' },
    { name: 'EMPTY',           message: 'no input' }
  ],

  properties: [
    { class: 'String', name: 'text' },
    { name: 'snapshot' },
    { class: 'Function', name: 'onSelect', value: function(parser) {} },
    { name: 'body_' }
  ],

  methods: [
    function render() {
      var self = this;
      this.addClass(this.myClass())
        .start('div').addClass(this.myClass('legend'))
          .add(this.LEGEND_TITLE)
          .start('b').addClass(this.myClass('consumed')).add(this.LEGEND_CONSUMED).end()
          .start('b').addClass(this.myClass('open')).add(this.LEGEND_OPEN).end()
          .start('b').addClass(this.myClass('probe')).add(this.LEGEND_PROBE).end()
          .start('b').addClass(this.myClass('died')).add(this.LEGEND_DIED).end()
          .start('b').addClass(this.myClass('unreached')).add(this.LEGEND_UNREACH).end()
          .start('span').add(this.LEGEND_CHIP).end()
          .start('span').addClass(this.myClass('depths'))
            .forEach(this.DEPTH_PALETTE, function(c, i) { this.start('b').style({ background: c.bg, color: c.fg }).add(i + 1).end(); })
            .add(' ', this.LEGEND_DEPTH)
          .end()
          .start('span').style({ border: '2px dashed #E69F00', padding: '0 4px' }).add(this.LEGEND_PENDING).end()
        .end()
        .start('div', null, this.body_$).addClass(this.myClass('body')).end();
      this.text$.sub(this.rebuild);
      this.snapshot$.sub(this.rebuild);
      this.rebuild();
    },

    function tokens(text, snap) {
      /**
       * Flat stream for the render: { kind: 'open', span, stackSame } opens a rule
       * span (stackSame = how many enclosing spans start at the same char, so their
       * chips stack instead of overlapping), { kind: 'text', text, state } is a run
       * of characters in one state, { kind: 'close' } ends the innermost span.
       * Without a snapshot the whole text is one 'plain' piece. Spans that would
       * label one character or blank space are dropped (see trivial()).
       */
      var out = [];
      if ( ! snap ) { if ( text ) out.push({ kind: 'text', text: text, state: 'plain' }); return out; }
      var self = this, spans = snap.spans().filter(function(s) { return ! self.trivial(text, s); }), stack = [], cursor = 0;
      var endOf = function(s) { return s.end === null ? Math.max(s.start, snap.pos) : s.end; };
      var closeTop = function() { var top = stack.pop(); self.pieces(out, text, snap, cursor, top.end); cursor = Math.max(cursor, top.end); out.push({ kind: 'close' }); };
      spans.forEach(function(s) {
        while ( stack.length && stack[stack.length - 1].end <= s.start ) closeTop();
        self.pieces(out, text, snap, cursor, s.start); cursor = Math.max(cursor, s.start);
        var same = 0;
        for ( var i = 0 ; i < stack.length ; i++ ) if ( stack[i].start === s.start ) same++;
        out.push({ kind: 'open', span: s, stackSame: same });
        stack.push({ start: s.start, end: endOf(s) });
      });
      while ( stack.length ) closeTop();
      this.pieces(out, text, snap, cursor, text.length);
      return out;
    },

    function trivial(text, s) {
      /** A label over one character or over blank space says nothing (digit, nl, ws): no span for it. Open spans always show. */
      if ( s.pending ) return false;
      return s.end - s.start <= 1 || text.substring(s.start, s.end).trim() === '';
    },

    function pieces(out, text, snap, a, b) {
      /** Pushes text tokens for [a, b), split wherever the state changes. */
      if ( a >= b ) return;
      var cuts = [ a, b, snap.pos ], probe = snap.probe, died = snap.finished && ! snap.matched && snap.failPos >= 0 ? snap.failPos : -1;
      if ( snap.tryStart >= 0 ) cuts.push(snap.tryStart);
      if ( probe ) cuts.push(probe.start, probe.end);
      if ( died >= 0 ) cuts.push(died, died + 1);
      cuts = cuts.filter(function(c) { return c > a && c < b; }).concat([ a, b ]).sort(function(x, y) { return x - y; });
      for ( var i = 0 ; i < cuts.length - 1 ; i++ ) {
        var s = cuts[i], e = cuts[i + 1];
        if ( s === e ) continue;
        out.push({ kind: 'text', text: text.substring(s, e), state: this.stateAt(snap, s, probe, died) });
      }
    },

    function stateAt(snap, i, probe, died) {
      if ( probe && i >= probe.start && i < probe.end ) return 'probe';
      if ( i === died ) return 'died';
      if ( i < snap.pos ) return snap.tryStart >= 0 && i >= snap.tryStart ? 'open' : 'consumed';
      return 'unreached';
    },

    function openSpan(parent, sp) {
      /** One DOM span for a rule on one line; the logical span remembers every piece so a chip can light all of them. */
      var el = parent.start('span').addClass(this.myClass('rule')).enableClass(this.myClass('pending'), sp.span.pending)
        .style({ 'border-bottom-color': this.depthColor(sp.span).bg });
      sp.els.push(el);
      return el;
    },

    function depthColor(span) {
      /** Nesting depth picks the colour so siblings match and a rule inside a rule reads as a step down; the palette cycles. */
      return this.DEPTH_PALETTE[( Math.max(1, span.depth) - 1 ) % this.DEPTH_PALETTE.length];
    },

    function placeChips(line) {
      /** Lane packing in document order (outer rule first, so it sits highest): each chip takes the lowest lane free at its column. */
      var self = this, laneEnd = [];
      line.chips.forEach(function(c) {
        var w = c.sp.span.name.length * self.CHIP_CH + self.CHIP_PAD, lane = 0;
        while ( laneEnd[lane] !== undefined && laneEnd[lane] > c.col ) lane++;
        laneEnd[lane] = c.col + w;
        c.lane = lane;
      });
      var lanes = laneEnd.length;
      if ( ! lanes ) return;
      line.el.style({ 'padding-top': ( lanes * this.LANE_H ) + 'px' });
      line.chips.forEach(function(c) {
        var sp = c.sp;
        line.el.start('span').addClass(self.myClass('at')).style({ left: c.col + 'ch', top: ( c.lane * self.LANE_H ) + 'px' })
          .start('span').addClass(self.myClass('chip')).enableClass(self.myClass('chipPending'), sp.span.pending)
            .style({ background: self.depthColor(sp.span).bg, color: self.depthColor(sp.span).fg })
            .add(sp.span.name)
            .on('click', function(e) { e.stopPropagation(); self.onSelect(sp.span.parser); })
            .on('mouseenter', function() { sp.els.forEach(function(el) { el.addClass(self.myClass('hot')); }); })
            .on('mouseleave', function() { sp.els.forEach(function(el) { el.removeClass(self.myClass('hot')); }); })
          .end()
        .end();
      });
    }
  ],

  constants: {
    LANE_H: 17,      // px per chip lane above a line
    CHIP_CH: 0.85,   // chip width per name character, in line-font ch units, for lane packing
    CHIP_PAD: 1.6,   // chip padding, in ch
    DEPTH_PALETTE: [ // Okabe-Ito minus amber, which is the 'still open' state colour
      { bg: '#0072B2', fg: '#fff' },   // blue
      { bg: '#D55E00', fg: '#fff' },   // vermillion
      { bg: '#009E73', fg: '#fff' },   // green
      { bg: '#CC79A7', fg: '#222' },   // purple
      { bg: '#56B4E9', fg: '#222' }    // sky
    ]
  },

  listeners: [
    function rebuild() {
      /**
       * One div per input line; rule spans are re-opened on every line they
       * cross so nesting stays inside the line. Chips sit in lanes above the
       * line they start on: a chip takes the lowest lane whose previous chip
       * ends before it starts, so nothing overlaps and nothing is clipped.
       */
      var self = this, body = this.body_;
      if ( ! body ) return;
      body.removeAllChildren();
      var snap = this.snapshot, text = snap ? snap.input : this.text;
      if ( ! text ) { body.start('div').addClass(this.myClass('empty')).add(this.EMPTY).end(); return; }
      var lines = [], logical = [], dom = [], line, col = 0;
      var newLine = function() {
        line = { el: body.start('div').addClass(self.myClass('line')), chips: [] };
        lines.push(line);
        dom = [ line.el ];
        col = 0;
        logical.forEach(function(sp) { dom.push(self.openSpan(dom[dom.length - 1], sp)); });   // carry open rules onto this line
      };
      var addText = function(str, state) {
        var top = dom[dom.length - 1];
        if ( state === 'plain' ) top.add(str); else top.start('span').addClass(self.myClass(state)).add(str).end();
        col += str.length;
      };
      newLine();
      this.tokens(text, snap).forEach(function(t) {
        if ( t.kind === 'text' ) {
          var parts = t.text.split('\n');
          parts.forEach(function(part, i) {
            if ( i > 0 ) newLine();
            if ( part ) addText(part, t.state);
          });
        } else if ( t.kind === 'open' ) {
          var sp = { span: t.span, els: [] };
          logical.push(sp);
          dom.push(self.openSpan(dom[dom.length - 1], sp));
          line.chips.push({ sp: sp, col: col });
        } else {
          logical.pop();
          dom.pop();
        }
      });
      lines.forEach(function(ln) { self.placeChips(ln); });
    }
  ],
});
