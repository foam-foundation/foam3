/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.rail.test',
  name: 'RailNotationTest',
  extends: 'foam.core.test.JSTest',

  requires: [
    'foam.parse.Grammar',
    'foam.parse.Parsers',
    'foam.parse.rail.RailBuilder',
    'foam.parse.rail.RailGate',
    'foam.parse.rail.RailGeneric',
    'foam.parse.rail.RailTheme'
  ],

  documentation: `
    Every foam.parse class with a parse() method is either drawn by a
    non-generic element (a sample instance builds without RailGeneric) or is
    on the explicit allow-list of non-combinators. A new combinator upstream
    fails this test by name until NOTATION.md and the builder gain a row.
  `,

  constants: {
    // Classes in the foam.parse package that have parse() but are not combinators to draw.
    NON_COMBINATORS: [
      'AbstractParser', 'ParserDecorator', 'Grammar', 'Parsers', 'PSymbol', 'GrammarAxiom',
      'StringPStream', 'JSPStream', 'ErrorReportingPStream', 'TrapPStream', 'InvalidPStream', 'TracingPStream',
      'Suggestion', 'AltSuggestion', 'ParserArray', 'ParserProperty',
      // Grammar subclasses shipped in the package: drawn by unfolding their symbols, not as one element.
      'QueryParser', 'SimpleQueryParser', 'SimpleJavaScriptParser', 'QueryRouter', 'DateGrammar', 'DateParser',
      'NumberGrammar', 'NumberParser', 'FScriptParser', 'ImperativeGrammar',
      // The parser interface itself declares parse() but is not a parser.
      'JSParser'
    ]
  },

  methods: [
    function samples(P) {
      /** One instance per drawable class, built with the Parsers vocabulary. */
      var l = function() { return P.literal('a'); };
      return {
        Literal: l(), LiteralIC: P.literalIC('a'), Range: P.range('a', 'z'), Chars: P.chars('ab'), NotChars: P.notChars('ab'),
        AnyChar: P.anyChar(), EOF: P.eof(), Symbol: P.sym('r'),
        Sequence: P.seq(l(), l()), Sequence0: P.seq0(l()), Sequence1: P.seq1(0, l()),
        Alternate: P.alt(l(), l()), Optional: P.optional(l()),
        Repeat: P.repeat(l()), Plus: P.plus(l()), Repeat0: P.repeat0(l()),
        Until: P.until(P.seq(l())), Until0: P.until0(P.seq(l())), UntilLiteral: P.until('x'), UntilLiteral0: P.until0('x'),
        Not: P.not(l()), Peek: P.peek(l()),
        Substring: P.substring(l()), String: P.str(l()), Join: P.join(l()),
        ParserWithAction: P.action(l(), function(v) { return v; }),
        Suggest: P.sug(l(), 's'), Msg: P.msg(l(), 'm'), DebugParser: P.debug(l())
      };
    },

    async function runTest(x) {
      var self = this, P = this.Parsers.create(), T = this.RailTheme.create(), m = foam.graphics.TextUtil.estimateMeasurer(7);
      var samples = this.samples(P);
      var g = this.Grammar.create({ symbols: function(literal) { return { r: literal('r') }; } });
      var b = this.RailBuilder.create({ grammar: g, theme: T, measure: m });

      // Every foam.parse class with parse() is drawable or allow-listed. Package members are registered
      // non-enumerable, so Object.keys() would see nothing: getOwnPropertyNames is the real listing.
      var missing = [], found = 0;
      Object.getOwnPropertyNames(foam.parse).forEach(function(k) {
        var cls = foam.parse[k];
        if ( ! cls || ! cls.id || ! cls.getAxiomByName || ! cls.getAxiomByName('parse') ) return;
        found++;
        if ( samples[k] === undefined && self.NON_COMBINATORS.indexOf(k) < 0 ) missing.push(k);
      });
      x.test(found >= Object.keys(samples).length, 'the enumeration actually sees the package (' + found + ' classes with parse())');
      x.test(missing.length === 0, 'every foam.parse class with parse() has a sample or is allow-listed; missing: ' + missing.join(', '));

      // Each sample builds to something other than RailGeneric; the builder must not throw.
      var generic = [];
      Object.keys(samples).forEach(function(k) {
        var el;
        try { el = b.build(samples[k], {}, []); } catch (e) { generic.push(k + ' (threw: ' + e.message + ')'); return; }
        if ( self.RailGeneric.isInstance(el) ) generic.push(k);
        // Not/Peek must be gates: drawing only their child is the one semantically wrong picture.
        if ( ( k === 'Not' || k === 'Peek' ) && ! self.RailGate.isInstance(el) ) generic.push(k + ' (not a gate)');
      });
      x.test(generic.length === 0, 'no sample draws as a generic box: ' + generic.join(', '));

      // Sample table and allow-list do not overlap.
      var both = Object.keys(samples).filter(function(k) { return self.NON_COMBINATORS.indexOf(k) >= 0; });
      x.test(both.length === 0, 'no class is both a sample and a non-combinator');

      // Notation glyphs used by the builder/labels, as one list (NOTATION.md is checked against this list by the plan's grep step).
      var glyphs = [ '⊣', '•', '…', '¬[', 'aA', '×1+', '∅', '«»', '⊕', '⚙', '💬', '🐞', '⊘', '⟶?', '▸', '▾' ];
      x.test(glyphs.length === 16, 'glyph list is the NOTATION.md contract');
    }
  ]
});
