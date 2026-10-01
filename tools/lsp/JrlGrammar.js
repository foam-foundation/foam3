/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp',
  name: 'JrlGrammar',
  extends: 'foam.parse.Grammar',

  documentation: `Position-harvesting grammar for .jrl journal files.
    Flat token-stream parse (strings and comments are consumed whole, so
    their contents can never be mistaken for structure). Emits P.msg
    records harvested by collectJrlPositions():
      jrlEntry     - head of each top-level p( / c( / r( call
      jrlClassRef  - dotted identifiers (2+ segments) inside string
                     literals; classExists() filtering happens at
                     resolution time in JrlHandler
      jrlTripleStr - full spans of FOAM """...""" strings; used to
                     sanitize jrl content before eval, because triple
                     quotes are not valid JavaScript.
    Same harvest pattern as FoamClassGrammar.collectAxiomPositions.`,

  properties: [
    {
      name: 'symbols',
      factory: function() {
        var P = foam.parse.Parsers.create();
        var grammar = this.buildGrammar_(P);
        return foam.parse.Grammar.SYMBOLS.adapt.call(this, null, grammar);
      }
    },
    {
      name: 'jrlCache_',
      documentation: 'Last { text, map } pair; collectJrlPositions is cached by text identity.'
    }
  ],

  methods: [
    function buildGrammar_(P) {
      var lower = P.range('a', 'z');
      var upper = P.range('A', 'Z');
      var digit = P.range('0', '9');
      var identStart = P.alt(lower, upper, P.literal('_'), P.literal('$'));
      var identChar  = P.alt(lower, upper, digit, P.literal('_'), P.literal('$'));
      var ident      = P.seq(identStart, P.repeat(identChar, null, 0));

      // Dotted class-id candidate: two or more dot-separated identifiers.
      var dottedId = P.msg(
        P.str(P.seq(ident, P.repeat(P.seq(P.literal('.'), ident), null, 1))),
        { kind: 'jrlClassRef' });

      // String literals. Content is consumed char-by-char, harvesting
      // dotted ids along the way. `esc` keeps \" and \\ from ending a string.
      function stringLit(open, close, msgKind) {
        var closeP = P.literal(close);
        var esc    = P.seq(P.literal('\\'), P.notChars(''));
        var body   = P.repeat(
          P.seq1(1, P.not(closeP), P.alt(esc, dottedId, P.notChars(''))),
          null, 0);
        var p = P.seq(P.literal(open), body, closeP);
        return msgKind ? P.msg(p, { kind: msgKind }) : p;
      }
      var tripleStr = stringLit('"""', '"""', 'jrlTripleStr');
      var dqStr     = stringLit('"', '"');
      var sqStr     = stringLit("'", "'");
      var btStr     = stringLit('`', '`');
      var strings   = P.alt(tripleStr, dqStr, sqStr, btStr);

      var lineComment  = P.seq(P.literal('//'), P.repeat(P.notChars('\n\r'), null, 0));
      var blockComment = P.seq(P.literal('/*'), P.until(P.literal('*/')));

      // Entry head, anchored at line start. collectJrlPositions parses
      // '\n' + text, so every real head (including one on the first line)
      // is preceded by a newline. Only p/c/r count — this is what keeps
      // `map(` or a p( inside string content from registering.
      var wsInline  = P.repeat(P.chars(' \t'), null, 0);
      var pcr       = P.alt(P.literal('p'), P.literal('c'), P.literal('r'));
      var entryHead = P.seq1(1,
        P.alt(P.literal('\r\n'), P.literal('\n')),
        P.msg(P.str(P.seq(wsInline, pcr, wsInline, P.literal('('))),
          { kind: 'jrlEntry' }));

      // Flat scan: strings/comments first (so their innards are opaque),
      // then entry heads, then a single-char fallthrough.
      var START = P.repeat(
        P.alt(strings, blockComment, lineComment, entryHead, P.notChars('')),
        null, 0);

      return { START: START };
    },

    function collectJrlPositions(text) {
      if ( this.jrlCache_ && this.jrlCache_.text === text ) {
        return this.jrlCache_.map;
      }

      // Leading \n anchors line-start entry heads (see buildGrammar_).
      // All harvested positions are shifted back by 1 (and lines by 1)
      // so records index into the ORIGINAL text.
      var padded = '\n' + text;
      var map = { entries: [], classRefs: [], tripleStrings: [] };
      var DEST = {
        jrlEntry:     'entries',
        jrlClassRef:  'classRefs',
        jrlTripleStr: 'tripleStrings'
      };

      var lineStarts = [ 0 ];
      for ( var ls = 0 ; ls < padded.length ; ls++ ) {
        if ( padded.charCodeAt(ls) === 10 ) lineStarts.push(ls + 1);
      }
      var posToLineCol = function(pos) {
        var lo = 0, hi = lineStarts.length - 1;
        while ( lo < hi ) {
          var mid = ( lo + hi + 1 ) >> 1;
          if ( lineStarts[mid] <= pos ) lo = mid; else hi = mid - 1;
        }
        return { line: lo, col: pos - lineStarts[lo] };
      };

      var apply = function(p, grammar) {
        var startPos = this.pos;
        var result = p.parse(this, grammar);
        if ( result && typeof p.msg === 'function' ) {
          var m = p.msg();
          if ( m && m.kind && DEST[m.kind] ) {
            var lc = posToLineCol(startPos);
            map[DEST[m.kind]].push({
              name:     padded.substring(startPos, result.pos),
              line:     lc.line - 1,
              col:      lc.col,
              startPos: startPos - 1,
              endPos:   result.pos - 1
            });
          }
        }
        return result;
      };

      var ps = foam.parse.StringPStream.create({
        str: padded + String.fromCharCode(26),
        apply: apply
      });

      try { this.parse(ps); } catch ( e ) { /* partial results are fine */ }

      var byStart = function(a, b) { return a.startPos - b.startPos; };
      map.entries.sort(byStart);
      map.classRefs.sort(byStart);
      map.tripleStrings.sort(byStart);

      this.jrlCache_ = { text: text, map: map };
      return map;
    }
  ]
});
