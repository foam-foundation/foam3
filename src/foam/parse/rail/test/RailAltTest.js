/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.rail.test',
  name: 'RailAltTest',
  extends: 'foam.core.test.JSTest',

  requires: [
    'foam.parse.Grammar',
    'foam.parse.rail.RailAlt',
    'foam.parse.rail.RailBuilder',
    'foam.parse.rail.RailTerminal',
    'foam.parse.rail.RailTheme'
  ],

  documentation: 'Branches stack top-down in args order (number = PEG priority); height sums branches plus gaps; entry is the first branch row.',

  methods: [
    async function runTest(x) {
      var T = this.RailTheme.create(), m = foam.graphics.TextUtil.estimateMeasurer(7);
      var mk = function(text) { return this.RailTerminal.create({ text: text, theme: T, measure: m }); }.bind(this);
      var a = mk('"a"'), bb = mk('"bbbbbb"'), c = mk('"c"');
      var alt = this.RailAlt.create({ items: [ a, bb, c ], theme: T, measure: m });

      x.test(alt.height === 3 * T.BOX_H + 2 * T.VGAP,            'height = branches + gaps');
      x.test(alt.width  === bb.width + 2 * T.LOOP_PAD,            'width = widest branch + detour room on both sides');
      x.test(alt.entryY === a.entryY,                             'the track enters on branch 1');
      x.test(a.y === 0 && bb.y === T.BOX_H + T.VGAP && c.y === 2 * ( T.BOX_H + T.VGAP ), 'branches stacked in args order');
      x.test(a.x === T.LOOP_PAD + ( bb.width - a.width ) / 2,     'narrower branches are centred on the widest');
      x.test(alt.priorityOf(bb) === 2,                            'priority number is the 1-based args index');

      // Through the builder: alt(literal, literal) is a RailAlt whose items follow args order.
      var g = this.Grammar.create({ symbols: function(alt, literal) { return { START: alt(literal('do'), literal('double')) }; } });
      var b = this.RailBuilder.create({ grammar: g, theme: T, measure: m });
      var track = b.buildStrips()[0].track;
      x.test(this.RailAlt.isInstance(track) && track.items[0].text === '"do"' && track.items[1].text === '"double"', 'Alternate maps to RailAlt in args order');

      // Emitting SVG needs no document: one priority number per branch.
      var g = foam.u2.Element.create({ nodeName: 'svg' }).start('g');
      track.svg(g);
      x.test(g.element_.querySelectorAll('text.priority-text').length === 2 && g.element_.querySelectorAll('path.branch').length === 2, 'one priority number and one track per branch');
    }
  ]
});
