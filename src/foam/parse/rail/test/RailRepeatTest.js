/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.rail.test',
  name: 'RailRepeatTest',
  extends: 'foam.core.test.JSTest',

  requires: [
    'foam.parse.Grammar',
    'foam.parse.rail.RailBuilder',
    'foam.parse.rail.RailRepeat',
    'foam.parse.rail.RailTerminal',
    'foam.parse.rail.RailTheme'
  ],

  documentation: 'Loop geometry with and without a delimiter; badges state the bounds; greedy loops are the second notation convention.',

  methods: [
    async function runTest(x) {
      var T = this.RailTheme.create(), m = foam.graphics.TextUtil.estimateMeasurer(7);
      var mk = function(text) { return this.RailTerminal.create({ text: text, theme: T, measure: m }); }.bind(this);

      // No delimiter: the return track needs two arcs of room below the item.
      var r1 = this.RailRepeat.create({ item: mk('"a"'), theme: T, measure: m });
      x.test(r1.height === T.BOX_H + 2 * T.ARC,                 'no delimiter: item height + return-track room');
      x.test(r1.width  === r1.item.width + 2 * T.LOOP_PAD,       'width = item + detour room both sides');
      x.test(r1.entryY === r1.item.entryY && r1.item.y === 0,    'enters on the item row');
      x.test(r1.returnY() === r1.height - T.ARC,                 'return track runs one arc above the bottom');

      // Delimiter: sits under the item, on the return track.
      var d = mk('","');
      var r2 = this.RailRepeat.create({ item: mk('"item"'), delim: d, theme: T, measure: m });
      x.test(d.y === r2.item.height + T.VGAP,                    'delimiter row is one branch gap below the item');
      x.test(r2.height === d.y + d.height,                       'height ends at the delimiter');
      x.test(r2.returnY() === d.y + d.entryY,                    'return track passes through the delimiter');
      x.test(r2.children.length === 2,                           'item and delimiter are children');

      // Builder rows and badges.
      var g = this.Grammar.create({ symbols: function(plus, repeat, repeat0, literal, sym) {
        return {
          a: plus(literal('a')),
          b: repeat(literal('b'), literal(','), 2),
          c: repeat(literal('c')),
          d: repeat0(literal('d'))
        };
      } });
      var b = this.RailBuilder.create({ grammar: g, theme: T, measure: m });
      var s = b.buildStrips();
      x.test(this.RailRepeat.isInstance(s[0].track) && s[0].track.badge === '×1+',  'plus -> ×1+');
      x.test(s[1].track.badge === '×2+' && s[1].track.delim && s[1].track.delim.text === '","', 'repeat with min and delimiter');
      x.test(s[2].track.badge === '',                                                 'unbounded repeat has no badge');
      x.test(s[3].track.badge === '∅',                                                'repeat0 (may match nothing) shows the empty badge');
    }
  ]
});
