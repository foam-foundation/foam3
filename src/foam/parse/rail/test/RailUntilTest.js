/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.rail.test',
  name: 'RailUntilTest',
  extends: 'foam.core.test.JSTest',

  requires: [
    'foam.parse.Grammar',
    'foam.parse.rail.RailBuilder',
    'foam.parse.rail.RailTerminal',
    'foam.parse.rail.RailTheme',
    'foam.parse.rail.RailUntil'
  ],

  documentation: 'Until draws an ellipsis box then the terminator; the 0 variants carry the empty badge; literal terminators become terminal boxes.',

  methods: [
    async function runTest(x) {
      var T = this.RailTheme.create(), m = foam.graphics.TextUtil.estimateMeasurer(7);
      var g = this.Grammar.create({ symbols: function(until, until0, literal, seq, sym) {
        return {
          a: until(literal('*/')),          // UntilLiteral (Parsers unwraps a Literal to its string)
          b: until0('"'),                   // UntilLiteral0
          c: until(sym('stop')),            // Until with a parser terminator
          d: until0(seq(literal('a'), literal('b'))),   // Until0
          stop: literal('.')
        };
      } });
      var s = this.RailBuilder.create({ grammar: g, theme: T, measure: m }).buildStrips();

      var a = s[0].track;
      x.test(this.RailUntil.isInstance(a),                                  'until(literal) -> RailUntil');
      x.test(this.RailTerminal.isInstance(a.terminator) && a.terminator.text === '"*/"', 'literal terminator is a terminal box');
      x.test(a.badge === '' && s[1].track.badge === '∅',                    'until0 carries the empty badge');
      x.test(a.width === a.dotsWidth() + T.GAP + a.terminator.width,        'width = ellipsis box + gap + terminator');
      x.test(a.entryY === T.BOX_H / 2 && a.terminator.x === a.dotsWidth() + T.GAP, 'terminator sits after the ellipsis box on one row');
      x.test(s[2].track.terminator.name === 'stop',                          'a rule terminator is a rule reference');
      x.test(s[3].track.badge === '∅' && s[3].track.terminator.items.length === 2, 'until0(seq) keeps the sequence as terminator');
      x.test(a.terminator.pathIds.length === a.pathIds.length + 1,           'a synthetic terminator still gets a path one deeper');
    }
  ]
});
