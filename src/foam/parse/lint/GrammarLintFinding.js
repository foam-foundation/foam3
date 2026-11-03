/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lint',
  name: 'GrammarLintFinding',

  documentation: 'One problem GrammarLint found in one grammar.',

  properties: [
    {
      class: 'String',
      name: 'severity',
      documentation: `
        'error': the grammar misbehaves (a rule that cannot be found, an action
        that never runs, a parse that never ends). 'warning': probably a
        mistake (a rule nothing uses). 'skip': the grammar could not be built
        without data this tool does not have, so it was not checked.
      `
    },
    {
      class: 'String',
      name: 'check',
      documentation: 'Short id of the check, e.g. undefined-symbol.'
    },
    {
      class: 'String',
      name: 'grammar',
      documentation: 'Class id, plus "#axiomName" for a grammars: axiom.'
    },
    {
      class: 'String',
      name: 'source',
      documentation: 'File the class was loaded from, when known.'
    },
    {
      class: 'String',
      name: 'symbol',
      documentation: 'Rule the finding is about; empty for whole-grammar findings.'
    },
    {
      class: 'String',
      name: 'message'
    }
  ],

  methods: [
    function toString() {
      /** source: grammar: symbol: severity check: message */
      return [
        this.source || '(unknown file)',
        this.grammar,
        this.symbol || '-',
        this.severity + ' ' + this.check
      ].join(': ') + ': ' + this.message;
    }
  ]
});
