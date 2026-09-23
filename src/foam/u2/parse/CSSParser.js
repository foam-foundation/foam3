/**
* @license
* Copyright 2025 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.u2.parse',
  name: 'CSSParser',

  documentation:`
    Two grammars over CSS text.

    grammar_ (autocomplete): the narrow grammar foam.u2.StyleConfigurator
    reads through grammar_.getSymParser('colorPropertyValue' | 'borderValue')
    to feed foam.parse.auto.SmartView suggestions. It only has to accept
    what a user types into one of those fields.

    sheetGrammar_ (full): parses FOAM css: text into a tree of plain objects
    with offsets. See the node shapes below and the methods parseValue()
    and parse().

    NODE SHAPES
    Problem: a consumer that underlines a node, or rewrites one, needs the
    exact input text for it, and a tree that only kept parsed values would
    lose "16px" vs "16.0px" or where a comment sat. So every node carries
      kind  : string, one of the kinds below
      start : offset of its first character in the input
      end   : offset just past its last character (exclusive)
      raw   : input.slice(start, end), always
    Kinds and their extra fields:
      comment     text (between /* and */), closed (false when the input
                  ends before */), placeholder ('NAME' for the legacy
                  /*%NAME%*/ form, else null), token ('$name' when the
                  comment is what foam.CSS.replaceTokens leaves behind,
                  /*$name*/, else null)
      value       components (list of the component nodes below, comments
                  included), important (true when !important is present)
      ident       value
      number      value (a JS number: '-1.5e2px' -> -150), unit ('' for a
                  bare number, 'px', '%', ...)
      string      quote (" or '), value (escapes resolved), closed
      hash        value (text after #), isHexColor (3, 4, 6 or 8 hex
                  digits; '#zz' is still a hash, just not a colour)
      token       name ('primary$hover' for $primary$hover), base
                  ('primary'), variants (['hover']), cls ('foam.u2.Tabs'
                  for $foam.u2.Tabs.tabColor, else null), inCalc (false
                  until tokens() or parse() marks it, see there)
      placeholder name ('NAME' for %NAME%)
      function    name, args (component nodes; ',' and '/' are operator
                  nodes), closed
      url         value (the address), quoted, arg (the string node when
                  quoted, else null). url(data:a;b) keeps its ';'.
      paren       components, closed: '( ... )' outside a function, as in
                  @media (min-width: 600px)
      bracket     components, closed: '[ ... ]'
      operator    value, one of , / * + - = : < >
      delim       value, any other single character ('!', '.', '&', ...)
      important   the '!important' marker, last in value.components
  `,


  requires: [
    'foam.parse.Grammar',
    'foam.parse.LiteralIC',
    'foam.parse.Suggest',
    'foam.parse.Parsers',
    'foam.parse.StringPStream',
    'foam.u2.parse.Span'
  ],

  axioms: [
    foam.pattern.Singleton.create()
  ],

  properties: [
    {
      name: 'baseGrammar_',
      value: function(alt, anyChar, literal, not, opt, range, repeat, repeat0, seq, seq1, str, sug, sym) {
        // Override sug to add prepend overrides
        let oldSug = sug;
        sug = (v, opt) => { return oldSug(v, { prependSpaceOnSelect: false, ...opt}) };
        // Add a literal sug
        let sugl = v => sug(v, { text: v});

        return {
          START: sym('css'),
          ws: repeat0(' '),
          css: repeat(
            alt(
              sym('mediaQuery'),
              sym('block')
            )
          ),
          block: seq(
            sym('selector'),
            opt(sym('ws')),
            '{',
            opt(sym('ws')),
            repeat(
              sym('property')
            ),
            opt(sym('ws')),
            '}'
          ),
          mediaQuery: seq(
            '@media',
            opt(sym('ws')),
            sym('mediaCondition'),
            opt(sym('ws')),
            '{',
            repeat(
              sym('block')
            ),
            '}'
          ),
          mediaCondition: repeat(not('{', anyChar()), null, 1),
          selector: repeat(not('{', sym('selectorName')), null, 1),
          selectorName: repeat(not(',', seq(opt('^'), str(repeat(anyChar())))), null, 1),
          property: seq(
            sym('propertyName'),
            opt(sym('ws')),
            ':',
            opt(sym('ws')),
            sym('propertyValue'),
            opt(sym('ws')),
            opt('!important'),
            opt(sym('ws')),
            ';'
          ),
          propertyName: str(repeat(not(':', anyChar()), null, 1)),
          propertyValue: repeat(not(alt('!important', ';'), anyChar()), null, 1),
          genericPropertyValue: repeat(not(alt(' ', ';', '\n', '\r', ','), anyChar()), null, 1),
          typedPropertyValue: alt(
            sym('tokenValue'),
            sym('paddingValue'),
            sym('marginValue'),
            sym('borderValue'),
            sym('colorPropertyValue'),
            sym('genericPropertyValue')
          ),
          // Token suggestions
          tokenValue: sym('tokens'),
          // CSS property value suggestions
          tokenIdentifier: repeat(not(alt(' ', ';', '\n', '\r', ','), anyChar())),
          // Padding suggestions
          paddingValue: seq(
            repeat(
              sym('sizeValue')
            )
          ),
          sizeValue: sug(seq(
            sym('number'),
            opt(sym('sizeUnit'))
          ), { tooltip: 'Size value with optional unit' }),
          number: repeat(
            range('0', '9'), null, 1
          ),
          sizeUnit: alt(
            sugl('px'),
            sugl('em'),
            sugl('rem'),
            sugl('%'),
            sugl('vh'),
            sugl('vw'),
            sugl('vmin'),
            sugl('vmin'),
            sugl('in'),
            sugl('pt'),
            sugl('ch')
          ),
          // Margin suggestions
          marginValue: seq(
            repeat(
              sym('sizeValue')
            )
          ),
          // Border suggestions
          borderValue: seq(
            sym('borderWidth'),
            ' ',
            sym('borderStyle'),
            ' ',
            sym('colorPropertyValue')
          ),
          borderWidth: alt(
            sym('sizeValue'),
            sugl('thin'),
            sugl('medium'),
            sugl('thick')
          ),
          borderStyle: alt(
            sugl('none'),
            sugl('hidden'),
            sugl('dotted'),
            sugl('dashed'),
            sugl('solid'),
            sugl('double'),
            sugl('groove'),
            sugl('ridge'),
            sugl('inset'),
            sugl('outset')
          ),
          // Color value suggestions
          hexValue: str(seq(
            '#', repeat(
              sym('hexDigit'), null, 3, 6
            )
          )),
          hexDigit: alt(
            range('0', '9'),
            range('a', 'f'),
            range('A', 'F')
          ),
          rbgValue: seq(
            alt('rgb', 'rgba'),
            '(',
            sym('rgbNumber'), ',', sym('rgbNumber'), ',', sym('rgbNumber'),
            opt(seq(',', sym('alphaValue'))),
            ')'
          ),
          rgbNumber: range('0', '255'),
          alphaValue: seq(
            '0.', repeat(
              range('0', '9'), null, 1
            )
          ),
          hslValue: seq(
            alt('hsl', 'hsla'),
            '(',
            sym('hue'), ',', sym('percentage'), ',', sym('percentage'),
            opt(seq(',', sym('alphaValue'))),
            ')'
          ),
          hue: range('0', '360'),
          percentage: seq(
            range('0', '100'),
            '%'
          ),
          colorPropertyValue: alt(
            str(seq(sug(literal('$'), { text: '$', label: 'CSS Token', prependSpaceOnSelect: false }), sym('tokenValue'))),
            sug(sym('hexValue'), { view: 'foam.parse.auto.ColorSuggester', label: 'Hex Color' }),
            // Only one is required
            // sug(sym('rbgValue'), { view: 'foam.parse.auto.ColorSuggester', text: 'RGB Color' }),
            // sug(sym('hslValue'), { view: 'foam.parse.auto.ColorSuggester', text: 'HSL Color' }),
            sug('transparent', { text: 'transparent' })
          )
        };
      }
    },
    {
      name: 'tokensGrammar_',
      value: function(action, alt, nyChar, eof, join, literal, literalIC, not, notChars, optional, range,
        repeat, repeat0, seq, seq1, str, sug, sym, until) {
          // Only loading base, maybe add tokens from all classes
          let tokenProps = [];
          let allTokens  = foam.u2.CSSTokens.getAxiomsByClass(foam.u2.CSSToken);
          let token      = (token) => sug(literal(token.name, token), { text: token.name, view: { class: 'foam.parse.auto.CSSTokenSuggester', token: token }, prependSpaceOnSelect: false });

          allTokens.sort((o1, o2) => {
            o1 = o1.name;
            o2 = o2.name;
            return (o2.length - o1.length) || foam.util.compare(o1, o2);
          });

          allTokens.forEach(v => {
            tokenProps.push(token(v));
          });

          return alt.apply(null, tokenProps);
          // Load current theme tokens if they exist
          // Can this work?? Do we need this??
          // if ( this.cssTokenOverrideService ) {
          //   let map = this.cssTokenOverrideService.tokenCache[this.importedTheme.id];
          //   if ( ! map ) return;
          //   let themeTokens = Object.keys(map).map(v => {
          //     return foam.u2.CSSToken.create({ name: v, value: map[v] });
          //   })
          // }
      }
    },
    {
      name: 'grammar_',
      factory: function() {
        let base       = foam.Function.withArgs(this.baseGrammar_,   this.Parsers.create(), this);
        let tokens     = foam.Function.withArgs(this.tokensGrammar_, this.Parsers.create(), this);
        let grammar    = {
          __proto__: base,
          tokens: tokens
        };
        let self       = this;
        let g = this.Grammar.create({
          symbols: grammar
        });

        // let actions    = {
        //   'colorPropertyValue': function (a) {
        //   }
        // };
        // g.addActions(actions);
        return g;
      }
    },
    {
      name: 'sheetGrammar_',
      documentation: 'The full grammar behind parseValue() and parse(); built once per parser.',
      factory: function() {
        return this.Grammar.create({ symbols: this.sheetSymbols_() });
      }
    }
  ],

  constants: {
    // Same pattern as foam.CSS.replaceTokens, so a name found here is the
    // name FOAM would replace. Used where the text is kept raw (selectors,
    // custom property values) instead of being parsed into components.
    TOKEN_RE: /\$[\w$-]+(?:\.[\w$-]+)*/y,
    HEX_COLOR_RE: /^(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/
  },

  methods: [
    function sheetSymbols_() {
      var self = this;
      var P    = this.Parsers.create();
      var alt = P.alt.bind(P), anyChar = P.anyChar.bind(P), chars = P.chars.bind(P),
          eof = P.eof.bind(P), literalIC = P.literalIC.bind(P), notChars = P.notChars.bind(P),
          opt = P.opt.bind(P), peek = P.peek.bind(P), plus = P.plus.bind(P),
          range = P.range.bind(P), repeat = P.repeat.bind(P), seq = P.seq.bind(P),
          seq1 = P.seq1.bind(P), substring = P.substring.bind(P), sym = P.sym.bind(P),
          until = P.until.bind(P);

      // node(kind, p, build): run p, then make { kind, start, end, raw }
      // and let build(n, value, str) add fields. build returning false
      // rejects the match (Span then fails the parse).
      function node(kind, p, build) {
        return self.Span.create({
          p: p,
          build: function(v, start, end, str) {
            var n = { kind: kind, start: start, end: end, raw: str.substring(start, end) };
            return build && build(n, v, str) === false ? undefined : n;
          }
        });
      }

      var nodes = this.nodes_.bind(this);
      var WS    = ' \t\n\r\f';

      return {
        // ---- whitespace and comments ---------------------------------
        ws: plus(chars(WS)),

        wsc: repeat(alt(sym('ws'), sym('comment'))),

        comment: node('comment', alt(
            seq('/*', until('*/')),
            seq('/*', repeat(anyChar()))
          ), function(n) {
            n.closed = n.raw.length >= 4 && n.raw.endsWith('*/');
            n.text   = n.raw.substring(2, n.closed ? n.raw.length - 2 : n.raw.length);
            var m    = /^\s*%([A-Za-z0-9_]+)%\s*$/.exec(n.text);
            n.placeholder = m ? m[1] : null;
            m        = /^\s*(\$[\w$-]+(?:\.[\w$-]+)*)\s*$/.exec(n.text);
            n.token  = m ? m[1] : null;
          }),

        // ---- lexical pieces ------------------------------------------
        identStart: alt(range('a', 'z'), range('A', 'Z'), '_', range('\u0080', '￿')),

        identChar: alt(sym('identStart'), range('0', '9'), '-'),

        identText: substring(alt(
          seq('--', repeat(sym('identChar'))),
          seq(opt('-'), sym('identStart'), repeat(sym('identChar')))
        )),

        digits: plus(range('0', '9')),

        string: alt(sym('dqString'), sym('sqString')),

        dqString: this.stringParser_(P, node, '"'),

        sqString: this.stringParser_(P, node, "'"),

        // ---- value components ----------------------------------------
        value: node('value',
          seq(sym('wsc'), plus(alt(sym('ws'), sym('comment'), sym('important'), sym('component')))),
          function(n, v, str) {
            var comps = nodes(v);
            // A value made only of comments is no value: 'color: /*x*/;'
            if ( ! comps.some(c => c.kind !== 'comment') ) return false;
            n.components = comps;
            n.important  = comps.some(c => c.kind === 'important');
            self.trimTo_(n, comps[0].start, comps[comps.length - 1].end, str);
          }),

        important: node('important', seq('!', sym('wsc'), literalIC('important'))),

        component: alt(
          sym('url'),
          sym('function'),
          sym('number'),
          sym('hash'),
          sym('token'),
          sym('placeholder'),
          sym('string'),
          sym('ident'),
          sym('paren'),
          sym('bracket'),
          sym('operator'),
          sym('delim')
        ),

        // Stop points for an unclosed ( or [: the enclosing statement's
        // ';', a brace, or the end of input. Not consumed.
        unclosed: peek(alt(chars(';{}'), eof())),

        // Inside ( ) a stray ']' is kept as a delim, inside [ ] a stray
        // ')'. Without that, one stray closer ends the value and the whole
        // declaration falls to error recovery.
        parenArgs: repeat(alt(sym('ws'), sym('comment'), sym('component'), node('delim', ']', this.delimValue_))),

        bracketArgs: repeat(alt(sym('ws'), sym('comment'), sym('component'), node('delim', ')', this.delimValue_))),

        function: node('function',
          seq(sym('identText'), '(', sym('parenArgs'), alt(')', sym('unclosed'))),
          function(n, v) {
            n.name   = v[0];
            n.args   = nodes(v[2]);
            n.closed = v[3] === ')';
          }),

        url: node('url',
          seq(literalIC('url('), sym('wsc'), alt(sym('string'), sym('urlRaw')), sym('wsc'), ')'),
          function(n, v) {
            var a    = v[2];
            n.quoted = typeof a !== 'string';
            n.arg    = n.quoted ? a : null;
            n.value  = n.quoted ? a.value : a;
          }),

        // Unquoted url() argument. Takes ';' '{' and '}' as plain text so
        // url(data:image/svg+xml;base64,AAA=) stays one component.
        urlRaw: substring(plus(notChars(')\'"' + WS))),

        paren: node('paren', seq('(', sym('parenArgs'), alt(')', sym('unclosed'))), function(n, v) {
          n.components = nodes(v[1]);
          n.closed     = v[2] === ')';
        }),

        bracket: node('bracket', seq('[', sym('bracketArgs'), alt(']', sym('unclosed'))), function(n, v) {
          n.components = nodes(v[1]);
          n.closed     = v[2] === ']';
        }),

        // The exponent needs a digit after the 'e', so '1em' is 1 + 'em'.
        number: node('number', seq(
            opt(chars('+-')),
            alt(seq(sym('digits'), opt(seq('.', sym('digits')))), seq('.', sym('digits'))),
            opt(seq(chars('eE'), opt(chars('+-')), sym('digits'))),
            opt(alt('%', substring(plus(alt(range('a', 'z'), range('A', 'Z'))))))
          ), function(n, v) {
            n.unit  = v[3] || '';
            n.value = Number(n.raw.substring(0, n.raw.length - n.unit.length));
          }),

        hash: node('hash', seq('#', plus(sym('identChar'))), function(n) {
          n.value      = n.raw.substring(1);
          n.isHexColor = self.HEX_COLOR_RE.test(n.value);
        }),

        tokenChar: alt(range('a', 'z'), range('A', 'Z'), range('0', '9'), chars('_$-')),

        token: node('token',
          seq('$', plus(sym('tokenChar')), repeat(seq('.', plus(sym('tokenChar'))))),
          function(n) { self.fillToken_(n); }),

        placeholder: node('placeholder',
          seq('%', plus(alt(range('A', 'Z'), range('a', 'z'), range('0', '9'), '_')), '%'),
          function(n) { n.name = n.raw.substring(1, n.raw.length - 1); }),

        ident: node('ident', sym('identText'), function(n) { n.value = n.raw; }),

        operator: node('operator', chars(',/*+-=:<>'), this.delimValue_),

        delim: node('delim', notChars(WS + ';{}()[]"\''), this.delimValue_),

        // Entry point of parseValue(): a value and nothing after it.
        valueOnly: seq1(0, sym('value'), eof())
      };
    },

    function stringParser_(P, node, q) {
      // A backslash escapes the next character, including the quote. An
      // unterminated string runs to the end of input and is marked
      // closed: false instead of failing, so one missing quote cannot make
      // the grammar retry every shorter reading of the rest of the input.
      return node('string', P.seq(
          q,
          P.repeat(P.alt(P.seq('\\', P.opt(P.anyChar())), P.notChars(q + '\\'))),
          P.alt(q, P.eof())
        ), (n, v) => {
          n.quote  = q;
          n.closed = v[2] === q;
          var inner = n.raw.substring(1, n.closed ? n.raw.length - 1 : n.raw.length);
          n.value  = this.unescape_(inner);
        });
    },

    function unescape_(s) {
      // CSS escapes: \\26 or \\000026 (hex, one optional trailing space),
      // backslash-newline (line continuation, dropped), backslash-any.
      return s.replace(/\\([0-9a-fA-F]{1,6})[ \t\n]?|\\\n|\\([\s\S])|\\$/g, function(m, hex, ch) {
        if ( hex ) return String.fromCodePoint(Math.min(parseInt(hex, 16), 0x10FFFF) || 0xFFFD);
        return ch || '';
      });
    },

    function delimValue_(n) {
      n.value = n.raw;
    },

    function fillToken_(n) {
      // $primary$hover -> base 'primary', variants ['hover'];
      // $foam.u2.Tabs.tabColor -> cls 'foam.u2.Tabs', base 'tabColor'.
      n.name  = n.raw.substring(1);
      var dot = n.name.lastIndexOf('.');
      n.cls   = dot === -1 ? null : n.name.substring(0, dot);
      var parts  = n.name.substring(dot + 1).split('$');
      n.base     = parts[0];
      n.variants = parts.slice(1);
      n.inCalc   = false;
    },

    function trimTo_(n, start, end, str) {
      n.start = start;
      n.end   = end;
      n.raw   = str.substring(start, end);
    },

    function nodes_(v, opt_out) {
      // Flatten a combinator result (nested arrays, strings for skipped
      // whitespace and punctuation) down to the nodes inside it.
      var out = opt_out || [];
      if ( Array.isArray(v) ) {
        for ( var i = 0 ; i < v.length ; i++ ) this.nodes_(v[i], out);
      } else if ( v && typeof v === 'object' && v.kind ) {
        out.push(v);
      }
      return out;
    },

    function parseValue(str) {
      /* Parse one declaration value ('1px solid $border') into a value node,
         or return null when str is not a single value. Offsets are into str. */
      if ( typeof str !== 'string' ) return null;
      try {
        return this.sheetGrammar_.parseString(str, 'valueOnly') || null;
      } catch (x) {
        console.error('CSSParser.parseValue', x);
        return null;
      }
    },

    function parseString(str, opt_name, opt_apply) {
      let query = this.grammar_.parseString(str, opt_name, opt_apply);
      // if we can simplify the query, do so now (something AND FALSE -> FALSE)
      query = query && query.partialEval ? query.partialEval() : query;
      return query;
    }
  ]
});
