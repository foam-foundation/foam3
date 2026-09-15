/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.rail.test',
  name: 'DocumentViewTest',
  extends: 'foam.core.test.JSTest',

  requires: [
    'foam.parse.Grammar',
    'foam.parse.rail.DocumentView',
    'foam.parse.rail.ParseTrace'
  ],

  documentation: 'Rule spans from a finished and a mid-trace snapshot; the token stream the document view paints from is balanced, covers the text once, and carries the three text states.',

  methods: [
    function pairs() {
      return this.Grammar.create({ symbols: function(seq, sym, literal, plus, range, repeat, optional, eof) {
        return {
          START: seq(repeat(seq(sym('pair'), optional(literal('\n')))), eof()),
          pair:  seq(sym('key'), literal('='), sym('value')),
          key:   plus(range('a', 'z')),
          value: plus(range('0', '9'))
        };
      } });
    },

    async function runTest(x) {
      var g = this.pairs(), input = 'a=1\nbb=22';
      var tr = this.ParseTrace.create({ grammar: g, startSymbol: 'START', input: input }).record();
      var end = tr.at(tr.length());
      x.test(end.finished && end.matched, 'pairs grammar matches the two-line input');

      // Finished: one span per rule activation on the path, pre-order, root excluded.
      var spans = end.spans();
      var brief = spans.map(function(s) { return s.name + ':' + s.start + '-' + s.end; }).join(' ');
      x.test(brief === 'pair:0-3 key:0-1 value:2-3 pair:4-9 key:4-6 value:7-9', 'finished spans: ' + brief);
      x.test(spans.every(function(s) { return ! s.pending; }), 'no pending span once finished');

      // Mid-trace: the second pair is open while its value is being tried.
      var valueP = g.getSymbol('value'), n;
      for ( n = 1 ; n <= tr.length() ; n++ ) { var s = tr.at(n); if ( s.pos >= 7 && s.isActive(valueP) ) break; }
      var mid = tr.at(n);
      var open = mid.spans().filter(function(s) { return s.pending; }).map(function(s) { return s.name; });
      x.test(open.join(',') === 'pair,value', 'open spans mid-trace: ' + open.join(','));
      x.test(mid.spans().some(function(s) { return s.name === 'key' && s.start === 4 && s.end === 6 && ! s.pending; }), 'the second key is closed while its value is open');

      // Token stream: balanced, text pieces cover the input exactly once, states follow the stream position.
      var view = this.DocumentView.create();
      var toks = view.tokens(input, mid);
      var depth = 0, text = '', ok = true;
      toks.forEach(function(t) {
        if ( t.kind === 'open' ) depth++;
        else if ( t.kind === 'close' ) { depth--; if ( depth < 0 ) ok = false; }
        else text += t.text;
      });
      x.test(ok && depth === 0, 'open/close tokens balance');
      x.test(text === input, 'text tokens rebuild the input');
      var states = toks.filter(function(t) { return t.kind === 'text'; });
      x.test(states.filter(function(t) { return t.state === 'consumed'; }).map(function(t) { return t.text; }).join('') === input.substring(0, mid.pos), 'consumed pieces = input before pos');
      x.test(states.filter(function(t) { return t.state === 'unreached'; }).map(function(t) { return t.text; }).join('') === input.substring(mid.probe ? mid.probe.end : mid.pos), 'unreached pieces = input after the probe');
      x.test(! mid.probe || states.some(function(t) { return t.state === 'probe' && t.text === input.substring(mid.probe.start, mid.probe.end); }), 'the char under test is its own probe piece');
      var opens = toks.filter(function(t) { return t.kind === 'open'; });
      var shown = mid.spans().filter(function(s) { return s.pending || s.end - s.start > 1; });
      x.test(opens.length === shown.length && opens.length < mid.spans().length, 'one open token per span, one-char spans (key "a") dropped');
      x.test(! opens.some(function(t) { return t.span.name === 'key' && t.span.start === 0; }), 'the one-char key at 0 has no span');
      x.test(opens.filter(function(t) { return t.span.pending; }).every(function(t) { return t.stackSame >= 0; }), 'open tokens carry the same-start stacking index');

      // No snapshot: plain text, one piece, no state.
      var plain = view.tokens(input, null);
      x.test(plain.length === 1 && plain[0].kind === 'text' && plain[0].text === input && plain[0].state === 'plain', 'no snapshot: one plain piece');

      // A finished, failed parse marks the char it died on.
      var bad = this.ParseTrace.create({ grammar: g, startSymbol: 'START', input: 'a=x' }).record();
      var badEnd = bad.at(bad.length());
      var died = view.tokens('a=x', badEnd).filter(function(t) { return t.kind === 'text' && t.state === 'died'; });
      x.test(badEnd.failPos === 2 && died.length === 1 && died[0].text === 'x', 'died piece is the failure char');
    }
  ]
});
