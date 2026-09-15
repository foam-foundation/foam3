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
    ^ { display: flex; flex-direction: column; min-height: 0; font: 12px sans-serif; color: #222; }
    ^legend { flex: none; display: flex; flex-wrap: wrap; gap: 3px 10px; align-items: baseline; padding: 4px 8px; font-size: 11px; color: #444; border-bottom: 1px solid #eee; }
    ^legend b { font-weight: normal; padding: 0 3px; }
    ^body { flex: 1; min-height: 0; overflow: auto; padding: 14px 8px 8px; }
    ^pre { margin: 0; font: 12px/2.3 monospace; white-space: pre; color: #222; }
    ^consumed { background: #d6e8f5; }
    ^open { background: #fff1cc; }
    ^probe { outline: 2px solid #E69F00; outline-offset: -1px; }
    ^died { background: #f8d9c4; outline: 2px solid #D55E00; outline-offset: -1px; }
    ^unreached { color: #888; }
    ^rule { position: relative; border-bottom: 2px solid #0072B2; }
    ^rule:hover { background: #e6eefc; }
    ^pending { border-bottom-style: dashed; border-bottom-color: #E69F00; }
    ^chip { position: absolute; left: 0; max-width: 100%; box-sizing: border-box; overflow: hidden; text-overflow: ellipsis; font: 9px/1.1 sans-serif; color: #fff; background: #0072B2; border-radius: 3px; padding: 1px 4px; cursor: pointer; white-space: nowrap; z-index: 1; }
    ^pending > ^chip { background: #E69F00; color: #222; }
    ^chip:hover { text-decoration: underline; }
    ^empty { color: #666; padding: 4px 8px; }
  `,

  messages: [
    { name: 'LEGEND_TITLE',    message: 'Document:' },
    { name: 'LEGEND_CONSUMED', message: 'consumed' },
    { name: 'LEGEND_OPEN',     message: 'attempt in progress' },
    { name: 'LEGEND_PROBE',    message: 'char under test' },
    { name: 'LEGEND_DIED',     message: 'char it died on' },
    { name: 'LEGEND_UNREACH',  message: 'not reached' },
    { name: 'LEGEND_CHIP',     message: 'chip = rule that matched the text under it (dashed = still open) · click to locate' },
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
       * Without a snapshot the whole text is one 'plain' piece.
       */
      var out = [];
      if ( ! snap ) { if ( text ) out.push({ kind: 'text', text: text, state: 'plain' }); return out; }
      var self = this, spans = snap.spans(), stack = [], cursor = 0;
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
    }
  ],

  listeners: [
    function rebuild() {
      var self = this, body = this.body_;
      if ( ! body ) return;
      body.removeAllChildren();
      var snap = this.snapshot, text = snap ? snap.input : this.text;
      if ( ! text ) { body.start('div').addClass(this.myClass('empty')).add(this.EMPTY).end(); return; }
      var pre = body.start('pre').addClass(this.myClass('pre')), stack = [ pre ];
      this.tokens(text, snap).forEach(function(t) {
        var top = stack[stack.length - 1];
        if ( t.kind === 'text' ) {
          if ( t.state === 'plain' ) top.add(t.text);
          else top.start('span').addClass(self.myClass(t.state)).add(t.text).end();
        } else if ( t.kind === 'open' ) {
          var el = top.start('span').addClass(self.myClass('rule')).enableClass(self.myClass('pending'), t.span.pending)
            .attrs({ title: t.span.name + ' ' + t.span.start + '→' + ( t.span.end === null ? '…' : t.span.end ) });
          el.start('span').addClass(self.myClass('chip')).style({ top: ( -1.15 - t.stackSame * 1.05 ) + 'em' }).add(t.span.name)
            .on('click', function(e) { e.stopPropagation(); self.onSelect(t.span.parser); }).end();
          stack.push(el);
        } else {
          stack.pop();
        }
      });
    }
  ]
});
