/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.rail.test',
  name: 'RailBadgeTest',
  extends: 'foam.core.test.JSTest',

  requires: [
    'foam.parse.Grammar',
    'foam.parse.rail.RailBadge',
    'foam.parse.rail.RailBuilder',
    'foam.parse.rail.RailGeneric',
    'foam.parse.rail.RailSeq',
    'foam.parse.rail.RailTheme'
  ],

  documentation: 'Value-only decorators draw their child with a badge; Sequence1 emphasises item n; an unknown class warns once per build.',

  methods: [
    async function runTest(x) {
      var T = this.RailTheme.create(), m = foam.graphics.TextUtil.estimateMeasurer(7);
      var g = this.Grammar.create({ symbols: function(seq, seq0, seq1, str, substring, join, literal, sug, msg, debug, cut, plus, range) {
        return {
          s0:  seq0(literal('a'), literal('b')),
          s1:  seq1(1, literal('('), literal('x'), literal(')')),
          st:  str(plus(range('a', 'z'))),
          sub: substring(literal('q')),
          jn:  join(literal('j')),
          sg:  sug(literal('s'), 'hint'),
          mg:  msg(literal('m'), 'message'),
          dbg: debug(literal('d')),
          cut: cut(literal('c'))
        };
      } });
      g.addAction('st', function(v) { return v.toUpperCase(); });   // wraps st in ParserWithAction
      var warnings = [], origWarn = console.warn;
      console.warn = function(msg) { warnings.push(String(msg)); };
      var b = this.RailBuilder.create({ grammar: g, theme: T, measure: m });
      var s;
      try { s = b.buildStrips(); } finally { console.warn = origWarn; }

      var by = {}; s.forEach(function(st) { by[st.name] = st.track; });
      x.test(this.RailBadge.isInstance(by.s0) && by.s0.tag === '∅' && this.RailSeq.isInstance(by.s0.item), 'seq0 -> ∅ badge over a sequence');
      x.test(this.RailSeq.isInstance(by.s1) && by.s1.emphasis === 1,             'seq1(n) -> sequence with emphasis on item n');
      x.test(this.RailBadge.isInstance(by.st) && by.st.tag === '⚙' && this.RailBadge.isInstance(by.st.item) && by.st.item.tag === '⊕', 'action over str: two badges, outer ⚙ then ⊕');
      x.test(by.st.hint.indexOf('toUpperCase') >= 0,                              'action badge hint carries the action source');
      x.test(by.sub.tag === '«»' && by.jn.tag === '⊕',                            'substring «», join ⊕');
      x.test(by.sg.tag === '💬' && by.mg.tag === '💬' && by.dbg.tag === '🐞',       'suggest/msg 💬, debug 🐞');
      x.test(by.s0.height === by.s0.item.height + by.s0.BADGE_H && by.s0.entryY === by.s0.BADGE_H + by.s0.item.entryY, 'badge adds a row above the item');
      x.test(by.s0.width === by.s0.item.width,                                    'badge does not widen the item');
      x.test(by.s0.tipText().indexOf('seq0') === 0,                                'tooltip describes the wrapper');

      x.test(this.RailGeneric.isInstance(by.cut) && by.cut.text === '(plain object)', 'a plain-object parser is generic with a clear name');
      x.test(warnings.length === 1 && warnings[0].indexOf('(plain object)') >= 0,  'exactly one warning for the one unknown parser kind');

      // Same class twice in one build: still one warning.
      var g2 = this.Grammar.create({ symbols: function(cut, literal, seq) { return { a: seq(cut(literal('a')), cut(literal('b'))) }; } });
      warnings = []; console.warn = function(msg) { warnings.push(String(msg)); };
      try { this.RailBuilder.create({ grammar: g2, theme: T, measure: m }).buildStrips(); } finally { console.warn = origWarn; }
      x.test(warnings.length === 1, 'one warning per class name per build');
    }
  ]
});
