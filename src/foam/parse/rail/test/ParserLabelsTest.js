/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.rail.test',
  name: 'ParserLabelsTest',
  extends: 'foam.core.test.JSTest',

  requires: [ 'foam.parse.Parsers' ],

  documentation: 'One naming table for terminal boxes and the derivation panel; combinators have no name.',

  methods: [
    async function runTest(x) {
      var P = this.Parsers.create(), L = foam.parse.rail.ParserLabels;

      x.test(L.terminal(P.literal('ab'))   === '"ab"',  'Literal is quoted');
      x.test(L.terminal(P.literalIC('ab')) === '"ab"',  'LiteralIC is quoted like Literal');
      x.test(L.badge(P.literalIC('ab'))    === 'aA',    'LiteralIC carries the aA badge');
      x.test(L.badge(P.literal('ab'))      === '',      'Literal carries no badge');
      x.test(L.terminal(P.range('a', 'z')) === 'a…z',   'Range uses the ellipsis');
      x.test(L.terminal(P.chars('xyz'))    === '[xyz]', 'Chars is bracketed');
      x.test(L.terminal(P.notChars('"'))   === '¬["]',  'NotChars is negated brackets');
      x.test(L.terminal(P.anyChar())       === '•',     'AnyChar is a bullet');
      x.test(L.terminal(P.eof())           === '⊣',     'EOF is the end-stop');
      x.test(L.terminal(P.seq(P.literal('a'))) === null, 'a combinator has no terminal label');
      x.test(L.isTerminal(P.eof()) && ! L.isTerminal(P.alt(P.eof())), 'isTerminal follows terminal()');
      x.test(L.name(P.sym('list')) === 'list',          'a rule reference is named by its rule');
      x.test(L.name(P.literal('a')) === '"a"',          'a terminal is named by its label');
      x.test(L.name(P.alt(P.literal('a'))) === null,    'a combinator has no name (its children are hoisted)');

      // Track is pure path-data code: a rounded rect is one closed subpath, a detour has four arcs and the gap opens a second subpath.
      var Tr = foam.parse.rail.Track, rr = Tr.roundRect(0, 0, 10, 10, 2), dt = Tr.detour(20, 80, 10, 40, 14, [ 40, 60 ]);
      x.test(rr.charAt(0) === 'M' && rr.slice(-1) === 'Z' && ( rr.match(/A/g) || [] ).length === 4, 'roundRect begins and closes a path with four arcs');
      x.test(( dt.match(/A/g) || [] ).length === 4 && ( dt.match(/M/g) || [] ).length === 2, 'detour draws four rounded corners and one gap');
    }
  ]
});
