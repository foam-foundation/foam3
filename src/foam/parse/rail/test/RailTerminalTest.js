/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.rail.test',
  name: 'RailTerminalTest',
  extends: 'foam.core.test.JSTest',

  requires: [
    'foam.parse.rail.Outcome',
    'foam.parse.rail.RailGeneric',
    'foam.parse.rail.RailTerminal',
    'foam.parse.rail.RailTheme',
    'foam.parse.rail.Tier'
  ],

  documentation: 'A terminal box sizes itself from its text; state maps to stroke, glyph and alpha through the theme tables.',

  methods: [
    async function runTest(x) {
      var theme = this.RailTheme.create();
      var measure = foam.graphics.TextUtil.estimateMeasurer(7);   // every char 7 px, font ignored
      var t = this.RailTerminal.create({ text: '"ab"', theme: theme, measure: measure });

      x.test(t.width === theme.GLYPH_SLOT + 4 * 7 + 2 * theme.PAD, 'width = glyph column + text + 2 pad');
      x.test(t.height === theme.BOX_H,                              'height is the box height');
      x.test(t.entryY === theme.BOX_H / 2,                          'the track meets a box at mid-height');
      x.test(t.pathKey === '',                                      'no path yet');
      t.pathIds = [ 4, 9 ];
      x.test(t.pathKey === '4/9',                                   'pathKey follows pathIds');

      // Badge adds its own width plus a margin so it never overlaps the label.
      var b = this.RailTerminal.create({ text: '"ab"', badge: 'aA', theme: theme, measure: measure });
      x.test(b.width > t.width, 'a badge widens the box');

      // Default state: NONE / LIVE, base stroke, no glyph, full alpha.
      x.test(t.outcome === this.Outcome.NONE && t.tier === this.Tier.LIVE, 'defaults are not-reached and live');
      x.test(t.glyph() === '' && t.stateClasses() === 'rail-el outcome-NONE tier-LIVE', 'default glyph and classes');

      // Visited: heavier stroke + glyph; NEVER tier fades; highlighted overrides fade and is heaviest.
      t.outcome = this.Outcome.MATCHED;
      x.test(t.visited() && / visited$/.test(t.stateClasses()) && t.glyph() === '✓', 'matched: visited class and tick');
      x.test(t.outcomeColor() === theme.resolve('outcomeMATCHED'), 'outcome colour comes from the theme');
      t.tier = this.Tier.NEVER;
      x.test(/tier-NEVER/.test(t.stateClasses()), 'NEVER tier class (the stylesheet fades it)');
      t.highlighted = true;
      x.test(/ highlighted$/.test(t.stateClasses()), 'highlighted class (full opacity, heaviest stroke in the stylesheet)');
      t.highlighted = false;

      // Tooltip text: parser toString, plus the consumed text once known.
      t.parser = { toString: function() { return 'literal("ab")'; } };
      x.test(t.tipText() === 'literal("ab")', 'tooltip is the parser description');
      t.consumed = 'ab';
      x.test(t.tipText().indexOf('matched: "ab"') > 0, 'tooltip adds the consumed text');

      // Generic box: class name as text, square corners, still a terminal for layout purposes.
      var g = this.RailGeneric.create({ text: 'Mystery', theme: theme, measure: measure });
      x.test(this.RailTerminal.isInstance(g) && g.height === theme.BOX_H, 'RailGeneric is a terminal-shaped box');
    }
  ]
});
