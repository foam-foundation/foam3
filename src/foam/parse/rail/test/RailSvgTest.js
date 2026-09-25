/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.rail.test',
  name: 'RailSvgTest',
  extends: 'foam.core.test.JSTest',

  requires: [
    'foam.parse.Grammar',
    'foam.parse.rail.Outcome',
    'foam.parse.rail.RailBuilder',
    'foam.parse.rail.RailScene',
    'foam.parse.rail.RailTerminal',
    'foam.parse.rail.Tier',
    'foam.u2.Element'
  ],

  documentation: 'Every element emits one SVG group; state changes rewrite classes and glyph text without touching the structure.',

  methods: [
    async function runTest(x) {
      var O = this.Outcome, T = this.Tier;
      var g = this.Grammar.create({ symbols: function(seq, sym, literal, alt, eof) {
        return { START: seq(sym('a'), eof()), a: alt(literal('x'), literal('y')) };
      } });
      var s = this.RailScene.create({ viewWidth: 400, viewHeight: 300, measure: foam.graphics.TextUtil.estimateMeasurer(7), motion: false });
      var b = this.RailBuilder.create({ grammar: g, theme: s.theme, measure: s.measure });
      s.setStrips(b.buildStrips());
      s.write();                                            // render into the document so the DOM exists
      var root = s.element_;

      var n = 0, count = function(el) { n++; el.children.forEach(count); }; s.strips.forEach(count);
      x.test(root.querySelectorAll('svg').length === 2,            'one <svg> per strip');
      x.test(root.querySelectorAll('.rail-el').length === n + 0,   'one group per node in the strip trees (' + n + ')');
      x.test(root.querySelectorAll('path.box').length === 3,       'three terminal boxes: eof, "x", "y"');
      x.test(root.querySelectorAll('rect.box.ruleref').length === 1, 'one rule-reference box');
      x.test(root.querySelectorAll('path.branch').length === 2,    'two branch tracks for the choice');
      x.test(root.querySelectorAll('circle.priority').length === 2, 'two priority circles');
      var names = Array.from(root.querySelectorAll('text.rule-name')).map(function(t) { return t.textContent; });
      x.test(names.join(',') === 'START,a',                        'rule names in strip order: ' + names.join(','));
      x.test(root.querySelectorAll('[data-rail]').length > 0,      'hit targets carry data-rail ids');

      // State: classes and glyph follow the element, structure stays.
      var term = s.strips[1].track.items[0], gEl = term.g_.element_, before = root.querySelectorAll('*').length;
      x.test(gEl.getAttribute('class') === 'rail-el outcome-NONE tier-LIVE', 'initial classes: ' + gEl.getAttribute('class'));
      term.outcome = O.MATCHED; term.tier = T.HISTORY; term.syncState();
      x.test(gEl.getAttribute('class') === 'rail-el outcome-MATCHED tier-HISTORY visited', 'after a match: ' + gEl.getAttribute('class'));
      x.test(gEl.querySelector('text.glyph').textContent === O.MATCHED.mark, 'glyph text follows the outcome');
      term.highlighted = true; term.syncState();
      x.test(/ highlighted$/.test(gEl.getAttribute('class')), 'highlighted class');
      x.test(root.querySelectorAll('*').length === before, 'syncState changed no structure');

      // Branch tracks follow their item's outcome, not the choice's.
      var alt = s.strips[1].track, branch0 = alt.g_.element_.querySelectorAll('path.branch')[0];
      alt.syncState();
      x.test(/outcome-MATCHED/.test(branch0.getAttribute('class')) && /visited/.test(branch0.getAttribute('class')), 'branch 1 coloured by its matched item');

      // Strip counters.
      s.strips[1].runs = 3; s.strips[1].matches = 1; s.strips[1].syncState();
      x.test(s.strips[1].counterEl_.element_.textContent === 'tried ×3 · ✓1', 'strip counter text');

      // Unfold rebuilds only that strip.
      var ref = s.strips[0].track.items[0];
      ref.unfold(); s.rebuildStrip(s.strips[0]);
      x.test(root.querySelectorAll('rect.frame').length === 1 && root.querySelectorAll('path.branch').length === 4, 'unfolded frame drawn, inner choice adds two branches');
      s.remove();
    }
  ]
});
