/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.rail.test',
  name: 'RailReachabilityTest',
  extends: 'foam.core.test.JSTest',

  requires: [
    'foam.parse.Grammar',
    'foam.parse.rail.RailBuilder',
    'foam.parse.rail.RailScene',
    'foam.parse.rail.RailTheme'
  ],

  documentation: 'Rules reachable from the start symbol come first in first-visit order; unreachable ones are sorted by name behind a flag; the scene sets them apart.',

  methods: [
    async function runTest(x) {
      var T = this.RailTheme.create(), m = foam.graphics.TextUtil.estimateMeasurer(7);
      // Declaration order deliberately scrambled; z and orphan are unreachable from START.
      var g = this.Grammar.create({ symbols: function(seq, sym, literal, alt, repeat, optional, not, eof) {
        return {
          z:      literal('z'),
          item:   alt(sym('num'), sym('list')),
          START:  seq(sym('list'), eof()),
          orphan: seq(sym('z'), sym('num')),
          num:    repeat(sym('digit'), literal(','), 1),
          list:   seq(literal('['), optional(sym('item')), not(literal('x'), sym('tail')), literal(']')),
          digit:  literal('1'),
          tail:   literal('!')
        };
      } });
      var b = this.RailBuilder.create({ grammar: g, theme: T, measure: m });

      x.test(b.startSymbol === 'START', 'start symbol defaults to START when present');
      x.test(b.reachableNames().join(',') === 'START,list,item,num,digit,tail', 'reachable in first-visit order: list before item, delimiter-free repeat child, not-else branch');
      x.test(b.unreachableNames().join(',') === 'orphan,z', 'unreachable rules sorted by name');

      var some = b.buildReachableStrips(false);
      x.test(some.length === 6 && some.every(function(s) { return ! s.unreachable; }), 'default view: reachable strips only');
      var all = b.buildReachableStrips(true);
      x.test(all.length === 8 && all[6].name === 'orphan' && all[6].unreachable && all[7].unreachable, 'showAll appends unreachable strips, flagged');
      x.test(all[6].tipText().indexOf('unreachable') >= 0, 'an unreachable strip says so in its tooltip');

      // Scene: extra gap + divider before the first unreachable strip.
      var s = this.RailScene.create({ viewWidth: 400, viewHeight: 300, measure: m });
      s.setStrips(all);
      var gapReach   = all[1].y - ( all[0].y + all[0].height );
      var gapDivider = all[6].y - ( all[5].y + all[5].height );
      x.test(gapReach === T.STRIP_GAP && gapDivider === 2 * T.STRIP_GAP, 'one extra strip gap before the unreachable block');
      x.test(s.dividerY_ > all[5].y + all[5].height && s.dividerY_ < all[6].y, 'divider row lies in that gap');
      s.setStrips(some);
      x.test(s.dividerY_ === -1, 'no divider when nothing is unreachable');

      // No START: the first declared rule is the start.
      var g2 = this.Grammar.create({ symbols: function(literal, sym) { return { a: sym('b'), b: literal('b') }; } });
      var b2 = this.RailBuilder.create({ grammar: g2, theme: T, measure: m });
      x.test(b2.startSymbol === 'a' && b2.reachableNames().join(',') === 'a,b', 'without START the first rule is the root');

      // childrenOf covers every child slot and tolerates a plain-object parser (Parsers.cut).
      var P = foam.parse.Parsers.create();
      x.test(b.childrenOf(P.repeat(P.literal('a'), P.literal(','))).length === 2, 'repeat children: p and delimiter');
      x.test(b.childrenOf(P.not(P.literal('a'), P.literal('b'))).length === 2,   'not children: p and else');
      x.test(b.childrenOf(P.cut(P.literal('a'))).length === 0,                    'a plain-object parser has no children (no throw)');
    }
  ]
});
