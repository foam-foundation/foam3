/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.rail.test',
  name: 'RailGateTest',
  extends: 'foam.core.test.JSTest',

  requires: [
    'foam.parse.Grammar',
    'foam.parse.rail.RailBuilder',
    'foam.parse.rail.RailGate',
    'foam.parse.rail.RailTheme'
  ],

  documentation: 'Not and Peek never draw as their child alone: a framed, dashed child behind a gate; Not with else draws the else child after the gate.',

  methods: [
    async function runTest(x) {
      var T = this.RailTheme.create(), m = foam.graphics.TextUtil.estimateMeasurer(7);
      var g = this.Grammar.create({ symbols: function(not, peek, literal, anyChar) {
        return {
          a: not(literal('"')),
          b: not(literal('"'), anyChar()),
          c: peek(literal('x'))
        };
      } });
      var s = this.RailBuilder.create({ grammar: g, theme: T, measure: m }).buildStrips();

      var a = s[0].track, b = s[1].track, c = s[2].track;
      x.test(this.RailGate.isInstance(a) && a.negate && ! a.elseItem,       'not(p) -> negating gate, no else');
      x.test(a.width === a.gateWidth() + a.item.width + 2 * T.FRAME_PAD,    'gate width = barrier + framed child');
      x.test(a.height === a.item.height + 2 * T.FRAME_PAD,                  'frame pads the child top and bottom');
      x.test(a.entryY === T.FRAME_PAD + a.item.entryY,                      'enters on the child row');
      x.test(b.elseItem && b.elseItem.text === '•',                         'not(p, else) builds the else child');
      x.test(b.width === a.width + T.GAP + b.elseItem.width,                'else child follows the gate on the track');
      x.test(b.elseItem.x === a.width + T.GAP,                              'else child placed after the frame');
      x.test(this.RailGate.isInstance(c) && ! c.negate,                     'peek(p) -> lookahead gate');
      x.test(a.tipText().indexOf('must NOT') >= 0 && c.tipText().indexOf('must be next') >= 0, 'tooltips state the lookahead meaning');
      x.test(a.children.length === 1 && b.children.length === 2,            'children = item (+ else)');
    }
  ]
});
