/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lint.test',
  name: 'GrammarLintFixture',
  extends: 'foam.parse.Grammar',

  documentation: 'A grammar with one action for a rule it has and one for a rule it does not.',

  methods: [
    function grammar(seq, literal) {
      return { START: seq(literal('a'), literal('b')) };
    },
    function STARTAction(v) { return v; },
    function missingAction(v) { return v; }
  ]
});


foam.CLASS({
  package: 'foam.parse.lint.test',
  name: 'GrammarLintFixtureChild',
  extends: 'foam.parse.lint.test.GrammarLintFixture',

  documentation: 'Adds an action to its parent rules; the rules and the parent actions belong to the parent.',

  methods: [
    function alsoMissingAction(v) { return v; }
  ]
});


foam.CLASS({
  package: 'foam.parse.lint.test',
  name: 'GrammarLintDataFixture',
  extends: 'foam.parse.Grammar',

  documentation: 'Builds one rule per property of `of`, so it cannot be built without one.',

  properties: [ 'of' ],

  methods: [
    function grammar(alt, literal) {
      return { START: alt.apply(null, this.of.getAxiomsByClass(foam.lang.Property).map(p => literal(p.name))) };
    }
  ]
});


foam.CLASS({
  package: 'foam.parse.lint.test',
  name: 'GrammarLintBaseFixture',
  extends: 'foam.parse.Grammar',

  documentation: 'Holds the action for a rule only its subclass defines.',

  methods: [
    function grammar(literal) {
      return { START: literal('a') };
    },
    function extraAction(v) { return v; }
  ]
});


foam.CLASS({
  package: 'foam.parse.lint.test',
  name: 'GrammarLintBaseChildFixture',
  extends: 'foam.parse.lint.test.GrammarLintBaseFixture',

  documentation: 'Defines the rule its parent holds the action for.',

  methods: [
    function grammar(seq, sym, literal) {
      return { START: seq(literal('a'), sym('extra')), extra: literal('b') };
    }
  ]
});


foam.CLASS({
  package: 'foam.parse.lint.test',
  name: 'GrammarLintLibraryFixture',
  extends: 'foam.parse.Grammar',

  documentation: 'A base with shared rules and no START; its subclass picks the rules it needs.',

  methods: [
    function grammar(literal) {
      return { digit: literal('1'), letter: literal('a') };
    }
  ]
});


foam.CLASS({
  package: 'foam.parse.lint.test',
  name: 'GrammarLintLibraryChildFixture',
  extends: 'foam.parse.lint.test.GrammarLintLibraryFixture',

  documentation: 'Uses one inherited rule; its own spare rule is unreachable.',

  methods: [
    function grammar(sym, literal) {
      return { START: sym('digit'), digit: literal('1'), letter: literal('a'), spare: literal('z') };
    }
  ]
});
