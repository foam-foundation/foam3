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
    }
  ]
});
