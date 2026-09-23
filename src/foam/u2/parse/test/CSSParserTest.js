/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.parse.test',
  name: 'CSSParserTest',
  extends: 'foam.core.test.JSTest',

  documentation: `
    foam.u2.parse.CSSParser: node shapes, offsets and error recovery of the
    full CSS grammar, plus the autocomplete entry points StyleConfigurator
    uses. Every parse result is also checked with spansMatch(): each node's
    raw must equal input.slice(start, end).
  `,

  requires: [
    'foam.parse.Parsers',
    'foam.parse.StringPStream',
    'foam.u2.parse.CSSParser',
    'foam.u2.parse.Span'
  ],

  methods: [
    function runTest(x) {
      this.testSpan(x);
      this.testValueComponents(x);
      this.testNumbers(x);
      this.testStrings(x);
      this.testUrl(x);
      this.testTokensAndPlaceholders(x);
      this.testValueComments(x);
      this.testValueRejects(x);
      this.testEmptyAndWhitespace(x);
      this.testComments(x);
      this.testRulesAndSelectors(x);
      this.testNestedMedia(x);
      this.testKeyframes(x);
      this.testFontFaceAndImport(x);
      this.testGenericAtRules(x);
      this.testDeclarations(x);
      this.testCustomProperty(x);
      this.testQuotedAndUrlInRules(x);
      this.testRecovery(x);
      this.testUnclosedBlock(x);
      this.testLongLine(x);
      this.testNeverThrows(x);
      this.testWalk(x);
      this.testDeclarationsHelper(x);
      this.testTokensHelper(x);
      this.testErrorsHelper(x);
      this.testAutocompleteCompat(x);
      this.testPluggableTokenNames(x);
    },

    function errorsIn(tree) {
      return this.allNodes(tree).filter(n => n.kind === 'error');
    },

    // ---- helpers ----------------------------------------------------------

    function allNodes(tree) {
      // Every object with a 'kind', found by walking all fields. Written here
      // rather than with CSSParser.walk() so the check does not trust the
      // code it checks.
      var out  = [];
      var seen = new Set();
      function visit(v) {
        if ( ! v || typeof v !== 'object' || seen.has(v) ) return;
        seen.add(v);
        if ( Array.isArray(v) ) { v.forEach(visit); return; }
        if ( v.kind ) out.push(v);
        for ( var k in v ) visit(v[k]);
      }
      visit(tree);
      return out;
    },

    function spansMatch(x, input, tree, label) {
      var bad = this.allNodes(tree).filter(n =>
        n.raw === undefined || input.slice(n.start, n.end) !== n.raw);
      x.test(bad.length === 0, label + ': every node raw === input.slice(start, end)' +
        (bad.length ? ' (first bad: ' + bad[0].kind + ' ' + JSON.stringify(bad[0].raw) + ' @' + bad[0].start + ')' : ''));
    },

    function kinds(list) {
      return list.map(n => n.kind).join(' ');
    },

    // ---- Span helper ------------------------------------------------------

    function testSpan(x) {
      var P  = this.Parsers.create();
      var ps = this.StringPStream.create();
      ps.setString('ab  cd');

      var span = this.Span.create({ p: P.seq(P.repeat(' '), P.plus(P.range('a', 'z'))) });
      var r    = span.parse(ps.tail.tail, null);
      x.test(r && r.value.start === 2 && r.value.end === 6, 'Span: default value records start 2 and end 6');
      x.test(r && r.value.node[1].join('') === 'cd', 'Span: default value keeps the delegate value under node');

      var reject = this.Span.create({ p: P.plus(P.range('a', 'z')), build: () => undefined });
      x.test(reject.parse(ps, null) === undefined, 'Span: build returning undefined fails the parse');

      var built = this.Span.create({ p: P.plus(P.range('a', 'z')), build: (v, s, e, str) => str.slice(s, e).toUpperCase() });
      x.test(built.parse(ps, null).value === 'AB', 'Span: build(value, start, end, str) result becomes the value');
    },

    // ---- values -----------------------------------------------------------

    function testValueComponents(x) {
      var p = this.CSSParser.create();
      var input = '1px solid #fff , a/b !IMPORTANT';
      var v = p.parseValue(input);
      x.test(v && v.kind === 'value', 'value: parses to a value node');
      x.test(v && this.kinds(v.components) === 'number ident hash operator ident operator ident important',
        'value: components are number ident hash operator ident operator ident important, got ' + (v && this.kinds(v.components)));
      x.test(v && v.important === true, 'value: !IMPORTANT (any case) sets important');
      this.spansMatch(x, input, v, 'value');

      input = 'rgb(255, 0, 0)';
      v = p.parseValue(input);
      var f = v && v.components[0];
      x.test(f && f.kind === 'function' && f.name === 'rgb' && f.closed, 'rgb(): a closed function node');
      x.test(f && f.args.filter(a => a.kind === 'number').map(a => a.value).join() === '255,0,0',
        'rgb(): the three channels are real numbers 255, 0, 0');
      this.spansMatch(x, input, v, 'rgb()');

      input = 'hsl(210 50% 40% / .5)';
      v = p.parseValue(input);
      f = v && v.components[0];
      var nums = f ? f.args.filter(a => a.kind === 'number') : [];
      x.test(nums.length === 4 && nums[0].value === 210 && nums[0].unit === '' &&
             nums[1].value === 50 && nums[1].unit === '%' && nums[3].value === 0.5,
        'hsl(): hue 210 is a number, 50% a percentage, .5 alpha is 0.5');
      x.test(f && f.args.some(a => a.kind === 'operator' && a.value === '/'), 'hsl(): the / separator is an operator node');
      this.spansMatch(x, input, v, 'hsl()');

      input = 'linear-gradient(to right, rgba(0,0,0,.5) 0%, var(--c, $primary) 100%)';
      v = p.parseValue(input);
      f = v && v.components[0];
      x.test(f && f.name === 'linear-gradient' && f.args.filter(a => a.kind === 'function').map(a => a.name).join() === 'rgba,var',
        'linear-gradient(): nested rgba() and var() are function nodes');
      this.spansMatch(x, input, v, 'linear-gradient()');

      input = 'repeat(2, [col-start] 1fr)';
      v = p.parseValue(input);
      x.test(v && v.components[0].args.some(a => a.kind === 'bracket' && a.closed), 'grid: [col-start] is a bracket node');
    },

    function testNumbers(x) {
      var p = this.CSSParser.create();
      var cases = [
        [ '16px',   16,   'px'  ],
        [ '1.5rem', 1.5,  'rem' ],
        [ '50%',    50,   '%'   ],
        [ '0',      0,    ''    ],
        [ '-2px',   -2,   'px'  ],
        [ '+.25em', 0.25, 'em'  ],
        [ '1e3',    1000, ''    ],
        [ '1em',    1,    'em'  ],
        [ '360deg', 360,  'deg' ]
      ];
      cases.forEach(c => {
        var v = p.parseValue(c[0]);
        var n = v && v.components[0];
        x.test(n && n.kind === 'number' && n.value === c[1] && n.unit === c[2] && v.components.length === 1,
          'number: ' + c[0] + ' -> ' + c[1] + ' unit "' + c[2] + '"');
      });
    },

    function testStrings(x) {
      var p = this.CSSParser.create();
      var input = '"a;b}c" \'it\\\'s\' "\\"q\\""';
      var v = p.parseValue(input);
      var s = v ? v.components : [];
      x.test(s.length === 3 && s.every(n => n.kind === 'string' && n.closed), 'string: three closed strings');
      x.test(s[0] && s[0].value === 'a;b}c', 'string: ; and } inside quotes are text');
      x.test(s[1] && s[1].value === "it's" && s[1].quote === "'", "string: single quotes with an escaped quote");
      x.test(s[2] && s[2].value === '"q"', 'string: escaped double quotes');
      this.spansMatch(x, input, v, 'strings');

      v = p.parseValue('"\\26 x"');
      x.test(v && v.components[0].value === '&x', 'string: hex escape \\26 plus one space is &');

      v = p.parseValue('"open');
      x.test(v && v.components[0].closed === false && v.components[0].value === 'open',
        'string: unterminated string runs to end of input with closed false');
    },

    function testUrl(x) {
      var p = this.CSSParser.create();
      var input = 'url(data:image/svg+xml;base64,AAA=) no-repeat';
      var v = p.parseValue(input);
      var u = v && v.components[0];
      x.test(u && u.kind === 'url' && ! u.quoted && u.value === 'data:image/svg+xml;base64,AAA=',
        'url: unquoted data URL keeps its ; inside one url node');
      x.test(v && v.components[1].kind === 'ident', 'url: parsing continues after the url');
      this.spansMatch(x, input, v, 'url unquoted');

      input = 'url( "a b.png" )';
      v = p.parseValue(input);
      u = v && v.components[0];
      x.test(u && u.kind === 'url' && u.quoted && u.value === 'a b.png' && u.arg.kind === 'string',
        'url: quoted argument is a string node under arg');
      this.spansMatch(x, input, v, 'url quoted');
    },

    function testTokensAndPlaceholders(x) {
      var p = this.CSSParser.create();
      var input = '$primary$hover $space-4 $foam.u2.Tabs.tabColor %LEGACY%';
      var v = p.parseValue(input);
      var c = v ? v.components : [];
      x.test(c[0] && c[0].kind === 'token' && c[0].name === 'primary$hover' && c[0].base === 'primary' &&
             c[0].variants.join() === 'hover', '$primary$hover: one token, base primary, variant hover');
      x.test(c[1] && c[1].kind === 'token' && c[1].name === 'space-4', '$space-4: the - is part of the name');
      x.test(c[2] && c[2].cls === 'foam.u2.Tabs' && c[2].base === 'tabColor', '$foam.u2.Tabs.tabColor: class-scoped token');
      x.test(c[3] && c[3].kind === 'placeholder' && c[3].name === 'LEGACY', '%LEGACY%: placeholder node');
      this.spansMatch(x, input, v, 'tokens');
    },

    function testValueComments(x) {
      var p = this.CSSParser.create();
      var input = '/*%PRIMARY%*/ #406dea\t/* two\nlines */\n1px /*$primary*/ red';
      var v = p.parseValue(input);
      var c = v ? v.components : [];
      x.test(c[0] && c[0].kind === 'comment' && c[0].placeholder === 'PRIMARY',
        'comment: /*%PRIMARY%*/ is a comment node with placeholder PRIMARY');
      x.test(c[1] && c[1].kind === 'hash' && c[1].isHexColor, 'comment: the #hex after the legacy comment is a hash colour');
      x.test(c[2] && c[2].kind === 'comment' && c[2].text === ' two\nlines ', 'comment: multi-line comment text');
      x.test(c[4] && c[4].token === '$primary', 'comment: /*$primary*/ (replaceTokens output) records the token');
      x.test(this.kinds(c) === 'comment hash comment number comment ident', 'comment: tabs and newlines separate components');
      this.spansMatch(x, input, v, 'comments');
    },

    function testValueRejects(x) {
      var p = this.CSSParser.create();
      x.test(p.parseValue('') === null, 'parseValue: empty string is null');
      x.test(p.parseValue('/* only */') === null, 'parseValue: a value of only comments is null');
      x.test(p.parseValue('a )') === null, 'parseValue: a stray ) is null');
      x.test(p.parseValue(null) === null, 'parseValue: non-string is null');
      var v = p.parseValue('#zz');
      x.test(v && v.components[0].kind === 'hash' && v.components[0].isHexColor === false,
        'hash: #zz is a hash that is not a colour, not an error');
      v = p.parseValue('rgb(1, 2');
      x.test(v && v.components[0].closed === false, 'function: unclosed at end of input has closed false');
    },

    // ---- stylesheets ------------------------------------------------------

    function testEmptyAndWhitespace(x) {
      var p = this.CSSParser.create();
      var t = p.parse('');
      x.test(t.kind === 'stylesheet' && t.children.length === 0 && t.start === 0 && t.end === 0,
        'empty string: stylesheet with no children');
      t = p.parse(' \t\n\r\n ');
      x.test(t.children.length === 0 && this.errorsIn(t).length === 0, 'whitespace only: no children, no errors');
      t = p.parse(null);
      x.test(t.kind === 'stylesheet' && t.children.length === 0, 'null input: empty stylesheet');

      var input = '^a\t{\n\tcolor:\tred;\n\tmargin :\n0\n}\n';
      t = p.parse(input);
      var r = t.children[0];
      x.test(t.children.length === 1 && r.kind === 'rule' && r.children.length === 2 &&
             r.children.every(c => c.kind === 'declaration'), 'tabs and newlines: one rule with two declarations');
      x.test(r && r.children[1].property.name === 'margin' && r.children[1].value.raw === '0',
        'tabs and newlines: "margin :\\n0" is margin = 0');
      this.spansMatch(x, input, t, 'tabs and newlines');
    },

    function testComments(x) {
      var p = this.CSSParser.create();
      var input = '/* head */\n^a /* in selector */ { /* before */ color /* gap */ : /*%PRIMARY%*/ #406dea /* after */; }\n/* tail';
      var t = p.parse(input);
      var r = t.children[1];
      x.test(this.kinds(t.children) === 'comment rule comment', 'comments: top level is comment rule comment, got ' + this.kinds(t.children));
      x.test(r && r.selectors[0].raw === '^a /* in selector */', 'comments: a comment inside a selector stays in its raw text');
      x.test(r && r.children[0].kind === 'comment' && r.children[0].text === ' before ', 'comments: comment inside a block is a child');
      var d = r && r.children[1];
      x.test(d && d.kind === 'declaration' && d.comments.length === 1 && d.comments[0].text === ' gap ',
        'comments: comment between property and : is kept on the declaration');
      x.test(d && d.value.components[0].placeholder === 'PRIMARY' && d.value.components[1].kind === 'hash',
        'comments: legacy /*%PRIMARY%*/ #hex is a placeholder comment then a hash');
      x.test(t.children[2].closed === false && t.children[2].text === ' tail', 'comments: unterminated comment at end has closed false');
      this.spansMatch(x, input, t, 'comments');
    },

    function testRulesAndSelectors(x) {
      var p = this.CSSParser.create();
      var input = '^ { a: b } ^title, .x ^y:not(.a, .b), [class^=z] $sel { c: d }';
      var t = p.parse(input);
      var r0 = t.children[0], r1 = t.children[1];
      x.test(t.children.length === 2 && r0.selectors.length === 1 && r0.selectors[0].raw === '^' &&
             r0.selectors[0].carets.length === 1, '^ alone: one selector "^" with one caret');
      x.test(r1 && r1.selectors.map(s => s.raw).join('|') === '^title|.x ^y:not(.a, .b)|[class^=z] $sel',
        'selector list splits on top-level commas only, got ' + (r1 && r1.selectors.map(s => s.raw).join('|')));
      x.test(r1 && r1.selectors[0].carets[0] === input.indexOf('^title'), '^title: caret offset recorded');
      x.test(r1 && r1.selectors[2].carets.length === 0, '[class^=z]: ^= is not a FOAM caret');
      x.test(r1 && r1.selectors[2].tokens.length === 1 && r1.selectors[2].tokens[0].name === 'sel',
        '$sel inside a selector is noted as a token');
      this.spansMatch(x, input, t, 'selectors');

      input = '^ { color: red; &:hover { color: blue } span:hover{ x: y } }';
      t = p.parse(input);
      var kids = t.children[0].children;
      x.test(this.kinds(kids) === 'declaration rule rule', 'nesting: declaration then two nested rules, got ' + this.kinds(kids));
      x.test(kids[2] && kids[2].selectors[0].raw === 'span:hover', 'nesting: "span:hover{" is a rule, not a declaration');
      this.spansMatch(x, input, t, 'nesting');
    },

    function testNestedMedia(x) {
      var p = this.CSSParser.create();
      var input = '@media (max-width: 600px) and (orientation: landscape) {\n  ^ { padding: 0 }\n  @supports (display: grid) { ^grid { display: grid } }\n}';
      var t = p.parse(input);
      var m = t.children[0];
      x.test(m && m.kind === 'atrule' && m.name === 'media' && m.closed, '@media: a closed at-rule');
      x.test(m && m.prelude.raw === '(max-width: 600px) and (orientation: landscape)', '@media: prelude raw text is trimmed');
      x.test(m && m.prelude.components[0].kind === 'paren' &&
             m.prelude.components[0].components.some(c => c.kind === 'number' && c.value === 600),
        '@media: (max-width: 600px) is a paren holding the number 600');
      x.test(m && this.kinds(m.children) === 'rule atrule', '@media: holds a rule and a nested @supports');
      var sup = m && m.children[1];
      x.test(sup && sup.name === 'supports' && sup.children[0].selectors[0].raw === '^grid', '@supports: its rule parses');
      this.spansMatch(x, input, t, '@media');

      input = '@container card (min-width: 400px) { ^ { gap: 1rem } }';
      t = p.parse(input);
      x.test(t.children[0].name === 'container' && t.children[0].children[0].kind === 'rule', '@container: prelude then rules');
    },

    function testKeyframes(x) {
      var p = this.CSSParser.create();
      var input = '@keyframes spin { from { transform: rotate(0deg) } 50% { opacity: .5 } to { transform: rotate(360deg); } }';
      var t = p.parse(input);
      var k = t.children[0];
      x.test(k && k.name === 'keyframes' && k.prelude.components[0].value === 'spin', '@keyframes: name spin in the prelude');
      x.test(k && k.children.map(r => r.selectors[0].raw).join() === 'from,50%,to', '@keyframes: from, 50%, to are rule selectors');
      var deg = k && k.children[2].children[0].value.components[0].args[0];
      x.test(deg && deg.value === 360 && deg.unit === 'deg', '@keyframes: rotate(360deg) is the number 360 unit deg');
      this.spansMatch(x, input, t, '@keyframes');
    },

    function testFontFaceAndImport(x) {
      var p = this.CSSParser.create();
      var input = '@charset "UTF-8";\n@import url(theme.css) screen;\n@font-face { font-family: "Inter"; src: url(inter.woff2) format("woff2") }\n@page :first { margin: 1in }';
      var t = p.parse(input);
      var c = t.children;
      x.test(this.kinds(c) === 'atrule atrule atrule atrule', 'at-rules: four at-rules');
      x.test(c[0].name === 'charset' && c[0].children === null && c[0].prelude.components[0].value === 'UTF-8',
        '@charset: statement with a string prelude');
      x.test(c[1].name === 'import' && c[1].children === null && c[1].raw.endsWith(';') &&
             c[1].prelude.components[0].kind === 'url' && c[1].prelude.components[0].value === 'theme.css',
        '@import url(theme.css): statement ending at ;, url node in prelude');
      x.test(c[2].name === 'font-face' && c[2].children.map(d => d.property.name).join() === 'font-family,src',
        '@font-face: a declaration block');
      x.test(c[3].name === 'page' && c[3].prelude.raw === ':first' && c[3].children[0].property.name === 'margin',
        '@page :first: prelude and declarations');
      this.spansMatch(x, input, t, 'at-rules');
    },

    function testGenericAtRules(x) {
      var p = this.CSSParser.create();
      var input = '@foo bar baz;\n@layer base { ^ { a: b } }\n@unknown { weird: 1 }';
      var t = p.parse(input);
      var c = t.children;
      x.test(c.length === 3 && c[0].name === 'foo' && c[0].children === null, 'unknown @foo: statement at-rule');
      x.test(c[1].name === 'layer' && c[1].children[0].kind === 'rule', 'unknown @layer: block of rules');
      x.test(c[2].name === 'unknown' && c[2].prelude.raw === '' && c[2].children[0].kind === 'declaration',
        'unknown @unknown: empty prelude, block of declarations');
      x.test(this.errorsIn(t).length === 0, 'unknown at-rules: no errors');
      this.spansMatch(x, input, t, 'generic at-rules');
    },

    function testDeclarations(x) {
      var p = this.CSSParser.create();
      var input = '^ { color: red !important; margin: 0 auto }';
      var t = p.parse(input);
      var d = t.children[0].children;
      x.test(d.length === 2 && d[0].important && d[0].value.components.pop().kind === 'important',
        '!important: flag set and last component is important');
      x.test(d[0].raw === 'color: red !important;', 'declaration span includes its ;');
      x.test(d[1].property.name === 'margin' && d[1].raw === 'margin: 0 auto' && ! d[1].important,
        'last declaration without ; ends before }');
      this.spansMatch(x, input, t, 'declarations');

      input = 'color: red; background: $primary';
      t = p.parse(input);
      x.test(this.kinds(t.children) === 'declaration declaration', 'inline style: declarations at top level');
    },

    function testCustomProperty(x) {
      var p = this.CSSParser.create();
      var input = '^ { --gap: calc( 2 * $space-4 ) ; --blob: { a: b; c: "}" }; --empty:; color: var(--gap) }';
      var t = p.parse(input);
      var d = t.children[0].children;
      x.test(d.length === 4 && d[0].custom && d[0].value.raw === 'calc( 2 * $space-4 )' && d[0].value.components === null,
        'custom property: raw value kept, trimmed, no components');
      x.test(d[0].value.tokens.length === 1 && d[0].value.tokens[0].name === 'space-4', 'custom property: $space-4 noted in its raw value');
      x.test(d[1].custom && d[1].value.raw === '{ a: b; c: "}" }', 'custom property: a braced value with ; and a quoted } stays whole');
      x.test(d[2].custom && d[2].value.raw === '', 'custom property: empty value allowed');
      x.test(! d[3].custom && d[3].value.components[0].name === 'var', 'var(--gap) in a normal declaration is a function');
      x.test(this.errorsIn(t).length === 0, 'custom properties: no errors');
      this.spansMatch(x, input, t, 'custom property');
    },

    function testQuotedAndUrlInRules(x) {
      var p = this.CSSParser.create();
      var input = '^ { content: "a;b}c \\"q\\""; background: url(data:image/svg+xml;base64,AAA=) no-repeat; } ^next { x: y }';
      var t = p.parse(input);
      var d = t.children[0].children;
      x.test(t.children.length === 2 && d.length === 2, 'quoted ; } and unquoted url ; do not end the declaration or rule');
      x.test(d[0].value.components[0].value === 'a;b}c "q"', 'string value with ; } and escaped quotes');
      x.test(d[1].value.components[0].kind === 'url', 'url(data:...;...) is one url component');
      x.test(this.errorsIn(t).length === 0, 'quoted and url: no errors');
      this.spansMatch(x, input, t, 'quoted and url');
    },

    function testRecovery(x) {
      var p = this.CSSParser.create();
      var input = '^a { color: #zz;; background red } ^b { color: blue; }';
      var t = p.parse(input);
      var errs = this.errorsIn(t);
      x.test(errs.length === 1, 'recovery: exactly one error node, got ' + errs.length);
      x.test(errs[0] && errs[0].raw === 'background red', 'recovery: the error spans "background red"');
      var a = t.children[0];
      x.test(a && a.children[0].kind === 'declaration' && a.children[0].value.components[0].isHexColor === false,
        'recovery: "color: #zz" is kept as a declaration (a hash, not a colour)');
      var b = t.children[1];
      x.test(b && b.kind === 'rule' && b.selectors[0].raw === '^b' && b.children[0].value.raw === 'blue',
        'recovery: the following rule still parses');
      this.spansMatch(x, input, t, 'recovery');

      input = '^ { a: (b; c: d } ^n { e: f }';
      t = p.parse(input);
      x.test(t.children.length === 2 && t.children[1].children[0].property.name === 'e',
        'recovery: an unbalanced ( does not swallow the closing } of its block');

      input = '} ^ { a: b }';
      t = p.parse(input);
      x.test(t.children[0].kind === 'error' && t.children[0].message === 'Unexpected }' && t.children[1].kind === 'rule',
        'recovery: stray } at top level is one error, parsing continues');

      input = '^ { color: ; margin: 0; @@@ ; padding: 1px }';
      t = p.parse(input);
      x.test(this.errorsIn(t).length === 2 &&
             t.children[0].children.filter(c => c.kind === 'declaration').map(c => c.property.name).join() === 'margin,padding',
        'recovery: empty value and junk are errors, the good declarations survive');
      this.spansMatch(x, input, t, 'recovery 2');
    },

    function testUnclosedBlock(x) {
      var p = this.CSSParser.create();
      var input = '^a { color: red; ^b { margin: 0';
      var t = p.parse(input);
      var a = t.children[0];
      var errs = this.errorsIn(t);
      x.test(a && a.closed === false && a.children[0].kind === 'error' && a.children[0].raw === '{',
        'unclosed block: closed false and an error spanning its {');
      x.test(errs.length === 2 && errs.every(e => e.message === 'Unclosed block: missing }'),
        'unclosed block: both open blocks report an error');
      x.test(a && a.children[2].kind === 'rule' && a.children[2].children[1].property.name === 'margin',
        'unclosed block: content up to end of input is still parsed');
      x.test(t.end === input.length, 'unclosed block: the tree covers the whole input');
      this.spansMatch(x, input, t, 'unclosed');
    },

    function testLongLine(x) {
      // The shape of a long single-line css: value: one rule whose value
      // embeds a whole SVG (quotes, ';', spaces) as a data URL. The SVG is
      // read from foam.u2.theme.ThemeGlyphs when loaded, else a shortened
      // copy of the same glyph.
      var p   = this.CSSParser.create();
      var svg;
      try {
        svg = foam.u2.theme.ThemeGlyphs.MINIMIZE.factory().template.trim();
      } catch (e) {
        svg = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10" viewBox="0 0 20 10" fill="none"><path d="' +
          'M15.2002 0C15.4834 3.94863e-05 15.7171 0.0920968 15.9004 0.275391L14.5 0.275391C14.6833 0.0920573 14.9169 0 15.2002 0Z'.repeat(12) +
          '" fill="currentColor"/></svg>';
      }
      var decls = [];
      for ( var i = 0 ; i < 20 ; i++ ) decls.push('--c' + i + ': $primary' + i + '; margin-' + i + ': calc(' + i + 'px + $space-' + i + ')');
      var input = '^icon { background-image: url(\'data:image/svg+xml;utf8,' + svg + '\'); ' + decls.join('; ') +
        '; mask: url(data:image/svg+xml;base64,' + 'QUFB'.repeat(100) + ') no-repeat center / 1rem 1rem !important }';
      x.test(input.length > 1500, 'long line: input is ' + input.length + ' characters on one line');

      var t0 = performance.now();
      var t  = p.parse(input);
      var ms = performance.now() - t0;
      x.test(ms < 500, 'long line: parsed in ' + ms.toFixed(1) + ' ms (< 500 ms)');
      var r = t.children[0];
      x.test(t.children.length === 1 && r.kind === 'rule' && r.closed && r.children.length === 42,
        'long line: one closed rule with 42 declarations, got ' + (r && r.children.length));
      x.test(this.errorsIn(t).length === 0, 'long line: no errors');
      x.test(r && r.children[0].value.components[0].kind === 'url' && r.children[0].value.components[0].value.startsWith('data:image/svg+xml;utf8,<svg'),
        'long line: the SVG data URL is one url node');
      this.spansMatch(x, input, t, 'long line');
    },

    function testNeverThrows(x) {
      // Pathological and random input: parse() must return a stylesheet that
      // covers the input, never throw, and never take long.
      var p = this.CSSParser.create();
      var cases = [
        '('.repeat(300), '{'.repeat(300), '}'.repeat(50), '"'.repeat(51), '/*'.repeat(40), '[('.repeat(150),
        '^ { a: ' + 'f('.repeat(200) + ' }', '@'.repeat(30), ';;;', '\\\\', 'a{b:c(d:e{f;g}h)i}j', 'url(' + 'x'.repeat(500)
      ];
      var seed = 42;
      function rnd(n) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; }
      var alphabet = 'ab-_$^%#@!;:{}()[]"\'/*,.0123456789 \t\n\\u(';
      for ( var i = 0 ; i < 200 ; i++ ) {
        var len = 1 + rnd(60), s = '';
        for ( var j = 0 ; j < len ; j++ ) s += alphabet[rnd(alphabet.length)];
        cases.push(s);
      }
      var threw = 0, uncovered = 0, badSpan = 0, slow = 0;
      cases.forEach(c => {
        try {
          var t0 = performance.now();
          var t  = p.parse(c);
          if ( performance.now() - t0 > 200 ) slow++;
          if ( t.kind !== 'stylesheet' || t.start !== 0 || t.end !== c.length ) uncovered++;
          if ( this.allNodes(t).some(n => c.slice(n.start, n.end) !== n.raw) ) badSpan++;
        } catch (e) {
          threw++;
        }
      });
      x.test(threw === 0, 'never throws: ' + cases.length + ' pathological and random inputs, ' + threw + ' threw');
      x.test(uncovered === 0, 'never throws: every tree spans its whole input (' + uncovered + ' did not)');
      x.test(badSpan === 0, 'never throws: every node span matches its raw text (' + badSpan + ' did not)');
      x.test(slow === 0, 'never throws: no input took over 200 ms (' + slow + ' did)');
    },

    // ---- API helpers ------------------------------------------------------

    function testWalk(x) {
      var p = this.CSSParser.create();
      var input = '/*c*/ @media x { ^a, ^b { color: rgb(1, $t, 3) } }';
      var t = p.parse(input);
      var seen = [];
      p.walk(t, n => { seen.push(n); });
      var mine = this.allNodes(t);
      x.test(seen.length === mine.length && mine.every(n => seen.indexOf(n) !== -1),
        'walk: visits every node (' + seen.length + ' of ' + mine.length + ')');
      var starts = seen.filter(n => n.kind !== 'stylesheet').map(n => n.start);
      x.test(starts.every((s, i) => i === 0 || s >= starts[i - 1]),
        'walk: nodes arrive in input order');

      var depthOfT = -1;
      p.walk(t, (n, ancestors) => { if ( n.kind === 'token' ) depthOfT = ancestors.map(a => a.kind).join('>'); });
      x.test(depthOfT === 'stylesheet>atrule>rule>declaration>value>function',
        'walk: ancestors of $t are stylesheet>atrule>rule>declaration>value>function, got ' + depthOfT);

      var count = 0;
      p.walk(t, n => { count++; return n.kind !== 'atrule'; });
      x.test(count === 3, 'walk: returning false skips children (stylesheet, comment, atrule = 3), got ' + count);
    },

    function testDeclarationsHelper(x) {
      var p = this.CSSParser.create();
      var input = 'top: 0; ^title, ^x { color: red } @media (max-width: 600px) { ^ { margin: 0 !important; --gap: 4px } }';
      var d = p.declarations(p.parse(input));
      x.test(d.map(e => e.property).join() === 'top,color,margin,--gap', 'declarations: all four in input order');
      x.test(d[0].path.length === 0, 'declarations: a top-level declaration has an empty path');
      x.test(d[1].path.join('|') === '^title, ^x' && d[1].value === 'red', 'declarations: rule path is its selector list');
      x.test(d[2].path.join('|') === '@media (max-width: 600px)|^' && d[2].important,
        'declarations: nested path is at-rule then rule, important carried');
      x.test(d[3].custom && d[3].value === '4px' && d[3].ancestors.length === 2 && d[3].node.kind === 'declaration',
        'declarations: custom property entry, ancestors and node');
    },

    function testTokensHelper(x) {
      var p = this.CSSParser.create();
      var input = '^$sel { width: calc(100% - 2 * $space-4); color: $primary$hover; margin: min(calc($a + 1px), $b); --g: calc(1px + $c) $d; content: "$notToken" }';
      var tk = p.tokens(p.parse(input));
      var summary = tk.map(t => t.name + (t.inCalc ? '*' : '')).join(' ');
      x.test(summary === 'sel space-4* primary$hover a* b c* d',
        'tokens: names in order, * = inside calc(): got "' + summary + '"');
      x.test(tk.every(t => input.slice(t.start, t.end) === '$' + t.name), 'tokens: every span slices to $name');
      var hover = tk[2];
      x.test(hover.base === 'primary' && hover.variants[0] === 'hover', 'tokens: $primary$hover base and variant');

      var v = p.parseValue('calc(100% - 2 * $space-4)');
      x.test(p.tokens(v)[0].inCalc === true, 'tokens: parseValue marks calc() tokens too');
    },

    function testErrorsHelper(x) {
      var p = this.CSSParser.create();
      var t = p.parse('^a { color: #zz;; background red } ^b { content: "open');
      var e = p.errors(t);
      x.test(e.map(n => n.kind).join() === 'error,error,string',
        'errors: malformed declaration, unclosed block and unterminated string, got ' + e.map(n => n.kind).join());
      x.test(p.errors(p.parse('^ { a: b }')).length === 0, 'errors: clean input has none');
    },

    // ---- autocomplete compatibility ---------------------------------------

    function suggestLabels(p, symbol, input) {
      // Same bookkeeping as foam.parse.auto.SmartView's apply callback: keep
      // the suggestions offered at the furthest position the parse reached.
      var maxPos = 0, sugs = {};
      var apply = function(pp, grammar) {
        if ( pp.suggest && this.pos >= maxPos ) {
          var s = pp.suggest();
          if ( s ) {
            var label = s.tooltip || s.text;
            if ( this.pos > maxPos ) { sugs = {}; maxPos = this.pos; }
            if ( ! sugs[label] ) sugs[label] = s;
          }
        }
        var r = pp.parse(this, grammar);
        if ( r && r.pos > maxPos ) sugs = {};
        return r;
      };
      p.grammar_.getSymParser(symbol).parseString(input, null, apply);
      return Object.keys(sugs);
    },

    function testAutocompleteCompat(x) {
      // StyleConfigurator builds SmartViews on grammar_.getSymParser(
      // 'colorPropertyValue') and ('borderValue'). Expected lists were
      // recorded from the grammar before this change.
      var p = this.CSSParser.create();
      x.test(this.suggestLabels(p, 'colorPropertyValue', '').join() === '$,,transparent',
        'autocomplete: empty colour offers $, hex colour picker, transparent');
      var names = p.tokenNames();
      var afterDollar = this.suggestLabels(p, 'colorPropertyValue', '$');
      x.test(afterDollar.length === names.length && names.every(n => afterDollar.indexOf(n) !== -1),
        'autocomplete: after $ every CSSTokens name is offered (' + afterDollar.length + ')');
      x.test(this.suggestLabels(p, 'borderValue', '').join() === 'Size value with optional unit,thin,medium,thick',
        'autocomplete: empty border offers a size or thin/medium/thick');
      x.test(this.suggestLabels(p, 'borderValue', '1px ').join() === 'none,hidden,dotted,dashed,solid,double,groove,ridge,inset,outset',
        'autocomplete: after a width, border styles are offered');
      x.test(this.suggestLabels(p, 'borderValue', '1px solid ').join() === '$,,transparent',
        'autocomplete: after a style, colour choices are offered');
      x.test(p.grammar_.getSymParser('borderValue').parseString('thin dashed transparent') !== undefined,
        'autocomplete: a full border value still parses');
    },

    function testPluggableTokenNames(x) {
      // CSSParser is a Singleton, so the plugged function is restored after.
      var p = this.CSSParser.create();
      var saved = p.tokenNames;
      try {
        p.tokenNames = () => [ 'brandInk', 'brandInkMuted' ];
        var labels = this.suggestLabels(p, 'colorPropertyValue', '$');
        x.test(labels.join() === 'brandInkMuted,brandInk', 'tokenNames: suggestions come from the plugged function, longest first');
        var ps = this.StringPStream.create();
        ps.setString('$brandInk');
        var r = p.grammar_.getSymParser('colorPropertyValue').parse(ps);
        x.test(r && r.pos === 9, 'tokenNames: a plugged name parses as a whole token');
      } finally {
        p.tokenNames = saved;
      }
      x.test(this.suggestLabels(p, 'colorPropertyValue', '$').length === p.tokenNames().length,
        'tokenNames: restoring the default brings back the CSSTokens list');
    }
  ]
});
