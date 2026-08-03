/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.ascript',
  name: 'AScriptPropertyFilterTest',
  extends: 'foam.core.test.JSTest',

  documentation: `A bare property name must parse as an expression, and the
    reaction bookkeeping properties must not.

    The parser builds its VALUE operands from the class's properties. When that
    filter is inverted, every ordinary property drops out of the grammar and
    every formula silently compiles to nothing - no throw, no log, just an empty
    column wherever the formula was used.`,

  classes: [
    {
      name: 'Subject',
      properties: [
        { class: 'Long',   name: 'id' },
        { class: 'String', name: 'alpha' },
        { class: 'String', name: 'countryName' },
        { class: 'String', name: 'reactions_' },
        { class: 'String', name: 'reactionError_' }
      ]
    }
  ],

  methods: [
    function parse(s) {
      // The parser is a multiton keyed on 'of', so clear it between cases or a
      // cached parser answers for a class it was not built from.
      foam.ascript.AScriptParser.private_.instances = {};
      return foam.ascript.AScriptParser.PARSE(this.Subject, s);
    },

    function runTest(x) {
      x.test( !! this.parse('alpha'),
        'A bare property name parses');
      x.test( !! this.parse('countryName'),
        'A camelCase property name parses');
      x.test( !! this.parse('LEN(alpha)'),
        'A property inside a function parses');

      // Reaction properties are bookkeeping, not user-facing columns.
      x.test( ! this.parse('reactions_'),
        'reactions_ is excluded from the grammar');
      x.test( ! this.parse('reactionError_'),
        'reactionError_ is excluded from the grammar');

      // An unknown name has nothing to match and must not resolve.
      x.test( ! this.parse('nosuchcolumn'),
        'An unknown property does not parse');
    }
  ]
});
