/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp',
  name: 'FileClassifier',

  documentation: `The ONE answer to "what kind of file is this?" —
    'pom' | 'class' | 'jrl' | 'other'. Both the server dispatch and the
    handlers route through this, so two call sites can never disagree
    (the bug class that shipped an unreachable pom lane: dispatch and
    handler each kept their own sniff, and they drifted).

    Classification is BY PARSE, not by pattern: the first significant
    foam.UPPERCASE( call decides, where "significant" means outside
    comments and string literals — parser combinators for those are
    mirrored from FoamClassGrammar, so a "// foam.POM(" comment or a
    'foam.CLASS(' inside a string can never misroute a file.

    The single non-parser shortcut is a substring fast-reject:
    text.indexOf('foam.') === -1 => 'other', no parse. Plain string op,
    justified by measurement (2026-09-02): a full-text combinator scan
    costs ~ms on 30k-char plain files that gain nothing from it, while
    indexOf answers in ~0.004ms. The shortcut can only ever say "no" —
    every positive classification comes from the parse.`,

  constants: {
    UPPER:      'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    UPPER_REST: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_'
  },

  properties: [
    {
      name: 'parsers_',
      documentation: `Raw combinator parsers, built once: skip parsers for
        the three token shapes a call must not be found inside (block
        comment, line comment, string literal — quote/escape shape
        mirrored from FoamClassGrammar), and callName, which matches
        foam.NAME( at the cursor and yields NAME.`,
      factory: function() {
        var P = foam.parse.Parsers.create();

        var lineComment  = P.seq(P.literal('//'), P.repeat0(P.notChars('\n\r')));
        var blockComment = P.seq(P.literal('/*'), P.until(P.literal('*/')));

        function quotedString(qChar) {
          return P.seq(P.literal(qChar),
            P.repeat0(P.alt(P.literal('\\' + qChar), P.notChars(qChar))),
            P.literal(qChar));
        }

        return {
          skips: [
            blockComment,
            lineComment,
            quotedString("'"),
            quotedString('"'),
            quotedString('`')
          ],
          callName: P.seq1(1, P.literal('foam.'),
            P.str(P.seq(P.chars(this.UPPER),
              P.str(P.repeat(P.chars(this.UPPER_REST), null, 0)))),
            P.repeat0(P.chars(' \t\n\r')),
            P.literal('('))
        };
      }
    }
  ],

  methods: [
    function classify(uri, text) {
      /** 'jrl' (by extension) | 'pom' | 'class' | 'other'. */
      if ( uri && uri.endsWith('.jrl') ) return 'jrl';
      if ( ! text || text.indexOf('foam.') === -1 ) return 'other';

      var name = this.firstSignificantCall_(text);
      if ( name === null )  return 'other';
      return name === 'POM' ? 'pom' : 'class';
    },

    function firstSignificantCall_(text) {
      /**
       * Scan for the first foam.NAME( call outside comments and strings;
       * NAME back, or null. The cursor only stops at characters that can
       * open something interesting — '/', a quote, or 'f' — everything
       * else advances without a parser attempt, which is what keeps this
       * near the substring scan's cost instead of the full parse's.
       */
      var skips    = this.parsers_.skips;
      var callName = this.parsers_.callName;
      var len      = text.length;
      var pos      = 0;

      while ( pos < len ) {
        var c = text.charCodeAt(pos);
        if ( c === 47 /* / */ || c === 39 /* ' */ || c === 34 /* " */ || c === 96 /* \` */ ) {
          var advanced = false;
          for ( var i = 0 ; i < skips.length ; i++ ) {
            var ps = skips[i].parse(this.streamAt_(text, pos));
            if ( ps ) { pos = ps.pos; advanced = true; break; }
          }
          if ( ! advanced ) pos++;
          continue;
        }
        if ( c === 102 /* f */ && text.startsWith('foam.', pos) ) {
          var res = callName.parse(this.streamAt_(text, pos));
          if ( res && res.value ) return res.value;
        }
        pos++;
      }
      return null;
    },

    function streamAt_(text, pos) {
      /** A StringPStream positioned at `pos` — same construction the
       *  stream's own tail getter uses. */
      var ps = foam.parse.StringPStream.create();
      ps.setString(text);
      ps.pos = pos;
      return ps;
    }
  ]
});
