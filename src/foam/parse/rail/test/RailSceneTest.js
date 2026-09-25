/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.rail.test',
  name: 'RailSceneTest',
  extends: 'foam.core.test.JSTest',

  requires: [
    'foam.parse.Grammar',
    'foam.parse.rail.RailBuilder',
    'foam.parse.rail.RailScene',
    'foam.parse.rail.RailSymRef',
    'foam.parse.rail.RailTheme'
  ],

  documentation: 'Strips stack vertically and restack when one grows; element lookup walks the tree; fitWidth never enlarges past zoom 1.',

  methods: [
    async function runTest(x) {
      var g = this.Grammar.create({ symbols: function(seq, sym, literal, eof) {
        return { START: seq(sym('a'), eof()), a: literal('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa') };
      } });
      var s = this.RailScene.create({ viewWidth: 400, viewHeight: 300, measure: foam.graphics.TextUtil.estimateMeasurer(7) });
      var b = this.RailBuilder.create({ grammar: g, theme: s.theme, measure: s.measure });
      s.setStrips(b.buildStrips());
      var T = s.theme;

      x.test(s.strips.length === 2, 'one strip per rule');
      x.test(s.strips[0].y === T.CANVAS_MARGIN && s.strips[1].y === s.strips[0].y + s.strips[0].height + T.STRIP_GAP, 'strips stack with the strip gap');

      // Restack: growing the first strip pushes the second down.
      var before = s.strips[1].y;
      s.strips[0].track.items[1].text = '"a much longer end-stop label"';   // width change only
      x.test(s.strips[1].y === before, 'a width change does not move the next strip');
      s.strips[0].track.items[1].height = T.BOX_H * 3;
      x.test(s.strips[1].y > before, 'a height change restacks the strips below');

      // Lookups walk the tree, no registry.
      var refs = s.elementsFor(g.getSymbol('START').args[0]);
      x.test(refs.length === 1 && this.RailSymRef.isInstance(refs[0]), 'elementsFor finds the one call site of sym("a")');
      var n = 0; s.eachElement(function() { n++; });
      x.test(n === 2 + 3 + 1, 'eachElement visits strips, the sequence, its two items and the literal');
      x.test(s.stripFor('a') === s.strips[1] && s.stripFor('zzz') === undefined, 'stripFor by rule name');

      // A long rule name widens the label column for every strip, so the tracks stay aligned.
      var g2 = this.Grammar.create({ symbols: function(seq, sym, literal, eof) {
        return { START: seq(sym('acknowledgementSection'), eof()), acknowledgementSection: literal('x') };
      } });
      var s2 = this.RailScene.create({ viewWidth: 400, viewHeight: 300, measure: foam.graphics.TextUtil.estimateMeasurer(7) });
      s2.setStrips(this.RailBuilder.create({ grammar: g2, theme: s2.theme, measure: s2.measure }).buildStrips());
      var wide = 7 * 'acknowledgementSection'.length + T.LABEL_GAP;
      x.test(s2.strips[0].labelW === wide && s2.strips[1].labelW === wide, 'label column = longest name + LABEL_GAP, shared by every strip');
      x.test(s2.strips[0].track.x === s2.strips[1].track.x && s2.strips[0].track.x === wide + T.STUB, 'every track starts at the same x, after the widened column');
      x.test(s.strips[0].labelW === T.LABEL_W, 'short names keep the minimum column width');

      // Bounds and fit.
      var cb = s.contentBounds();
      x.test(cb.width >= s.strips[1].x + s.strips[1].width && cb.height >= s.strips[1].y + s.strips[1].height, 'contentBounds covers every strip');
      s.fitWidth();
      x.test(s.zoom < 1 && s.zoom > 0, 'a wide grammar zooms out to fit its width');
      x.test(Math.abs(cb.width * s.zoom - ( 400 - 2 * s.DEFAULT_FIT_PAD )) < 1, 'fitWidth uses the full viewport width minus padding');
      s.strips[1].track.text = '"a"';
      s.strips[0].track.items[1].text = '⊣';        // undo the earlier widening too
      s.fitWidth();
      x.test(s.zoom === 1, 'fitWidth never enlarges past zoom 1');

      // Replacing strips removes the old ones.
      s.setStrips([]);
      x.test(s.strips.length === 0, 'setStrips([]) clears the strips');
    }
  ]
});
