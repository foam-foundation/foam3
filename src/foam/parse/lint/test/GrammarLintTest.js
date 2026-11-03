/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lint.test',
  name: 'GrammarLintTest',
  extends: 'foam.core.test.JSTest',

  documentation: 'Each GrammarLint check fires on a grammar with that mistake and stays quiet on one without it.',

  requires: [
    'foam.parse.Grammar',
    'foam.parse.lint.GrammarLint',
    'foam.parse.lint.test.GrammarLintBaseChildFixture',
    'foam.parse.lint.test.GrammarLintBaseFixture',
    'foam.parse.lint.test.GrammarLintDataFixture',
    'foam.parse.lint.test.GrammarLintLibraryChildFixture',
    'foam.parse.lint.test.GrammarLintLibraryFixture',
    'foam.parse.lint.test.GrammarLintFixture',
    'foam.parse.lint.test.GrammarLintFixtureChild'
  ],

  methods: [
    function runTest(x) {
      var lint = this.GrammarLint.create();
      var self = this;
      var g    = function(fn) { return self.Grammar.create({ symbols: fn }); };
      var checks = function(findings) { return findings.map(function(f) { return f.check + ':' + f.symbol; }).sort().join(' '); };

      // A clean grammar: no findings.
      x.test(checks(lint.lintGrammar(g(function(seq, sym, literal, repeat, range) {
        return {
          START:  seq(sym('number'), literal('+'), sym('number')),
          number: repeat(range('0', '9'), null, 1)
        };
      }))) === '', 'clean grammar has no findings');

      x.test(checks(lint.lintGrammar(g(function(seq, sym, literal) {
        return { START: seq(sym('numbr'), literal('+')) };
      }))) === 'undefined-symbol:START', "sym('numbr') with no rule numbr is undefined-symbol on the rule that names it");

      x.test(checks(lint.lintGrammar(g(function(sym, literal) {
        return { START: literal('a'), extra: literal('b') };
      }))) === 'unreachable:', 'a rule START never reaches is one unreachable warning for the grammar');

      var cut = lint.lintGrammar(g(function(cut, sym, literal) {
        return { START: cut(sym('a')), a: literal('a') };
      }));
      x.test(cut.length === 1 && cut[0].severity === 'skip' && cut[0].check === 'unreachable',
        'a grammar using cut() skips the unreachable check instead of reporting the rules under it');

      x.test(checks(lint.lintGrammar(g(function(literal) {
        return { value: literal('a') };
      }))) === 'no-start:', 'rules without START is no-start');

      // Left recursion: direct, through another rule, and past a rule that can match empty.
      x.test(checks(lint.lintGrammar(g(function(seq, sym, literal) {
        return { START: seq(sym('START'), literal('+')) };
      }))) === 'left-recursion:START', 'rule calling itself first is left-recursion');

      x.test(checks(lint.lintGrammar(g(function(seq, alt, sym, literal) {
        return { START: sym('a'), a: seq(sym('b'), literal('x')), b: alt(sym('a'), literal('y')) };
      }))) === 'left-recursion:a', 'two rules calling each other first is one left-recursion finding');

      x.test(checks(lint.lintGrammar(g(function(seq, sym, literal, optional) {
        return { START: seq(optional(literal('-')), sym('START'), literal('+')) };
      }))) === 'left-recursion:START', 'an optional prefix does not stop left recursion');

      x.test(checks(lint.lintGrammar(g(function(seq, sym, literal) {
        return { START: seq(literal('('), sym('START'), literal(')')) };
      }))) === '', 'recursion after a character is read is not left recursion');

      // Repeats whose item can match empty.
      x.test(checks(lint.lintGrammar(g(function(repeat, optional, literal) {
        return { START: repeat(optional(literal('a'))) };
      }))) === 'empty-repeat:START', 'repeat of an optional item is empty-repeat');

      x.test(checks(lint.lintGrammar(g(function(repeat, optional, literal) {
        return { START: repeat(optional(literal('a')), literal(',')) };
      }))) === '', 'a delimiter that reads a character makes progress');

      x.test(checks(lint.lintGrammar(g(function(repeat, optional, literal) {
        return { START: repeat(optional(literal('a')), null, 0, 3) };
      }))) === '', 'a bounded repeat ends');

      x.test(checks(lint.lintGrammar(g(function(repeat, alt, literal, eof) {
        return { START: repeat(alt(literal('a'), eof())) };
      }))) === '', 'repeat() stops at the end of the input, so an eof() item ends');

      // repeat0() has no end-of-input stop and skips a delimiter that fails.
      x.test(checks(lint.lintGrammar(g(function(repeat0, alt, literal, eof) {
        return { START: repeat0(alt(literal('a'), eof())) };
      }))) === 'empty-repeat:START', 'repeat0() of an eof() item loops at the end of the input');

      x.test(checks(lint.lintGrammar(g(function(repeat0, optional, literal) {
        return { START: repeat0(optional(literal('a')), literal(',')) };
      }))) === 'empty-repeat:START', 'a repeat0() delimiter does not make progress');

      x.test(checks(lint.lintGrammar(g(function(repeat0, seq, not, alt, until0, literal, eof) {
        return { START: repeat0(seq(not(alt(literal('\n'), eof())), until0(alt(literal('\n'), eof())))) };
      }))) === '', 'not(eof()) fails at the end of the input, so this repeat0() line loop ends');

      // Framework bases are not counted as checked grammars.
      x.test(! lint.isChecked(this.Grammar) && ! lint.isChecked(foam.parse.ImperativeGrammar) && lint.isChecked(this.GrammarLintFixture),
        'isChecked skips Grammar and ImperativeGrammar, keeps a grammar class');

      // Actions, through a class.
      var byCheck = function(cls) { return checks(lint.lintClass(cls)); };
      x.test(byCheck(this.GrammarLintFixture) === 'orphan-action:missing', 'missingAction with no rule missing is orphan-action; STARTAction is fine');
      x.test(byCheck(this.GrammarLintFixtureChild) === 'orphan-action:alsoMissing',
        'a subclass that only adds actions gets only the action check, for its own actions');

      x.test(byCheck(this.GrammarLintBaseFixture) === 'orphan-action:extra', 'a base action with no rule anywhere is orphan-action');
      x.test(checks(lint.lintClasses([ this.GrammarLintBaseFixture, this.GrammarLintBaseChildFixture ])) === '',
        'a base action is used when a subclass defines its rule');

      var library = lint.lintClasses([ this.GrammarLintLibraryFixture, this.GrammarLintLibraryChildFixture ]);
      x.test(checks(library) === 'unreachable:' && library[0].grammar === 'foam.parse.lint.test.GrammarLintLibraryChildFixture' &&
          library[0].message.indexOf('spare') >= 0 && library[0].message.indexOf('letter') < 0,
        'a base with no START is not no-start when a subclass has START; an unused inherited rule is not unreachable');

      var skipped = lint.lintClass(this.GrammarLintDataFixture);
      x.test(skipped.length === 1 && skipped[0].severity === 'skip' && skipped[0].check === 'not-built',
        'a grammar that needs data to build is skipped, not an error');
    }
  ]
});
