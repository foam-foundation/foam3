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
    and parse(); walk(), declarations(), tokens(), hazards() and errors()
    read the tree.

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
                  /*$name*/, else null), parts (token and caret nodes
                  inside it, context 'comment', in order), tokens and
                  carets (parts filtered by kind)
      value       components (list of the component nodes below, comments
                  included), important (true when !important is present)
      ident       value
      number      value (a JS number: '-1.5e2px' -> -150), unit ('' for a
                  bare number, 'px', '%', ...)
      string      quote (" or '), value (escapes resolved), closed,
                  parts, tokens, carets (as for comment, context
                  'string'). As in CSS, a string ends at an unescaped
                  line break (\\n, \\r or \\f) with closed: false, and the
                  line break is left to what follows. A backslash before
                  the line break keeps it inside (a line continuation,
                  dropped from value). The enclosing statement still runs
                  to its next ';' or '}', as in a browser, which drops
                  that whole statement: in a{content:"x<LF>color:red;margin:0}
                  the declaration content takes in color:red, whose ':'
                  becomes an error node (see value below), and margin
                  parses normally.
      hash        value (text after #), isHexColor (3, 4, 6 or 8 hex
                  digits; '#zz' is still a hash, just not a colour)
      token       name ('primary$hover' for $primary$hover), base
                  ('primary'), variants (['hover']), cls ('foam.u2.Tabs'
                  for $foam.u2.Tabs.tabColor, else null), inMath (true
                  when an enclosing function is calc, min, max or clamp:
                  a token there is resolved before the browser evaluates
                  the maths, which a consumer may want to warn about; it
                  is not a parse error, and FOAM's replacement keeps the
                  rest of the expression intact), context (null for a
                  token meant as one; 'comment', 'string' or 'url' for a
                  $name inside one of those, see hazards())
      placeholder name ('NAME' for %NAME%). Also a statement: a %NAME%
                  in a stylesheet or block, followed by whitespace, ';',
                  '}', a comment or the end of input, is a placeholder
                  node whose span includes a following ';' (the legacy
                  '%CUSTOMCSS%;' that returnExpandedCSS fills in).
      function    name, args (component nodes; ',' and '/' are operator
                  nodes), closed
      url         value (the address), quoted, arg (the string node when
                  quoted, else null), tokens (context 'url', unquoted
                  only). url(data:a;b) keeps its ';'; '(' '{' '}' end an
                  unquoted url.
      paren       components, closed: '( ... )' outside a function, as in
                  @media (min-width: 600px)
      bracket     components, closed: '[ ... ]'
      operator    value, one of , / * + - = : < >
      delim       value, any other single character ('!', '.', '&', ...)
      important   the '!important' marker. Only the last non-comment
                  component counts; an earlier one becomes an error node.
      stylesheet  children (rules, at-rules, declarations, placeholders,
                  comments, errors, in input order)
      rule        selectors (selector nodes, one per comma-separated
                  item), children (declarations, nested rules, at-rules,
                  placeholders, comments, errors), closed. Keyframe
                  blocks such as 'from { }' and '50% { }' are rules too.
      selector    raw text of one selector, trimmed; parts (comment,
                  string, caret and token nodes inside it, in order);
                  carets and tokens (those parts filtered by kind)
      caret       a FOAM '^'; inAttr is true for the '^' of '^=' in
                  [attr^=x], which FOAM still rewrites; context is null
                  in a selector, 'string' or 'comment' for a '^' inside
                  one of those (see hazards())
      atrule      name (lower case, without '@'), prelude, children (null
                  for a statement such as @import ...; ending at ';'),
                  closed
      prelude     components between the at-rule name and its ';' or '{'
      declaration property, value, important, custom, comments (any
                  comments between the property name and the ':')
      property    name, as written
      value       for a custom property (--foo): components is null, the
                  text is kept raw; parts holds the comments, strings,
                  tokens and name( ) functions found in it, tokens every
                  token node at any depth. A ':' outside ( ) or [ ] in a
                  normal value becomes an error node: it is never valid
                  there and usually means a missing ';' merged two
                  declarations.
      error       message; the span of the text that was skipped. Error
                  recovery: a statement that is neither a declaration,
                  a rule nor an at-rule is skipped up to the next ';' or
                  '}' at its own nesting depth (braces, brackets, parens,
                  strings and comments are balanced while skipping), and
                  parsing resumes there. A block still open at end of
                  input gets closed: false and an error spanning its '{'.
                  A run of stray '}' at top level is one error. Nesting
                  deeper than MAX_DEPTH (64) blocks, parens, brackets and
                  functions together is skipped as one error by a loop,
                  not recursion, so deep input cannot overflow the stack;
                  the loop still balances ( [ { against their closers, so
                  the enclosing levels close normally after it.
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
    // Problem: recursive descent uses one JS stack frame chain per nesting
    // level, so ~700 nested blocks or ~1000 nested parens overflowed the
    // stack and lost the whole tree. Past this many nested blocks, parens,
    // brackets and functions (counted together) the rest of the nested text
    // is skipped flat, up to the next ';' or '}', as one error node.
    MAX_DEPTH: 64,
    // Names of the math functions whose tokens get inMath.
    MATH_FN_RE: /(^|-)(calc|min|max|clamp)$/i,
    HEX_COLOR_RE: /^(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/,
    // Which fields of each node kind hold child nodes, in input order.
    CHILD_KEYS: {
      stylesheet:  [ 'children' ],
      rule:        [ 'selectors', 'children' ],
      selector:    [ 'parts' ],
      atrule:      [ 'prelude', 'children' ],
      prelude:     [ 'components' ],
      declaration: [ 'property', 'comments', 'value' ],
      value:       [ 'components', 'parts' ],
      function:    [ 'args' ],
      paren:       [ 'components' ],
      bracket:     [ 'components' ],
      url:         [ 'arg', 'tokens' ],
      comment:     [ 'parts' ],
      string:      [ 'parts' ]
    }
  },

  methods: [
    function sheetSymbols_() {
      var self = this;
      var P    = this.Parsers.create();
      var alt = P.alt.bind(P), chars = P.chars.bind(P), eof = P.eof.bind(P),
          literalIC = P.literalIC.bind(P), notChars = P.notChars.bind(P), not = P.not.bind(P),
          opt = P.opt.bind(P), peek = P.peek.bind(P), plus = P.plus.bind(P),
          range = P.range.bind(P), repeat = P.repeat.bind(P), seq = P.seq.bind(P),
          seq1 = P.seq1.bind(P), substring = P.substring.bind(P), sym = P.sym.bind(P);

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

      // deep(first, p, fallback): p is a nesting construct (block, paren,
      // bracket, function). Below MAX_DEPTH it runs p. At MAX_DEPTH, when
      // 'first' matches (so p would have started here), it runs the
      // non-recursive fallback instead. See MAX_DEPTH.
      //
      // The nesting count is per parse: it lives on ps.str, the one-element
      // array every PStream of a parse shares (and a new parse replaces),
      // so no count is left on this Singleton parser between parses, even
      // after an exception.
      function deep(first, p, fallback) {
        if ( typeof first === 'string' ) first = P.literal(first);
        return {
          parse: function(ps, obj) {
            var d = ps.str;
            if ( ! d.depth ) d.depth = 0;
            if ( d.depth >= self.MAX_DEPTH ) {
              return ps.apply(first, obj) ? ps.apply(fallback, obj) : undefined;
            }
            d.depth++;
            try {
              return ps.apply(p, obj);
            } finally {
              d.depth--;
            }
          },
          toString: function() { return 'deep(' + p.toString() + ')'; }
        };
      }

      // The MAX_DEPTH fallback: skip the too-deep construct with a loop
      // that counts ( [ and { against their closers instead of recursing.
      // Problem it solves: a flat skip up to the next ';' or '}' ate the
      // closers of the enclosing levels, so 70 nested blocks left stray
      // '}' errors and 100 nested f( reported the outer function as
      // unclosed. It stops, unconsumed, at a closer it did not open, at
      // ';' outside its own brackets and, for selectors, at any { } ;.
      // Once it has opened something it stops right after the closer that
      // balances it. Comments and strings are skipped whole.
      function tooDeep(selector) {
        var skip = {
          parse: function(ps, obj) {
            var paren = 0, brace = 0, opened = false, start = ps.pos, r;
            while ( ps.valid ) {
              if ( ( r = ps.apply(sym('comment'), obj) ) || ( r = ps.apply(sym('string'), obj) ) ) { ps = r; continue; }
              var c = ps.head;
              if ( selector && ( c === '{' || c === '}' || c === ';' ) ) break;
              if ( c === ';' && paren === 0 && brace === 0 ) break;
              if ( c === '(' || c === '[' ) { paren++; opened = true; }
              else if ( c === '{' ) { brace++; opened = true; }
              else if ( c === ')' || c === ']' ) { if ( paren === 0 ) break; paren--; }
              else if ( c === '}' ) { if ( brace === 0 ) break; brace--; }
              ps = ps.tail;
              if ( opened && paren === 0 && brace === 0 ) break;
            }
            return ps.pos > start ? ps.setValue(null) : undefined;
          },
          toString: function() { return 'tooDeepSkip()'; }
        };
        return node('error', skip, function(n, v, str) {
          n.message = 'Nested deeper than ' + self.MAX_DEPTH + ' levels: skipped';
          self.trimEnd_(n, str);
        });
      }
      var tooDeepValue    = tooDeep(false);
      var tooDeepSelector = tooDeep(true);

      return {
        // ---- whitespace and comments ---------------------------------
        ws: plus(chars(WS)),

        wsc: repeat(alt(sym('ws'), sym('comment'))),

        // $name and ^ inside the comment are parsed as token and caret
        // nodes (context 'comment', see hazards()) because FOAM rewrites
        // them there too.
        comment: node('comment', seq('/*',
            repeat(alt(sym('token'), sym('textCaret'), notChars('*$^'), seq('*', not('/')), '$', '^')),
            alt('*/', eof())
          ), function(n, v) {
            n.closed = v[2] === '*/';
            n.text   = n.raw.substring(2, n.closed ? n.raw.length - 2 : n.raw.length);
            var m    = /^\s*%([A-Za-z0-9_]+)%\s*$/.exec(n.text);
            n.placeholder = m ? m[1] : null;
            self.fillParts_(n, nodes(v[1]), 'comment');
            n.token  = n.tokens.length === 1 && n.text.trim() === n.tokens[0].raw ? n.tokens[0].raw : null;
          }),

        // A '^' inside a string or comment. foam.u2.CSS expandCSS rewrites
        // /\^(.)/g, a '^' followed by any character but a line break, so
        // only that '^' becomes a node.
        textCaret: node('caret', seq('^', peek(notChars('\n\r\u2028\u2029'))), function(n, v, str) {
          n.inAttr = str[n.end] === '=';
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
            var real  = comps.filter(c => c.kind !== 'comment');
            // A value made only of comments is no value: 'color: /*x*/;'
            if ( ! real.length ) return false;
            var last = real[real.length - 1];
            n.components = comps.map(c =>
              // 'color: red\n margin: 0;' (a missing ';') would otherwise
              // read as one value 'red margin: 0' with no error. Outside
              // ( ) and [ ] a ':' is never valid in a value.
              c.kind === 'operator' && c.value === ':' ?
                self.errorNode_(str, c.start, c.end, "':' inside a value: is a ';' missing before it?") :
              c.kind === 'important' && c !== last ?
                self.errorNode_(str, c.start, c.end, '!important must be the last part of a value') :
              c);
            n.important = last.kind === 'important';
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

        function: deep(seq(sym('identText'), '('), node('function',
          seq(sym('identText'), '(', sym('parenArgs'), alt(')', sym('unclosed'))),
          function(n, v) {
            n.name   = v[0];
            n.args   = nodes(v[2]);
            n.closed = v[3] === ')';
          }), tooDeepValue),

        url: node('url',
          seq(literalIC('url('), sym('wsc'), alt(sym('string'), sym('urlRaw')), sym('wsc'), ')'),
          function(n, v) {
            var a    = v[2];
            n.quoted = a.kind === 'string';
            n.arg    = n.quoted ? a : null;
            n.value  = n.quoted ? a.value : a.text;
            n.tokens = n.quoted ? [] : a.tokens;
          }),

        // Unquoted url() argument: { text, tokens }. ';' is plain text, so
        // url(data:image/svg+xml;base64,AAA=) stays one component. '(' '{'
        // and '}' end it (CSS Syntax makes '(' a bad url): otherwise every
        // unclosed 'url(' in minified CSS scanned to end of input, which was
        // quadratic ('a{b:url(x}' x 4000 = 40 KB took 2.5 s). $name inside
        // is a token with context 'url' (see hazards()).
        // Quote an SVG data URL: unquoted, one with braces inside
        // (url(data:image/svg+xml;utf8,<svg><style>a{fill:red}</style>...))
        // ends at the first '{' and the rest parses as a function plus a
        // made-up rule. FOAM's own css: quotes them.
        urlRaw: self.Span.create({
          p: plus(alt(sym('token'), notChars(')(\'"{}' + WS))),
          build: function(v, start, end, str) {
            return { text: str.substring(start, end), tokens: self.hazardParts_(nodes(v), 'url') };
          }
        }),

        paren: deep('(', node('paren', seq('(', sym('parenArgs'), alt(')', sym('unclosed'))), function(n, v) {
          n.components = nodes(v[1]);
          n.closed     = v[2] === ')';
        }), tooDeepValue),

        bracket: deep('[', node('bracket', seq('[', sym('bracketArgs'), alt(']', sym('unclosed'))), function(n, v) {
          n.components = nodes(v[1]);
          n.closed     = v[2] === ']';
        }), tooDeepValue),

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
          sym('placeholderStatement'),
          sym('rule'),
          sym('recover')
        ),

        // Problem: FOAM's returnExpandedCSS replaces a statement-level
        // '%CUSTOMCSS%;' (foam.core.u2.navigation.Stack) or a whole css:
        // '%CUSTOMCSS%' (foam.u2.layout.MDStackView) with theme CSS before
        // the browser sees it, but it read here as 'Not a declaration, rule
        // or at-rule'. A %NAME% standing alone is a placeholder statement;
        // one glued to more text ('%X%.a { }') is left to rule and recover.
        placeholderStatement: node('placeholder',
          seq(sym('placeholder'), peek(alt(chars(WS + ';}'), '/*', eof())), opt(seq(opt(sym('ws')), ';'))),
          function(n, v) { n.name = v[0].name; }),

        // '{' items '}'. Never fails once '{' is seen: end of input closes
        // it with closed: false. Value is { node: [..], start, end }.
        // At MAX_DEPTH the value is an error node instead (see fillBlock_).
        block: deep('{', self.Span.create({ p: seq('{',
          repeat(alt(sym('ws'), sym('comment'), sym('item'), ';')),
          alt('}', eof())) }), tooDeepValue),

        rule: node('rule', seq(plus(sym('selector'), ','), sym('block')), function(n, v, str) {
          n.selectors = nodes(v[0]);
          self.fillBlock_(n, v[1], str);
        }),

        // One selector of a comma list, as raw text. ( ) [ ] strings and
        // comments are units, so ':is(a, b)' and '[data-x="{"]' stay
        // inside; FOAM's '^' and $name are nodes (parts). Meeting ';' or
        // '}' before '{' means this was not a rule.
        selector: node('selector',
          plus(alt(sym('comment'), sym('string'), sym('caret'), sym('token'), sym('selParen'), sym('selBracket'),
            notChars('{};,([\'"^'))),
          function(n, v, str) {
            var s = n.start, e = n.end;
            while ( s < e && WS.indexOf(str[s])     !== -1 ) s++;
            while ( e > s && WS.indexOf(str[e - 1]) !== -1 ) e--;
            if ( s === e ) return false;
            self.trimTo_(n, s, e, str);
            n.parts  = nodes(v);
            n.carets = n.parts.filter(c => c.kind === 'caret');
            n.tokens = n.parts.filter(c => c.kind === 'token');
          }),

        // FOAM expands every '^' (foam.u2.CSS expandCSS), including the one
        // in [class^=x], which it turns into [class.foam-Cls=x].
        caret: node('caret', '^', function(n, v, str) {
          n.inAttr  = str[n.end] === '=';
          n.context = null;
        }),

        selParen: deep('(', seq('(', repeat(alt(sym('comment'), sym('string'), sym('caret'), sym('token'),
          sym('selParen'), sym('selBracket'), notChars('{};()[\'"^'))), opt(')')), tooDeepSelector),

        selBracket: deep('[', seq('[', repeat(alt(sym('comment'), sym('string'), sym('caret'), sym('token'),
          sym('selParen'), sym('selBracket'), notChars('{};]([\'"^'))), opt(']')), tooDeepSelector),

        atRule: node('atrule',
          seq('@', substring(plus(sym('identChar'))), sym('prelude'), alt(';', sym('block'), peek('}'), eof())),
          function(n, v, str) {
            n.name    = v[1].toLowerCase();
            n.prelude = v[2];
            // v[3] is the block's { node, start, end }, the error node that
            // replaced a block past MAX_DEPTH, or ';' / '' / the value
            // peek('}') passed through. Peek hands back the stream it got,
            // whose value is the prelude node, so 'is an object' is not
            // enough: '@x}' would read the prelude as a block.
            if ( v[3] && ( v[3].kind === 'error' || v[3].node ) ) {
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
        // '{ a: b }'). parts holds only the nodes found in it: comments,
        // strings, tokens and name( ) functions, so tokens get inMath.
        customValue: node('value',
          repeat(alt(sym('comment'), sym('string'), sym('token'), sym('rawFunction'), plus(sym('identChar')),
            sym('skipParen'), sym('skipBrace'), notChars(';{}(\'"'))),
          function(n, v, str) {
            var s = n.start, e = n.end;
            while ( s < e && WS.indexOf(str[s])     !== -1 ) s++;
            while ( e > s && WS.indexOf(str[e - 1]) !== -1 ) e--;
            self.trimTo_(n, s, e, str);
            n.components = null;
            n.important  = false;
            n.parts      = nodes(v);
            n.tokens     = [];
            self.walk({ kind: 'value', components: n.parts }, t => { if ( t.kind === 'token' && ! t.context ) n.tokens.push(t); });
          }),

        rawFunction: deep(seq(sym('identText'), '('), node('function',
          seq(sym('identText'), '(', repeat(alt(sym('comment'), sym('string'), sym('token'), sym('rawFunction'),
            plus(sym('identChar')), sym('skipParen'), sym('skipBrace'), notChars(')}{(\'"'))), opt(')')),
          function(n, v) {
            n.name   = v[0];
            n.args   = nodes(v[2]);
            n.closed = v[3] === ')';
          }), tooDeepValue),

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
        skipParen: deep('(', seq('(', repeat(alt(sym('comment'), sym('string'), sym('token'),
          sym('skipParen'), sym('skipBrace'), notChars(')}{(\'"'))), opt(')')), tooDeepValue),

        skipBrace: deep('{', seq('{', repeat(alt(sym('comment'), sym('string'), sym('token'),
          sym('skipParen'), sym('skipBrace'), notChars('{}(\'"'))), opt('}')), tooDeepValue),

        // A run of stray '}' (e.g. the closers left over after MAX_DEPTH) is
        // one error, not one per brace.
        strayClose: node('error', seq('}', repeat(alt(sym('ws'), '}'))), function(n, v, str) {
          n.message = 'Unexpected }';
          self.trimEnd_(n, str);
        }),

        // Entry point of parseValue(): a value and nothing after it.
        valueOnly: seq1(0, sym('value'), eof())
      };
    },

    function stringParser_(P, node, q) {
      // A backslash escapes the next character, including the quote and a
      // line break (CR LF counts as one). An unterminated string is marked
      // closed: false instead of failing, so one missing quote cannot make
      // the grammar retry every shorter reading of the rest of the input.
      // $name and ^ inside are token and caret nodes with context
      // 'string' (see hazards()).
      //
      // An unterminated string ends before the next unescaped line break,
      // as CSS Syntax's bad-string does. Problem: running to the end of
      // input, one stray quote hid the rest of its css: block from
      // declarations() and tokens(), e.g. the quote before "bold;" in
      // "font-weight': 'bold;" (DateTimePicker) took in every rule after
      // it. Now the damage stops at the enclosing statement's next ';' or
      // '}', where a browser recovers too, and only that statement is lost.
      return node('string', P.seq(
          q,
          P.repeat(P.alt(P.sym('token'), P.sym('textCaret'), P.seq('\\', P.opt(P.alt('\r\n', P.anyChar()))),
            P.notChars(q + '\\\n\r\f'))),
          P.alt(q, P.peek(P.chars('\n\r\f')), P.eof())
        ), (n, v) => {
          n.quote  = q;
          n.closed = v[2] === q;
          var inner = n.raw.substring(1, n.closed ? n.raw.length - 1 : n.raw.length);
          n.value  = this.unescape_(inner);
          this.fillParts_(n, this.nodes_(v[1]), 'string');
        });
    },

    function unescape_(s) {
      // CSS escapes: \\26 or \\000026 (hex, one optional trailing space),
      // backslash-line-break (line continuation, dropped; the break is LF,
      // CR LF, CR or FF, as the string grammar reads it), backslash-any.
      return s.replace(/\\([0-9a-fA-F]{1,6})[ \t\n]?|\\(?:\r\n|[\n\r\f])|\\([\s\S])|\\$/g, function(m, hex, ch) {
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
      n.inMath   = false;
      n.context  = null;
    },

    function hazardParts_(list, context) {
      // Tokens and carets found inside a comment, string or unquoted url():
      // FOAM's regex rewrites rewrite them anyway (see hazards()).
      var out = list.filter(t => t.kind === 'token' || t.kind === 'caret');
      out.forEach(t => { t.context = context; });
      return out;
    },

    function fillParts_(n, list, context) {
      n.parts  = this.hazardParts_(list, context);
      n.tokens = n.parts.filter(t => t.kind === 'token');
      n.carets = n.parts.filter(t => t.kind === 'caret');
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
      // or, past MAX_DEPTH, the error node that skipped it.
      if ( block.kind === 'error' ) {
        n.children = [ block ];
        n.closed   = false;
        return;
      }
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

    function parse(str) {
      /* Parse a whole stylesheet (or an inline declaration list) into a
         'stylesheet' node. Never throws: malformed input yields 'error'
         nodes, and an internal failure yields a stylesheet holding one
         error node that spans the whole input. */
      if ( typeof str !== 'string' ) str = str == null ? '' : String(str);
      var tree;
      var g = this.sheetGrammar_;
      try {
        tree = g.parseString(str);
      } catch (x) {
        // Not expected since MAX_DEPTH bounds the recursion; kept so the
        // promise 'never throws' holds.
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
      this.markMath_(tree);
      return tree;
    },

    function parseValue(str) {
      /* Parse one declaration value ('1px solid $border') into a value node,
         or return null when str is not a single value. Offsets are into str. */
      if ( typeof str !== 'string' ) return null;
      var g = this.sheetGrammar_;
      try {
        var v = g.parseString(str, 'valueOnly') || null;
        if ( v ) this.markMath_(v);
        return v;
      } catch (x) {
        return null;
      }
    },

    function markMath_(tree) {
      var re = this.MATH_FN_RE;
      this.walk(tree, function(n, ancestors) {
        if ( n.kind === 'token' ) n.inMath = ancestors.some(a => a.kind === 'function' && re.test(a.name));
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
         at-rules outermost first, e.g. [ '@media (max-width: 600px)', '^title, ^x' ].
         A declaration whose value holds an error or open node (a cut
         string, a stray ':') is still listed here although a browser
         drops it, so an audit cross-checks errors(). */
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
      /* Every $token reference meant as one, as its token node ({ name,
         base, variants, cls, inMath, start, end, raw }), from values,
         selectors and custom property values. Occurrences inside a
         comment, string or unquoted url() are left to hazards(). */
      var out = [];
      this.walk(tree, function(n) { if ( n.kind === 'token' && ! n.context ) out.push(n); });
      return out;
    },

    function hazards(tree) {
      // Text FOAM rewrites before the CSS reaches the browser, where the
      // rewrite breaks it:
      // - token nodes with context 'comment', 'string' or 'url'. FOAM's
      //   replaceTokens puts a comment plus the value in place of every
      //   $name, so a comment 'use $primary' gains an inner comment close
      //   and ends early, leaking the rest as CSS; a string or url($x)
      //   gets a comment and a value pasted inside it.
      // - caret nodes with inAttr. FOAM's expandCSS rewrites the '^' of
      //   [class^=x] into [class.foam-Cls=x].
      // - caret nodes with context 'string' or 'comment'. expandCSS
      //   rewrites every '^' in the css text, so content: "^" becomes the
      //   class selector text and a comment's '^' changes too.
      var out = [];
      this.walk(tree, function(n) {
        if ( ( n.kind === 'token' || n.kind === 'caret' ) && n.context ) out.push(n);
        else if ( n.kind === 'caret' && n.inAttr ) out.push(n);
      });
      return out;
    },

    function errors(tree) {
      /* Every 'error' node, plus string, comment, function, paren and
         bracket nodes left open (closed: false). Of nested open nodes only
         the outermost is listed, so '(((' is one open paren, but 'error'
         nodes inside it (a MAX_DEPTH skip, a misplaced !important) are
         still listed. An open rule or at-rule block already has an
         'error' node. Open nodes carry no message: a listed string with
         closed: false is one cut by a line break or the end of input. */
      var out = [];
      this.walk(tree, function(n, ancestors) {
        if ( n.kind === 'error' ) {
          out.push(n);
        } else if ( n.closed === false && n.kind !== 'rule' && n.kind !== 'atrule' &&
                    ! ancestors.some(a => a.closed === false && a.kind !== 'rule' && a.kind !== 'atrule') ) {
          out.push(n);
        }
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
