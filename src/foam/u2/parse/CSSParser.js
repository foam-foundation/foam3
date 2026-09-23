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
    and parse(); walk(), declarations(), tokens() and errors() read the
    tree.

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
                  for $foam.u2.Tabs.tabColor, else null), inCalc (true
                  when any enclosing function is calc(); FOAM's token
                  replacement puts a /*$name*/ comment and the resolved
                  value into the expression, which is known to break
                  calc(), so this is a flag to warn on, not a parse error)
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
      stylesheet  children (rules, at-rules, declarations, comments,
                  errors, in input order)
      rule        selectors (selector nodes, one per comma-separated
                  item), children (declarations, nested rules, at-rules,
                  comments, errors), closed. Keyframe blocks such as
                  'from { }' and '50% { }' are rules too.
      selector    raw text of one selector, trimmed; carets (offsets of
                  each FOAM '^', not counting '^=' in [attr^=x]); tokens
                  (token nodes for $name inside the selector)
      atrule      name (lower case, without '@'), prelude, children (null
                  for a statement such as @import ...; ending at ';'),
                  closed
      prelude     components between the at-rule name and its ';' or '{'
      declaration property, value, important, custom, comments (any
                  comments between the property name and the ':')
      property    name, as written
      value       for a custom property (--foo): components is null, the
                  text is kept raw and tokens lists the $name found in it
      error       message; the span of the text that was skipped. Error
                  recovery: a statement that is neither a declaration,
                  a rule nor an at-rule is skipped up to the next ';' or
                  '}' at its own nesting depth (braces, brackets, parens,
                  strings and comments are balanced while skipping), and
                  parsing resumes there. A block still open at end of
                  input gets closed: false and an error spanning its '{'.
                  A stray '}' at top level is an error of its own.
      Whitespace is not a node.

    NESTING
    Problem: 'a:hover { }' starts like the declaration 'a: hover'. A
    declaration is tried first and is only accepted when its value ends
    at ';', '}' or end of input; when the value runs into '{' it is a
    nested rule instead. So '^ { &:hover { } }' and 'span:hover{}' inside
    a block are rules, 'color:red;' is a declaration. Declarations are
    also accepted at top level, so an inline style string ('color: red')
    parses too.
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
          let tokenProps = [];
          let allTokens  = this.tokenNames().map(name => {
            let axiom = foam.u2.CSSTokens.getAxiomByName(name);
            return foam.u2.CSSToken.isInstance(axiom) ? axiom : foam.u2.CSSToken.create({ name: name });
          });
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
      }
    },
    {
      class: 'Function',
      name: 'tokenNames',
      documentation: `
        Returns the token names ($ omitted) that autocomplete offers after
        '$'. Defaults to the global foam.u2.CSSTokens. Problem: a theme or an
        app with its own tokens got no suggestions for them, since the list
        was fixed to that one class. Set this to add or replace names; a
        name that is not a foam.u2.CSSTokens axiom is suggested without a
        preview. grammar_ is rebuilt when this changes.
      `,
      value: function() {
        return foam.u2.CSSTokens.getAxiomsByClass(foam.u2.CSSToken).map(t => t.name);
      }
    },
    {
      name: 'grammar_',
      expression: function(tokenNames) {
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
    HEX_COLOR_RE: /^(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/,
    // Which fields of each node kind hold child nodes, in input order.
    CHILD_KEYS: {
      stylesheet:  [ 'children' ],
      rule:        [ 'selectors', 'children' ],
      selector:    [ 'tokens' ],
      atrule:      [ 'prelude', 'children' ],
      prelude:     [ 'components' ],
      declaration: [ 'property', 'comments', 'value' ],
      value:       [ 'components', 'tokens' ],
      function:    [ 'args' ],
      paren:       [ 'components' ],
      bracket:     [ 'components' ],
      url:         [ 'arg' ]
    }
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

        // ---- statements ----------------------------------------------
        START: sym('stylesheet'),

        stylesheet: node('stylesheet',
          repeat(alt(sym('ws'), sym('comment'), sym('item'), ';', sym('strayClose'))),
          function(n, v) { n.children = nodes(v); }),

        item: alt(
          sym('atRule'),
          sym('customDeclaration'),
          sym('declaration'),
          sym('rule'),
          sym('recover')
        ),

        // '{' items '}'. Never fails once '{' is seen: end of input closes
        // it with closed: false. Value is { node: [..], start, end }.
        block: self.Span.create({ p: seq('{',
          repeat(alt(sym('ws'), sym('comment'), sym('item'), ';')),
          alt('}', eof())) }),

        rule: node('rule', seq(sym('selectorText'), sym('block')), function(n, v, str) {
          n.selectors = self.selectorNodes_(v[0].start, v[0].end, str);
          self.fillBlock_(n, v[1], str);
        }),

        // Raw selector text up to '{'. ( ) [ ] strings and comments are
        // skipped as units, so ':is(a, b)' and '[data-x="{"]' stay inside.
        // Meeting ';' or '}' first means this was not a rule.
        selectorText: self.Span.create({ p: plus(alt(
          sym('comment'), sym('string'), sym('selParen'), sym('selBracket'), notChars('{};([\'"'))) }),

        selParen: seq('(', repeat(alt(
          sym('comment'), sym('string'), sym('selParen'), sym('selBracket'), notChars('{};()[\'"'))), opt(')')),

        selBracket: seq('[', repeat(alt(
          sym('comment'), sym('string'), sym('selParen'), sym('selBracket'), notChars('{};]([\'"'))), opt(']')),

        atRule: node('atrule',
          seq('@', substring(plus(sym('identChar'))), sym('prelude'), alt(';', sym('block'), peek('}'), eof())),
          function(n, v, str) {
            n.name    = v[1].toLowerCase();
            n.prelude = v[2];
            if ( v[3] && typeof v[3] === 'object' ) {
              self.fillBlock_(n, v[3], str);
            } else {
              n.children = null;
              n.closed   = true;
            }
            self.trimEnd_(n, str);
          }),

        prelude: node('prelude',
          repeat(alt(sym('ws'), sym('comment'), sym('component'), node('delim', chars(')]'), this.delimValue_))),
          function(n, v, str) {
            n.components = nodes(v);
            var c = n.components;
            if ( c.length ) self.trimTo_(n, c[0].start, c[c.length - 1].end, str);
            else self.trimTo_(n, n.start, n.start, str);
          }),

        property: node('property', sym('identText'), function(n) { n.name = n.raw; }),

        declaration: node('declaration',
          seq(sym('property'), sym('wsc'), ':', sym('value'), sym('declEnd')),
          function(n, v, str) {
            n.property  = v[0];
            n.comments  = nodes(v[1]);
            n.value     = v[3];
            n.important = v[3].important;
            n.custom    = false;
            self.trimEnd_(n, str);
          }),

        // A declaration ends at ';' (kept in its span), or just before '}'
        // or end of input. Anything else, notably '{', means it was not a
        // declaration (see NESTING above).
        declEnd: alt(';', peek('}'), eof()),

        customProperty: node('property', substring(seq('--', repeat(sym('identChar')))),
          function(n) { n.name = n.raw; }),

        customDeclaration: node('declaration',
          seq(sym('customProperty'), sym('wsc'), ':', sym('customValue'), sym('declEnd')),
          function(n, v, str) {
            n.property  = v[0];
            n.comments  = nodes(v[1]);
            n.value     = v[3];
            n.important = false;
            n.custom    = true;
            self.trimEnd_(n, str);
          }),

        // '--foo: anything' keeps the text raw (it may be a whole block,
        // '{ a: b }'); only the $name references inside it are noted.
        customValue: node('value',
          repeat(alt(sym('comment'), sym('string'), sym('skipParen'), sym('skipBrace'), notChars(';{}(\'"'))),
          function(n, v, str) {
            var s = n.start, e = n.end;
            while ( s < e && WS.indexOf(str[s])     !== -1 ) s++;
            while ( e > s && WS.indexOf(str[e - 1]) !== -1 ) e--;
            self.trimTo_(n, s, e, str);
            n.components = null;
            n.important  = false;
            n.tokens     = self.scanTokens_(str, s, e);
          }),

        // ---- error recovery --------------------------------------------
        // Skip one malformed statement: up to (and eating) the next ';', or
        // up to (not eating) the next '}', at the current depth.
        recover: seq1(0,
          node('error', plus(sym('skipAtom')), function(n, v, str) {
            n.message = 'Not a declaration, rule or at-rule';
            self.trimEnd_(n, str);
          }),
          opt(';')),

        skipAtom: alt(sym('comment'), sym('string'), sym('skipParen'), sym('skipBrace'), notChars(';}')),

        // A '}' at depth 0 ends a paren too, so an unbalanced '(' cannot
        // swallow the end of the enclosing block.
        skipParen: seq('(', repeat(alt(
          sym('comment'), sym('string'), sym('skipParen'), sym('skipBrace'), notChars(')}{(\'"'))), opt(')')),

        skipBrace: seq('{', repeat(alt(
          sym('comment'), sym('string'), sym('skipParen'), sym('skipBrace'), notChars('{}(\'"'))), opt('}')),

        strayClose: node('error', '}', function(n) { n.message = 'Unexpected }'; }),

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

    function fillBlock_(n, block, str) {
      // block is the Span value of the 'block' symbol:
      // { node: [ '{', items, '}' or '' ], start, end }
      n.children = this.nodes_(block.node[1]);
      n.closed   = block.node[2] === '}';
      if ( ! n.closed ) {
        // First, so children stay in input order: the error spans the '{'.
        n.children.unshift(this.errorNode_(str, block.start, block.start + 1, 'Unclosed block: missing }'));
      }
    },

    function errorNode_(str, start, end, message) {
      return { kind: 'error', start: start, end: end, raw: str.substring(start, end), message: message };
    },

    function trimEnd_(n, str) {
      var e = n.end;
      while ( e > n.start && ' \t\n\r\f'.indexOf(str[e - 1]) !== -1 ) e--;
      this.trimTo_(n, n.start, e, str);
    },

    function skipQuoted_(str, i, end) {
      // i is at a quote; return the offset just past its closing quote.
      var q = str[i++];
      while ( i < end && str[i] !== q ) i += str[i] === '\\' ? 2 : 1;
      return Math.min(i + 1, end);
    },

    function skipComment_(str, i, end) {
      // i is at '/*'; return the offset just past '*/' (or end).
      var j = str.indexOf('*/', i + 2);
      return j === -1 || j + 2 > end ? end : j + 2;
    },

    function scanTokens_(str, start, end) {
      // $name references in raw text (selectors, custom property values),
      // skipping strings and comments. Same name rule as the token symbol.
      // Tracks the names of open '(' so a token in '--gap: calc(2 * $x)'
      // gets inCalc like one in a parsed value.
      var out    = [];
      var re     = this.TOKEN_RE;
      var parens = [];
      for ( var i = start ; i < end ; ) {
        var c = str[i];
        if ( c === '"' || c === "'" ) { i = this.skipQuoted_(str, i, end); continue; }
        if ( c === '/' && str[i + 1] === '*' ) { i = this.skipComment_(str, i, end); continue; }
        if ( c === '(' ) {
          var f = i;
          while ( f > start && /[\w-]/.test(str[f - 1]) ) f--;
          parens.push(str.substring(f, i));
        }
        if ( c === ')' ) parens.pop();
        if ( c === '$' ) {
          re.lastIndex = i;
          var m = re.exec(str);
          if ( m && i + m[0].length <= end ) {
            var n = { kind: 'token', start: i, end: i + m[0].length, raw: m[0] };
            this.fillToken_(n);
            n.inCalc = parens.some(f => /(^|-)calc$/i.test(f));
            out.push(n);
            i = n.end;
            continue;
          }
        }
        i++;
      }
      return out;
    },

    function selectorNodes_(start, end, str) {
      // Split raw selector text on commas at depth 0 (outside ( ) [ ],
      // strings and comments) into trimmed selector nodes.
      var out = [];
      var self = this;
      function push(s, e) {
        while ( s < e && ' \t\n\r\f'.indexOf(str[s])     !== -1 ) s++;
        while ( e > s && ' \t\n\r\f'.indexOf(str[e - 1]) !== -1 ) e--;
        var n = { kind: 'selector', start: s, end: e, raw: str.substring(s, e), carets: [] };
        for ( var i = s ; i < e ; ) {
          var c = str[i];
          if ( c === '"' || c === "'" ) { i = self.skipQuoted_(str, i, e); continue; }
          if ( c === '/' && str[i + 1] === '*' ) { i = self.skipComment_(str, i, e); continue; }
          if ( c === '^' && str[i + 1] !== '=' ) n.carets.push(i);
          i++;
        }
        n.tokens = self.scanTokens_(str, s, e);
        out.push(n);
      }
      var depth = 0, from = start;
      for ( var i = start ; i < end ; ) {
        var c = str[i];
        if ( c === '"' || c === "'" ) { i = this.skipQuoted_(str, i, end); continue; }
        if ( c === '/' && str[i + 1] === '*' ) { i = this.skipComment_(str, i, end); continue; }
        if ( c === '(' || c === '[' ) depth++;
        else if ( ( c === ')' || c === ']' ) && depth > 0 ) depth--;
        else if ( c === ',' && depth === 0 ) { push(from, i); from = i + 1; }
        i++;
      }
      push(from, end);
      return out;
    },

    function parse(str) {
      /* Parse a whole stylesheet (or an inline declaration list) into a
         'stylesheet' node. Never throws: malformed input yields 'error'
         nodes, and an internal failure yields a stylesheet holding one
         error node that spans the whole input. */
      if ( typeof str !== 'string' ) str = str == null ? '' : String(str);
      var tree;
      try {
        tree = this.sheetGrammar_.parseString(str);
      } catch (x) {
        console.error('CSSParser.parse', x);
        tree = null;
      }
      if ( ! tree ) {
        tree = { kind: 'stylesheet', start: 0, end: str.length, raw: str, children: [] };
        if ( str.length ) tree.children.push(this.errorNode_(str, 0, str.length, 'Internal parser failure'));
      } else if ( tree.end < str.length ) {
        // Not expected (every character has a rule) but kept so the tree
        // always covers the input.
        tree.children.push(this.errorNode_(str, tree.end, str.length, 'Unparsed input'));
        this.trimTo_(tree, 0, str.length, str);
      }
      this.markCalc_(tree);
      return tree;
    },

    function parseValue(str) {
      /* Parse one declaration value ('1px solid $border') into a value node,
         or return null when str is not a single value. Offsets are into str. */
      if ( typeof str !== 'string' ) return null;
      try {
        var v = this.sheetGrammar_.parseString(str, 'valueOnly') || null;
        if ( v ) this.markCalc_(v);
        return v;
      } catch (x) {
        console.error('CSSParser.parseValue', x);
        return null;
      }
    },

    function markCalc_(tree) {
      this.walk(tree, function(n, ancestors) {
        // Tokens from raw text (selectors, custom values) got inCalc from
        // scanTokens_; only parsed tokens have function ancestors.
        if ( n.kind === 'token' && ! n.inCalc ) {
          n.inCalc = ancestors.some(a => a.kind === 'function' && /(^|-)calc$/i.test(a.name));
        }
      });
    },

    function walk(tree, fn) {
      /* Visit every node depth-first in input order. fn(node, ancestors)
         gets the chain of enclosing nodes, outermost first; returning false
         skips that node's children. */
      var keys = this.CHILD_KEYS;
      function visit(n, ancestors) {
        if ( ! n || fn(n, ancestors) === false ) return;
        var ks = keys[n.kind];
        if ( ! ks ) return;
        var next = ancestors.concat([n]);
        for ( var i = 0 ; i < ks.length ; i++ ) {
          var c = n[ks[i]];
          if ( Array.isArray(c) ) c.forEach(k => visit(k, next));
          else if ( c ) visit(c, next);
        }
      }
      visit(tree, []);
    },

    function declarations(tree) {
      /* Flat list of declarations, each as
           { node, property, value, important, custom, path, ancestors }
         property and value are text; path names the enclosing rules and
         at-rules outermost first, e.g. [ '@media (max-width: 600px)', '^title, ^x' ]. */
      var out = [];
      this.walk(tree, function(n, ancestors) {
        if ( n.kind !== 'declaration' ) return;
        var enclosing = ancestors.filter(a => a.kind === 'rule' || a.kind === 'atrule');
        out.push({
          node:      n,
          property:  n.property.name,
          value:     n.value.raw,
          important: n.important,
          custom:    n.custom,
          ancestors: enclosing,
          path:      enclosing.map(a => a.kind === 'rule' ?
            a.selectors.map(s => s.raw).join(', ') :
            '@' + a.name + ( a.prelude.raw ? ' ' + a.prelude.raw : '' ))
        });
        return false;
      });
      return out;
    },

    function tokens(tree) {
      /* Every $token reference as its token node ({ name, base, variants,
         cls, inCalc, start, end, raw }), from values, selectors and custom
         property values. Tokens inside quoted strings, comments or an
         unquoted url() are not listed. */
      var out = [];
      this.walk(tree, function(n) { if ( n.kind === 'token' ) out.push(n); });
      return out;
    },

    function errors(tree) {
      /* The 'error' nodes, plus string, comment, function, paren and
         bracket nodes left open at end of input (closed: false). An open
         rule or at-rule block already has an 'error' node of its own. */
      var out = [];
      this.walk(tree, function(n) {
        if ( n.kind === 'error' ) out.push(n);
        else if ( n.closed === false && n.kind !== 'rule' && n.kind !== 'atrule' ) out.push(n);
      });
      return out;
    },

    function parseString(str, opt_name, opt_apply) {
      let query = this.grammar_.parseString(str, opt_name, opt_apply);
      // if we can simplify the query, do so now (something AND FALSE -> FALSE)
      query = query && query.partialEval ? query.partialEval() : query;
      return query;
    }
  ]
});
