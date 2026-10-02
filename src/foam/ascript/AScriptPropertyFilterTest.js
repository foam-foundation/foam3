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
        // Named to match the filter without reusing the framework's own
        // reactions_ / reactionError_, which are typed Map and StringArray -
        // redeclaring those as String is an axiom type conflict, not a test.
        { class: 'String', name: 'reactionAlpha' },
        { class: 'String', name: 'reactionBeta' },
        { class: 'FObjectArray', name: 'items', of: 'foam.ascript.AScriptPropertyFilterTest.Item' }
      ]
    },
    {
      name: 'Item',
      properties: [
        { class: 'String', name: 'code' },
        { class: 'String', name: 'label' }
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

    function lookup(s, subject) {
      var e = this.parse(s);
      return e ? e.f(subject) : undefined;
    },

    function lookupTests(x) {
      var S = this.Subject, I = this.Item;
      var subject = S.create({ items: [
        I.create({ code: '00', label: 'Approved' }),
        I.create({ code: '05', label: 'Declined' }),
        I.create({ code: '05', label: 'Duplicate key' })
      ] });
      var q = 'LOOKUP(items, "code", "05", "label")';

      x.test( this.lookup('LOOKUP(items, "code", "00", "label")', subject) === 'Approved',
        'LOOKUP returns the value field of the matching element');
      x.test( this.lookup(q, subject) === 'Declined',
        'LOOKUP returns the first element when several match');
      x.test( this.lookup('LOOKUP(items, "code", "99", "label")', subject) === null,
        'LOOKUP returns null when no element matches');
      x.test( this.lookup(q, S.create()) === null,
        'LOOKUP returns null for an empty array');
      x.test( this.lookup('LOOKUP(items, "code", "00", "nosuch")', subject) == null,
        'LOOKUP returns null when the value field does not exist');
      x.test( foam.ascript.Lib.LOOKUP([ { k: 1, v: 'a' } ], 'k', 1, 'v') === 'a',
        'LOOKUP reads plain objects');
      x.test( foam.ascript.Lib.LOOKUP([ new Map([ [ 'k', 1 ], [ 'v', 'a' ] ]) ], 'k', 1, 'v') === 'a',
        'LOOKUP reads Maps');
      x.test( foam.ascript.Lib.LOOKUP(null, 'k', 1, 'v') === null,
        'LOOKUP returns null for a null array');
    },

    function runTest(x) {
      x.test( !! this.parse('alpha'),
        'A bare property name parses');
      x.test( !! this.parse('countryName'),
        'A camelCase property name parses');
      x.test( !! this.parse('LEN(alpha)'),
        'A property inside a function parses');

      // Reaction properties are bookkeeping, not user-facing columns.
      x.test( ! this.parse('reactionAlpha'),
        'A reaction-prefixed property is excluded from the grammar');
      x.test( ! this.parse('reactionBeta'),
        'Every reaction-prefixed property is excluded, not just the first');

      // An unknown name has nothing to match and must not resolve.
      x.test( ! this.parse('nosuchcolumn'),
        'An unknown property does not parse');

      this.lookupTests(x);
    }
  ]
});
