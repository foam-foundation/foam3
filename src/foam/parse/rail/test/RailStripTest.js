/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.rail.test',
  name: 'RailStripTest',
  extends: 'foam.core.test.JSTest',

  requires: [
    'foam.parse.rail.RailSeq',
    'foam.parse.rail.RailStrip',
    'foam.parse.rail.RailSymRef',
    'foam.parse.rail.RailTerminal',
    'foam.parse.rail.RailTheme'
  ],

  documentation: 'Strip width = label column + two stubs + track; a sequence sums widths plus gaps and aligns entry rows; layout re-runs when a part resizes.',

  methods: [
    async function runTest(x) {
      var T = this.RailTheme.create(), m = foam.graphics.TextUtil.estimateMeasurer(7);
      var mk = function(text) { return this.RailTerminal.create({ text: text, theme: T, measure: m }); }.bind(this);

      var a = mk('"["'), b = mk('"]"');
      var seq = this.RailSeq.create({ items: [ a, b ], theme: T, measure: m });
      x.test(seq.width  === a.width + T.GAP + b.width, 'sequence width = items + gaps');
      x.test(seq.height === T.BOX_H,                    'sequence height = tallest item');
      x.test(seq.entryY === T.BOX_H / 2,                'sequence entry row = items\' entry row');
      x.test(b.x === a.width + T.GAP && a.y === 0,      'items placed left to right on one row');
      x.test(seq.children.length === 2,                 'items are children (painted and hit-tested through the tree)');

      // Re-layout on part change: a wider item pushes its neighbour.
      var before = b.x;
      a.text = '"[[[["';
      x.test(b.x > before && seq.width === a.width + T.GAP + b.width, 'changing an item re-runs the layout');

      // Rule reference: a box sized from its name; missing rules are flagged.
      var ref = this.RailSymRef.create({ name: 'item', theme: T, measure: m });
      x.test(ref.width === T.GLYPH_SLOT + 4 * 7 + 2 * T.PAD && ref.height === T.BOX_H, 'rule reference box sized from its name');
      x.test(! ref.unfolded && ! ref.canUnfold(),   'PR 2: a reference cannot unfold yet');
      var miss = this.RailSymRef.create({ name: 'nope', missing: true, theme: T, measure: m });
      x.test(miss.tipText().indexOf('missing') >= 0, 'a missing rule says so in its tooltip');

      // Strip: label column + stubs + track; only the label column is a hit target.
      var strip = this.RailStrip.create({ name: 'START', track: seq, theme: T, measure: m });
      x.test(strip.width  === T.LABEL_W + 2 * T.STUB + seq.width, 'strip width = label + 2 stubs + track');
      x.test(strip.height === seq.height && strip.entryY === seq.entryY, 'strip height/entry follow the track');
      x.test(seq.x === T.LABEL_W + T.STUB,                            'track starts after the label column and the entry stub');
      x.test(strip.tipText().indexOf('not tried') >= 0,               'before a trace the tooltip says not tried');
      strip.labelW = 200;
      x.test(seq.x === 200 + T.STUB && strip.width === 200 + 2 * T.STUB + seq.width, 'a wider label column moves the track and widens the strip');
      strip.labelW = T.LABEL_W;
      strip.runs = 3; strip.matches = 1;
      x.test(strip.tipText().indexOf('tried 3') >= 0 && strip.tipText().indexOf('1 matched') >= 0, 'after a trace the tooltip states attempts and matches');
    }
  ]
});
