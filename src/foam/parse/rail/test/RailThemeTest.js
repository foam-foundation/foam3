/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.rail.test',
  name: 'RailThemeTest',
  extends: 'foam.core.test.JSTest',

  requires: [
    'foam.parse.rail.Outcome',
    'foam.parse.rail.RailTheme',
    'foam.parse.rail.Tier'
  ],

  documentation: 'Every outcome and tier has a complete style row; ids are stable per parser object.',

  methods: [
    async function runTest(x) {
      var t = this.RailTheme.create();

      // Every Outcome resolves to a real colour, never the magenta fallback, and carries a glyph string.
      this.Outcome.VALUES.forEach(function(o) {
        x.test(t.outcomeColor(o) !== t.MISSING_COLOR, 'outcome ' + o.name + ' has a colour token');
        x.test(typeof o.mark === 'string',           'outcome ' + o.name + ' has a glyph');
      });
      x.test(this.Outcome.NONE.mark === '' && this.Outcome.MATCHED.mark === '✓', 'glyphs: none is empty, matched is a tick');

      // Tiers carry the alpha the element expression multiplies in.
      x.test(this.Tier.LIVE.alpha === 1 && this.Tier.NEVER.alpha < this.Tier.HISTORY.alpha, 'tier alphas are ordered LIVE > HISTORY > NEVER');

      // Named tokens the elements paint with; a typo here would paint magenta on screen.
      [ 'track', 'text', 'muted', 'terminalBg', 'ruleRefBg', 'frameBg', 'genericBg', 'tooltipBg', 'tooltipBorder', 'tooltipText' ]
        .forEach(function(name) { x.test(t.resolve(name) !== t.MISSING_COLOR, 'colour token "' + name + '" is defined'); });
      [ 'label', 'badge', 'glyph', 'ruleName', 'priority', 'tooltip', 'value' ]
        .forEach(function(name) { x.test(t.font(name) !== t.DEFAULT_FONT, 'font token "' + name + '" is defined'); });

      // Geometry constants are numbers (a missing one becomes NaN in a layout and the strip vanishes).
      [ 'PAD', 'GLYPH_SLOT', 'BOX_H', 'GAP', 'VGAP', 'ARC', 'LOOP_PAD', 'BEND', 'BYPASS_HEADROOM',
        'FRAME_HEAD', 'FRAME_PAD', 'LABEL_W', 'LABEL_GAP', 'STUB', 'STRIP_GAP', 'CANVAS_MARGIN',
        'PRIORITY_DX', 'PRIORITY_DY', 'PRIORITY_RADIUS',
        'STROKE_BASE', 'STROKE_VISITED', 'STROKE_HIGHLIGHT', 'STROKE_PULSE', 'BRANCH_STROKE', 'BRANCH_STROKE_VISITED' ]
        .forEach(function(k) { x.test(typeof t[k] === 'number', 'geometry constant ' + k + ' is a number'); });

      // ParserIds: same object, same id; different objects, different ids.
      var P = foam.parse.rail.ParserIds, a = {}, b = {};
      x.test(P.idOf(a) === P.idOf(a) && P.idOf(a) !== P.idOf(b), 'idOf is stable per object and distinct across objects');
      x.test(P.keyOf([ 3, 7 ]) === '3/7', 'keyOf joins ids with "/"');
    }
  ]
});
