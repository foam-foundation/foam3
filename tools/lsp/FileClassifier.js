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
    CACHE_MAX:  256,
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

        // An escape swallows the backslash AND whatever follows it, whatever
        // that is. Pairing the backslash only with the closing quote read the
        // "\\" in `var a = "\\";` as an escaped quote, so the skip ran past
        // the real terminator and ate the first foam call behind it.
        var escape = P.seq(P.literal('\\'), P.anyChar());

        // Single- and double-quoted strings are LINE-BOUNDED, because JS says
        // they are: an unterminated quote is a syntax error, not a string that
        // runs on to the next quote three functions away.
        //
        // That bound is also what contains the one shape this scanner cannot
        // recognise — a regex literal. The apostrophe in /don't/ is not a
        // quote, but nothing here can tell it from one without tracking the
        // previous significant token to separate regex from division. Bounded
        // to its line, that mis-read ends at the newline; unbounded, it flipped
        // quote parity for the whole rest of the file, which is how a
        // `foam.CLASS(` sitting safely inside a test fixture string came to be
        // read as this file's own definition call.
        function quotedString(qChar) {
          return P.seq(P.literal(qChar),
            P.repeat0(P.alt(escape, P.notChars(qChar + '\n\r'))),
            P.literal(qChar));
        }

        // Template literals genuinely do span lines, so theirs is not bounded.
        var templateString = P.seq(P.literal('`'),
          P.repeat0(P.alt(escape, P.notChars('`'))), P.literal('`'));

        return {
          skips: [
            blockComment,
            lineComment,
            quotedString("'"),
            quotedString('"'),
            templateString
          ],
          callName: P.seq1(1, P.literal('foam.'),
            P.str(P.seq(P.chars(this.UPPER),
              P.str(P.repeat(P.chars(this.UPPER_REST), null, 0)))),
            P.repeat0(P.chars(' \t\n\r')),
            P.literal('('))
        };
      }
    },
    {
      name: 'cache_',
      documentation: `Last answer per URI, keyed by the exact text it was
        computed from. One edit asks this question at least twice (the server
        dispatch, then DiagnosticsHandler), and every guarded request asks it
        again; without a cache each ask re-scans. Scans are cheap when a file
        IS a class — the call is at the top — but a file that classifies
        'other' is scanned to EOF, which measured 1.1ms on this repo's own
        server.js and rises with file size, on a path semanticTokens re-walks
        on every keystroke. Entries are dropped wholesale past CACHE_MAX rather
        than tracked with an LRU: the working set is the open editor tabs, and
        a rebuild costs one scan.`,
      factory: function() { return {}; }
    },
    {
      name: 'callsMemo_',
      documentation: `The last significantCalls() answer and the text it came
        from. A caller asking where the models in a file start asks once per
        model, and the scan is over the whole file; one entry covers that loop
        because a file is processed start to finish before the next one.`,
      value: null
    }
  ],

  methods: [
    function classify(uri, text) {
      /**
       * 'jrl' | 'pom' | 'class' | 'other'.
       *
       * Two kinds are decided by FILENAME before the text is read at all, and
       * both are naming conventions the build itself relies on: a '.jrl'
       * extension, and a file named 'pom.js'. The pom rule is what keeps this
       * the single answer to the question — server.js used to ask the URI in
       * one place and the text in another, and the two split on a pom.js whose
       * foam.POM( was broken mid-edit: the pom cache got invalidated and the
       * diagnostics did not. A half-typed pom is still a pom.
       */
      if ( this.isJrlUri_(uri) ) return 'jrl';
      if ( this.isPomUri_(uri) ) return 'pom';
      if ( ! text || text.indexOf('foam.') === -1 ) return 'other';

      var hit = this.cache_[uri];
      if ( hit && hit.text === text ) return hit.kind;

      var name = this.firstSignificantCall_(text);
      var kind = name === null ? 'other' : ( name === 'POM' ? 'pom' : 'class' );

      if ( uri ) {
        if ( Object.keys(this.cache_).length >= this.CACHE_MAX ) this.cache_ = {};
        this.cache_[uri] = { text: text, kind: kind };
      }
      return kind;
    },

    function isJrlUri_(uri) {
      return !! uri && uri.endsWith('.jrl');
    },

    function isPomUri_(uri) {
      /** 'pom.js', anywhere — the build's own name for a pom. */
      return !! uri && ( uri === 'pom.js' || uri.endsWith('/pom.js') );
    },

    function significantCalls(text) {
      /**
       * Every foam.NAME( call in `text` that sits outside comments and string
       * literals, in source order: { name, offset, line }.
       *
       * This is the same walk classify() runs, just not stopped at the first
       * hit. Anything that needs to know where a file's models START or END
       * asks here, so no caller has to re-scan the source with a regex of its
       * own — a regex sees the `foam.CLASS(` in a doc comment and in a test
       * fixture string exactly as it sees the file's own call.
       */
      if ( ! text ) return [];
      if ( this.callsMemo_ && this.callsMemo_.text === text ) return this.callsMemo_.calls;

      var calls = this.scanCalls_(text, false);

      // Line numbers in one pass over the text, not one pass per call.
      var line = 0;
      var ci   = 0;
      for ( var i = 0 ; i < text.length && ci < calls.length ; i++ ) {
        while ( ci < calls.length && calls[ci].offset === i ) calls[ci++].line = line;
        if ( text.charCodeAt(i) === 10 ) line++;
      }
      while ( ci < calls.length ) calls[ci++].line = line;

      this.callsMemo_ = { text: text, calls: calls };
      return calls;
    },

    function firstSignificantCall_(text) {
      /** Name of the first significant foam.NAME( call, or null. */
      var calls = this.scanCalls_(text, true);
      return calls.length ? calls[0].name : null;
    },

    function scanCalls_(text, stopAtFirst) {
      /**
       * Walk `text` collecting { name, offset } for each foam.NAME( call
       * outside comments and strings. The cursor only stops at characters
       * that can open something interesting — '/', a quote, or 'f' —
       * everything else advances without a parser attempt, which is what
       * keeps this near the substring scan's cost instead of the full
       * parse's. `line` is filled in by significantCalls().
       */
      var skips    = this.parsers_.skips;
      var callName = this.parsers_.callName;
      var len      = text.length;
      var pos      = 0;
      var calls    = [];

      while ( pos < len ) {
        var c = text.charCodeAt(pos);
        if ( c === 47 /* / */ || c === 39 /* ' */ || c === 34 /* " */ || c === 96 /* ` */ ) {
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
          if ( res && res.value ) {
            calls.push({ name: res.value, offset: pos, line: 0 });
            if ( stopAtFirst ) return calls;
            pos = res.pos;
            continue;
          }
        }
        pos++;
      }
      return calls;
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
