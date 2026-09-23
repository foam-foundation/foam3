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

    foam.u2.parse.test.CSSParserJavaTest runs the same cases, with the same
    messages, against the Java grammar (CSSParser.java). A case added or
    changed here gets its twin there in the same commit; see the sync note
    in CSSParser.js.
  `,

  requires: [
    'foam.parse.Parsers',
    'foam.parse.StringPStream',
    'foam.u2.parse.CSSParser',
    'foam.parse.Span'
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
      this.testMissingSemicolon(x);
      this.testImportantPosition(x);
      this.testHazards(x);
      this.testDeepAndLargeInput(x);
      this.testAtRuleClosedByBrace(x);
      this.testDeepSkipBalances(x);
      this.testCaretHazards(x);
      this.testStringLineBreak(x);
      this.testPlaceholderStatement(x);
      this.testStraySemicolon(x);
      this.testLineComment(x);
      this.testUrlBraces(x);
      this.testCustomImportant(x);
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
      x.test(r1 && r1.selectors[0].carets[0].start === input.indexOf('^title') && ! r1.selectors[0].carets[0].inAttr,
        '^title: caret node at its offset');
      x.test(r1 && r1.selectors[2].carets.length === 1 && r1.selectors[2].carets[0].inAttr,
        '[class^=z]: the ^ of ^= is a caret with inAttr (FOAM still rewrites it)');
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
      var summary = tk.map(t => t.name + (t.inMath ? '*' : '')).join(' ');
      x.test(summary === 'sel space-4* primary$hover a* b* c* d',
        'tokens: names in order, * = inside calc/min/max/clamp: got "' + summary + '"');
      x.test(tk.every(t => input.slice(t.start, t.end) === '$' + t.name), 'tokens: every span slices to $name');
      var hover = tk[2];
      x.test(hover.base === 'primary' && hover.variants[0] === 'hover', 'tokens: $primary$hover base and variant');

      var v = p.parseValue('calc(100% - 2 * $space-4)');
      x.test(p.tokens(v)[0].inMath === true, 'tokens: parseValue marks calc() tokens too');
      v = p.parseValue('clamp(1px, $a, max(2px, $b)) $c');
      x.test(p.tokens(v).map(t => t.inMath).join() === 'true,true,false', 'tokens: clamp() and max() count as math, a bare token does not');
    },

    function testErrorsHelper(x) {
      var p = this.CSSParser.create();
      var t = p.parse('^a { color: #zz;; background red } ^b { content: "open');
      var e = p.errors(t);
      x.test(e.map(n => n.kind).join() === 'error,error,string',
        'errors: malformed declaration, unclosed block and unterminated string, got ' + e.map(n => n.kind).join());
      x.test(p.errors(p.parse('^ { a: b }')).length === 0, 'errors: clean input has none');
    },

    // ---- review round 1 ---------------------------------------------------

    function testMissingSemicolon(x) {
      var p = this.CSSParser.create();
      var input = '^ {\n  color: red\n  margin: 0;\n}';
      var t = p.parse(input);
      var e = p.errors(t);
      var d = t.children[0].children;
      x.test(d.length === 1 && d[0].kind === 'declaration' && e.length === 1 && e[0].raw === ':' &&
             e[0].message.indexOf("';' missing") !== -1,
        'missing ;: the merged declaration reports one error on the stray :, got ' + e.map(n => JSON.stringify(n.raw)).join());
      this.spansMatch(x, input, t, 'missing ;');

      input = '@media (min-width: 600px) and (a: b) { ^ { background: f(x: y) [a:b]; } }';
      t = p.parse(input);
      x.test(p.errors(t).length === 0, 'missing ;: a : inside @media ( ), a function or [ ] is not an error');
    },

    function testImportantPosition(x) {
      var p = this.CSSParser.create();
      var v = p.parseValue('red !important blue');
      var e = p.errors(v);
      x.test(v && v.important === false && e.length === 1 && e[0].raw === '!important',
        '!important followed by more value: an error node and important false');
      v = p.parseValue('c !important!important');
      e = p.errors(v);
      x.test(v && v.important === true && e.length === 1 && e[0].start === 2,
        'doubled !important: the first is an error, the last still counts');
      v = p.parseValue('c !important /* note */');
      x.test(v && v.important === true && p.errors(v).length === 0, '!important followed only by a comment is still last');
    },

    function testHazards(x) {
      var p = this.CSSParser.create();
      var input = 'a{b:$x;} ^$y{c:"$z"} /*$w*/ d{e:url($u)} [class^=q]{f:g} h{--v: "$s"}';
      var t = p.parse(input);
      x.test(p.tokens(t).map(n => n.name).join() === 'x,y', 'hazards: tokens() keeps only the meaningful x and y');
      var h = p.hazards(t).map(n => n.kind === 'token' ? n.name + ':' + n.context : 'caret:' + n.inAttr).join(' ');
      x.test(h === 'z:string w:comment u:url caret:true s:string',
        'hazards: string, comment, url tokens and the ^= caret, got "' + h + '"');
      x.test(p.hazards(t).every(n => input.slice(n.start, n.end) === n.raw), 'hazards: every hazard span slices back');
      x.test(p.errors(t).length === 0, 'hazards: none of them is a parse error');
      var c = t.children[2];
      x.test(c.kind === 'comment' && c.token === '$w' && c.tokens[0].context === 'comment',
        'hazards: /*$w*/ keeps its token field and lists the token');
      this.spansMatch(x, input, t, 'hazards');
    },

    function testDeepAndLargeInput(x) {
      var p = this.CSSParser.create();
      function timed(s) {
        var t0 = performance.now();
        var t  = p.parse(s);
        return { t: t, ms: performance.now() - t0 };
      }

      // Unclosed url( in minified CSS used to rescan to end of input for
      // each one: quadratic, 2.5 s at 40 KB.
      var input = 'a{b:url(x}'.repeat(4000);
      var r = timed(input);
      x.test(r.ms < 500 && r.t.end === input.length && r.t.children.length === 4000,
        'unclosed url(: 40 KB of a{b:url(x} parses to 4000 rules in ' + r.ms.toFixed(0) + ' ms (< 500 ms)');

      input = 'url('.repeat(2000);
      r = timed(input);
      x.test(r.ms < 500 && r.t.end === input.length && ! p.errors(r.t).some(e => e.message === 'Internal parser failure'),
        'url( x 2000: parsed without losing the tree, ' + r.ms.toFixed(0) + ' ms');
      this.spansMatch(x, input, r.t, 'url( x 2000');

      input = 'a{'.repeat(2000);
      r = timed(input);
      var deepErr = p.errors(r.t).filter(e => e.message.indexOf('Nested deeper') === 0);
      x.test(r.ms < 500 && deepErr.length === 1 && ! p.errors(r.t).some(e => e.message === 'Internal parser failure'),
        '2000 nested blocks: one "nested deeper" error, no internal failure, ' + r.ms.toFixed(0) + ' ms');

      input = 'a{'.repeat(200) + 'b:c' + '}'.repeat(200);
      r = timed(input);
      x.test(r.t.end === input.length && this.kinds(p.errors(r.t)) === 'error' &&
             p.errors(r.t)[0].message.indexOf('Nested deeper') === 0,
        '200 balanced nested blocks: the skip balances the closers, one depth error, got ' + this.kinds(p.errors(r.t)));
      this.spansMatch(x, input, r.t, '200 nested blocks');

      input = 'a{b:' + '('.repeat(200) + '}';
      r = timed(input);
      x.test(this.kinds(p.errors(r.t)) === 'paren error',
        '200 unclosed parens: errors() lists the outermost open paren and the depth error inside it, got ' + this.kinds(p.errors(r.t)));

      input = 'a{b:' + '('.repeat(5000) + ')'.repeat(5000) + '}';
      r = timed(input);
      x.test(r.ms < 500 && r.t.end === input.length && ! p.errors(r.t).some(e => e.message === 'Internal parser failure'),
        '5000 nested parens: no stack overflow, ' + r.ms.toFixed(0) + ' ms');

      input = '[('.repeat(5000);
      r = timed(input);
      x.test(r.ms < 500 && r.t.end === input.length, '[( x 5000: parsed in ' + r.ms.toFixed(0) + ' ms');
    },

    // ---- review round 2 ---------------------------------------------------

    function testAtRuleClosedByBrace(x) {
      var p = this.CSSParser.create();
      var input = '^ { @apply x }';
      var t = p.parse(input);
      var a = t.children[0] && t.children[0].children[0];
      x.test(a && a.kind === 'atrule' && a.name === 'apply' && a.children === null && a.prelude.raw === 'x' &&
             p.errors(t).length === 0,
        'at-rule closed by }: "@apply x" before } is a statement at-rule, no errors');
      this.spansMatch(x, input, t, 'at-rule closed by }');

      input = 'a{@x}b{c:d}';
      t = p.parse(input);
      x.test(this.kinds(t.children) === 'rule rule' && t.children[1].children[0].property.name === 'c' &&
             p.errors(t).length === 0,
        'at-rule closed by }: the next rule still parses');
      this.spansMatch(x, input, t, 'at-rule closed by } 2');
    },

    // ---- review round 3 ---------------------------------------------------

    function testDeepSkipBalances(x) {
      var p = this.CSSParser.create();
      var input = 'a{'.repeat(70) + '}'.repeat(70) + ' z{q:r}';
      var t = p.parse(input);
      var last = t.children[t.children.length - 1];
      x.test(this.kinds(p.errors(t)) === 'error' && p.errors(t)[0].message.indexOf('Nested deeper') === 0,
        'depth skip: 70 nested blocks give one depth error and no stray }, got ' + this.kinds(p.errors(t)));
      x.test(this.kinds(t.children) === 'rule rule' && last.selectors[0].raw === 'z' && last.children[0].property.name === 'q',
        'depth skip: the rule after the nested blocks parses at top level');
      this.spansMatch(x, input, t, 'depth skip blocks');

      input = 'a{b:' + 'f('.repeat(100) + ')'.repeat(100) + '}';
      t = p.parse(input);
      x.test(this.kinds(p.errors(t)) === 'error' && p.errors(t)[0].message.indexOf('Nested deeper') === 0,
        'depth skip: 100 balanced f( report the depth error, not an unclosed function, got ' + this.kinds(p.errors(t)));
      this.spansMatch(x, input, t, 'depth skip functions');
    },

    function testCaretHazards(x) {
      var p = this.CSSParser.create();
      var input = 'a{content:"^x"} /* ^y */ /*^\n*/ b{c:"^"}';
      var t = p.parse(input);
      var h = p.hazards(t).map(n => n.kind + ':' + n.context).join(' ');
      x.test(h === 'caret:string caret:comment caret:string',
        'caret hazards: a ^ in a string or comment is a hazard, one before a line break is not, got "' + h + '"');
      x.test(t.children[0].children[0].value.components[0].carets.length === 1 && t.children[1].carets[0].start === input.indexOf('^y'),
        'caret hazards: the string and comment list their carets');
      x.test(p.errors(t).length === 0, 'caret hazards: none of them is a parse error');
      this.spansMatch(x, input, t, 'caret hazards');
    },

    function testStringLineBreak(x) {
      // CSS Syntax ends a string at an unescaped line break (a bad-string);
      // the browser then drops the statement up to its next ';' or '}'.
      var p = this.CSSParser.create();
      var v = p.parseValue('"ab\ncd');
      var s = v && v.components[0];
      x.test(s && s.kind === 'string' && s.closed === false && s.raw === '"ab' && s.value === 'ab' &&
             this.kinds(v.components) === 'string ident',
        'line break: an unclosed string ends before the line break, which is not part of it');
      x.test([ '"a\rb', '"a\r\nb', '"a\fb' ].every(i => { var w = p.parseValue(i); return w && w.components[0].raw === '"a' && w.components[0].closed === false; }),
        'line break: CR, CR LF and FF end a string too');

      v = p.parseValue('"a\\\nb" \'c\\\r\nd\'');
      x.test(v && v.components.length === 2 && v.components.every(n => n.kind === 'string' && n.closed) &&
             v.components[0].value === 'ab' && v.components[1].value === 'cd',
        'line break: a backslash before a line break keeps it in the string and drops it from value');

      var input = '^ .x {\n  content: "abc\n}\n^ .y { color: $red; }';
      var t = p.parse(input);
      x.test(p.declarations(t).map(d => d.property).join() === 'content,color' && t.children.length === 2 && t.children[0].closed,
        'line break: a string cut before } leaves the block closed and the next rule parsed');
      x.test(this.kinds(p.errors(t)) === 'string' && p.errors(t)[0].raw === '"abc', 'line break: the cut string is the one error');
      x.test(p.tokens(t).map(n => n.name).join() === 'red', 'line break: tokens after the cut string are found');
      this.spansMatch(x, input, t, 'line break before }');

      input = '^ .label {\n  // WHY DOESN"T WORK?\n  font-size: larger;\n  font-weight: $font-regular;\n  color: $red300;\n}';
      t = p.parse(input);
      var e = p.errors(t);
      x.test(this.kinds(e) === 'error' && e[0].raw === '// WHY DOESN"T WORK?\n  font-size: larger',
        'line break: a stray quote in a // line drops that statement up to its ;, as a browser does');
      x.test(p.declarations(t).map(d => d.property).join() === 'font-weight,color' && p.tokens(t).length === 2,
        'line break: the declarations after that ; are parsed');
      this.spansMatch(x, input, t, 'line break in a statement');

      input = 'a{content:"x\ncolor:red;margin:0}';
      t = p.parse(input);
      var d = p.declarations(t);
      x.test(d.map(n => n.property).join() === 'content,margin' && this.kinds(d[0].node.value.components) === 'string ident error ident',
        'line break: a declaration with a cut string runs to its ;, taking in the next line');
      x.test(this.kinds(p.errors(t)) === 'string error', 'line break: errors lists the cut string and the stray :');
      this.spansMatch(x, input, t, 'line break in a value');

      input = 'a{content:"$primary ^b ^\n;c:d}';
      t = p.parse(input);
      var h = p.hazards(t).map(n => n.kind + ':' + n.context).join(' ');
      x.test(h === 'token:string caret:string' && p.declarations(t).map(n => n.property).join() === 'content,c',
        'line break: $ and ^ in a cut string are hazards, a ^ before the break is not, got "' + h + '"');
      this.spansMatch(x, input, t, 'line break hazards');
    },

    function testPlaceholderStatement(x) {
      // %CUSTOMCSS% is filled in by returnExpandedCSS before the browser
      // sees the CSS.
      var p = this.CSSParser.create();
      var t = p.parse('%CUSTOMCSS%');
      x.test(this.kinds(t.children) === 'placeholder' && t.children[0].name === 'CUSTOMCSS' && p.errors(t).length === 0,
        'placeholder statement: a whole stylesheet of %CUSTOMCSS% is one placeholder, no error');

      var input = '^ { color: red; }\n%CUSTOMCSS%;\n';
      t = p.parse(input);
      x.test(this.kinds(t.children) === 'rule placeholder' && t.children[1].raw === '%CUSTOMCSS%;' && p.errors(t).length === 0,
        'placeholder statement: %CUSTOMCSS%; after a rule keeps its ; in the span');
      this.spansMatch(x, input, t, 'placeholder statement top level');

      input = 'a { color: red; %CUSTOMCSS% ; margin: 0 }';
      t = p.parse(input);
      var r = t.children[0];
      x.test(r && this.kinds(r.children) === 'declaration placeholder declaration' && r.children[1].raw === '%CUSTOMCSS% ;' &&
             p.declarations(t).map(d => d.property).join() === 'color,margin' && p.errors(t).length === 0,
        'placeholder statement: %CUSTOMCSS% ; between declarations in a block');
      this.spansMatch(x, input, t, 'placeholder statement in a block');

      t = p.parse('a { %CUSTOMCSS; color: red }');
      x.test(this.kinds(t.children[0].children) === 'error declaration' &&
             p.errors(t)[0].message === 'Not a declaration, rule or at-rule' && p.errors(t)[0].raw === '%CUSTOMCSS',
        'placeholder statement: %CUSTOMCSS without the closing % is an error');
      x.test([ '%', '% ;', '%%' ].every(i => this.kinds(p.errors(p.parse(i))) === 'error'),
        'placeholder statement: a bare % or %% is an error');

      t = p.parse('%X%.a { b: c } %Y% .d { e: f }');
      x.test(this.kinds(t.children) === 'rule placeholder rule' && t.children[0].selectors[0].raw === '%X%.a' &&
             t.children[2].selectors[0].raw === '.d',
        'placeholder statement: one glued to a selector stays in it, one followed by a space stands alone');
    },

    // ---- review round 4 ---------------------------------------------------
    // Expected results match what Chromium keeps of the same CSS.

    function testStraySemicolon(x) {
      var p   = this.CSSParser.create();
      var msg = "';' between rules: the browser drops the rule after it";
      var input = 'a{color:red};b{color:blue}';
      var t = p.parse(input);
      var e = p.errors(t);
      x.test(this.kinds(t.children) === 'rule error rule' && e.length === 1 && e[0].raw === ';' && e[0].message === msg,
        "stray ;: a ';' between top-level rules is an error node, got " + this.kinds(t.children));
      this.spansMatch(x, input, t, 'stray ; top level');

      input = '@media all { a{color:red}; b{color:blue} }';
      t = p.parse(input);
      var m = t.children[0];
      x.test(m && this.kinds(m.children) === 'rule error rule' && m.children[1].message === msg &&
             m.children[1].start === input.indexOf(';') && p.errors(t).length === 1,
        "stray ;: a ';' between rules in @media is an error node, got " + (m && this.kinds(m.children)));
      this.spansMatch(x, input, t, 'stray ; in @media');

      input = 'b{;color:blue;;}';
      t = p.parse(input);
      x.test(this.kinds(t.children[0].children) === 'declaration' && p.errors(t).length === 0,
        "stray ;: a ';' inside a style rule's block is not an error");
      this.spansMatch(x, input, t, 'stray ; in a rule');

      input = 'b{ &:hover{color:red}; color:blue }';
      t = p.parse(input);
      x.test(this.kinds(t.children[0].children) === 'rule declaration' && p.errors(t).length === 0,
        "stray ;: a ';' after a nested rule in a style block is not an error");
      this.spansMatch(x, input, t, 'stray ; after a nested rule');

      input = '@font-face{font-family:x;;src:url(a.woff)} @page { margin:1in;; }';
      t = p.parse(input);
      x.test(this.kinds(t.children[0].children) === 'declaration declaration' && p.errors(t).length === 0,
        "stray ;: a ';' in @font-face or @page (declaration blocks) is not an error");
      this.spansMatch(x, input, t, 'stray ; in declaration at-rules');

      input = '@layer x { a{}; b{} } @supports (color:red) { a{}; b{} } @keyframes k { from{top:0}; to{top:1px} } @media all { color:red;; b{color:blue} }';
      t = p.parse(input);
      e = p.errors(t);
      x.test(e.length === 4 && e.every(n => n.raw === ';' && n.message === msg) &&
             t.children.map(a => this.kinds(a.children)).join('|') === 'rule error rule|rule error rule|rule error rule|declaration error rule',
        "stray ;: a ';' between rules in top-level @layer, @supports, @keyframes and @media is an error, got " + e.length);
      this.spansMatch(x, input, t, 'stray ; in rule-list at-rules');

      input = 'x{ @media all { a{color:red}; b{color:blue} } } x{ @media all { color:red;; b{color:blue} } } x{ @media a { @supports b { c{}; d{} } } }';
      t = p.parse(input);
      x.test(p.errors(t).length === 0 && t.children.map(r => this.kinds(r.children[0].children)).join('|') === 'rule rule|declaration rule|atrule',
        "stray ;: a ';' in an at-rule nested in a style rule, at any depth, is not an error");
      this.spansMatch(x, input, t, 'stray ; in nested at-rules');

      x.test([ 'a{};', '@media all { a{}; }', 'color:red;;margin:0', ';color:red', 'a{}; /* c */' ].every(i => p.errors(p.parse(i)).length === 0),
        "stray ;: a ';' with no rule or at-rule after it is not an error");
      input = 'a{};/* c */b{}';
      t = p.parse(input);
      x.test(this.kinds(t.children) === 'rule error comment rule' && p.errors(t).length === 1,
        "stray ;: a comment between the ';' and the next rule does not hide it, got " + this.kinds(t.children));
      this.spansMatch(x, input, t, 'stray ; before a comment');

      x.test([ '@page { @top-left { content:"x";; } }', '@font-feature-values F { @swash { a:1;; } }',
               '@page { @top-left { a:1;; b{} } }', '@position-try --p { top:0;; b{} }' ].every(i => p.errors(p.parse(i)).length === 0),
        "stray ;: an at-rule inside @page counts as a declaration block, and so does @position-try");
    },

    function testLineComment(x) {
      // A browser drops the whole statement a '//' starts: a line break does
      // not end it; the next ';', a '{ }' block or the enclosing '}' does.
      var p   = this.CSSParser.create();
      var msg = "'//' is not a CSS comment: the browser drops the statement it starts; use /* */";
      var input = '// note\n^ { color: red }';
      var t = p.parse(input);
      x.test(this.kinds(t.children) === 'error' && t.children[0].raw === input && t.children[0].message === msg,
        '// line: at top level the error runs through the next rule, nothing is kept, got ' + this.kinds(t.children));
      this.spansMatch(x, input, t, '// line top level');

      input = '^ { // note\n color: blue }';
      t = p.parse(input);
      var r = t.children[0];
      x.test(r && r.closed && this.kinds(r.children) === 'error' && r.children[0].raw === '// note\n color: blue' &&
             r.children[0].message === msg && p.errors(t).length === 1,
        '// line: in a block the error runs over the line break up to the closing }, got ' + (r && this.kinds(r.children)));
      this.spansMatch(x, input, t, '// line in a block');

      input = '^ { // note;\n color: blue }';
      t = p.parse(input);
      r = t.children[0];
      x.test(r && this.kinds(r.children) === 'error declaration' && r.children[0].raw === '// note' && p.errors(t).length === 1,
        "// line: a ';' ends it and is skipped in a style block, got " + (r && this.kinds(r.children)));
      this.spansMatch(x, input, t, '// line ended by ;');

      input = '^ { color:red; // x }\nb { color: blue }';
      t = p.parse(input);
      r = t.children[0];
      x.test(this.kinds(t.children) === 'rule rule' && r.closed && this.kinds(r.children) === 'declaration error' &&
             r.children[1].raw === '// x' && p.errors(t).length === 1,
        "// line: a '}' still closes the block, got " + this.kinds(t.children));
      this.spansMatch(x, input, t, '// line ended by }');

      input = '// x; ^ { }';
      t = p.parse(input);
      x.test(this.kinds(t.children) === 'error error rule' && t.children[0].raw === '// x' && t.children[0].message === msg &&
             t.children[1].raw === ';' && t.children[1].message.indexOf("';'") === 0,
        "// line: at top level the ';' after it is its own error, then the rule parses, got " + this.kinds(t.children));
      this.spansMatch(x, input, t, '// line then ; at top level');

      input = '^ { b: c }\n// a\r\n// end';
      t = p.parse(input);
      x.test(this.kinds(t.children) === 'rule error' && t.children[1].raw === '// a\r\n// end',
        '// line: a line break does not end it, end of input does, got ' + this.kinds(t.children));
      this.spansMatch(x, input, t, '// line ends');

      input = 'a { // ^ .x\n { color: red; }\n margin: 0 }';
      t = p.parse(input);
      r = t.children[0];
      x.test(this.kinds(t.children) === 'rule' && r.closed && this.kinds(r.children) === 'error declaration' &&
             r.children[0].raw === '// ^ .x\n { color: red; }' && r.children[1].property.name === 'margin' && p.errors(t).length === 1,
        '// line: a commented-out rule is one error through its block, and the next declaration parses, got ' + (r && this.kinds(r.children)));
      this.spansMatch(x, input, t, '// line with a block');

      input = 'a { // f(;) "b;}" /* ;} */ c\n ; d: e }';
      t = p.parse(input);
      r = t.children[0];
      x.test(r && this.kinds(r.children) === 'error declaration' && r.children[0].raw === '// f(;) "b;}" /* ;} */ c' &&
             p.errors(t).length === 1,
        "// line: a ';' or '}' inside ( ), a string or a comment does not end it, got " + (r && this.kinds(r.children)));
      this.spansMatch(x, input, t, '// line skips units');

      input = 'a { content: "x // y"; background: url(//cdn.x/a.png) } /* // z */';
      t = p.parse(input);
      x.test(p.errors(t).length === 0, "// line: a '//' inside a string, an unquoted url or a comment is not an error");
    },

    function testUrlBraces(x) {
      var p = this.CSSParser.create();
      var svg   = 'data:image/svg+xml;utf8,<svg><style>a{fill:red}</style></svg>';
      var input = 'url(' + svg + ') no-repeat';
      var v = p.parseValue(input);
      var u = v && v.components[0];
      x.test(u && u.kind === 'url' && ! u.quoted && u.value === svg && this.kinds(v.components) === 'url ident',
        'url braces: an unquoted SVG data URL with braces is one url node');
      this.spansMatch(x, input, v, 'url braces value');

      input = 'b{background:url(q{w}e)}';
      var t = p.parse(input);
      var d = p.declarations(t);
      x.test(d.length === 1 && d[0].value === 'url(q{w}e)' && d[0].node.value.components[0].value === 'q{w}e' &&
             p.errors(t).length === 0,
        'url braces: url(q{w}e) in a rule keeps its braces, no errors');
      this.spansMatch(x, input, t, 'url braces rule');
    },

    function testCustomImportant(x) {
      var p = this.CSSParser.create();
      var input = '^ { --gap: 4px !important; --a: 1 ! /* c */ IMPORTANT }';
      var t = p.parse(input);
      var d = t.children[0].children;
      x.test(d.length === 2 && d[0].important && d[0].value.important && d[0].value.raw === '4px' &&
             d[0].value.end === input.indexOf(' !important'),
        'custom !important: important is set and the value span ends before the !');
      x.test(d[1] && d[1].important && d[1].value.raw === '1', 'custom !important: any case, a comment between ! and important');
      x.test(p.declarations(t).map(e => e.value + (e.important ? '!' : '')).join() === '4px!,1!',
        'custom !important: declarations() lists the value without it and important true');
      x.test(p.errors(t).length === 0, 'custom !important: no errors');
      this.spansMatch(x, input, t, 'custom !important');

      input = '--x: a !important b';
      t = p.parse(input);
      var c = t.children[0];
      x.test(c && c.important === false && c.value.raw === 'a !important b' && p.errors(t).length === 0,
        'custom !important: one followed by more text stays in the raw value, important false');
      this.spansMatch(x, input, t, 'custom !important not last');

      input = 'b{--x: a !important /* c */}';
      t = p.parse(input);
      c = t.children[0].children[0];
      x.test(c && c.important && c.value.raw === 'a' && p.errors(t).length === 0,
        'custom !important: comments after it still leave it last');
      this.spansMatch(x, input, t, 'custom !important then a comment');
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
