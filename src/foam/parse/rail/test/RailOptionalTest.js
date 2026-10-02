/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.rail.test',
  name: 'RailOptionalTest',
  extends: 'foam.core.test.JSTest',

  requires: [
    'foam.parse.Grammar',
    'foam.parse.rail.RailBuilder',
    'foam.parse.rail.RailOptional',
    'foam.parse.rail.RailSeq',
    'foam.parse.rail.RailTerminal',
    'foam.parse.rail.RailTheme'
  ],

  documentation: 'The bypass runs above the item with fixed headroom; a sequence aligns an optional on the item row, not the bypass row.',

  methods: [
    async function runTest(x) {
      var T = this.RailTheme.create(), m = foam.graphics.TextUtil.estimateMeasurer(7);
      var mk = function(text) { return this.RailTerminal.create({ text: text, theme: T, measure: m }); }.bind(this);
      var o = this.RailOptional.create({ item: mk('"ws"'), theme: T, measure: m });
      var head = T.ARC * T.BYPASS_HEADROOM;

      x.test(o.item.y === head && o.item.x === T.LOOP_PAD,        'item sits below the bypass headroom, after the detour column');
      x.test(o.height === o.item.height + head,                    'height = headroom + item');
      x.test(o.width  === o.item.width + 2 * T.LOOP_PAD,           'width = item + detour room');
      x.test(o.entryY === head + o.item.entryY,                    'enters on the item row (the bypass is above it)');

      // Inside a sequence the optional's neighbours align on the item row, so the bypass rises above the track.
      var a = mk('"a"');
      var seq = this.RailSeq.create({ items: [ a, o ], theme: T, measure: m });
      x.test(a.y === head && o.y === 0 && seq.entryY === o.entryY, 'sequence lines the plain box up with the optional\'s item row');

      var g = this.Grammar.create({ symbols: function(optional, literal) { return { START: optional(literal('x')) }; } });
      var t = this.RailBuilder.create({ grammar: g, theme: T, measure: m }).buildStrips()[0].track;
      x.test(this.RailOptional.isInstance(t) && t.item.text === '"x"', 'Optional maps to RailOptional');
    }
  ]
});
