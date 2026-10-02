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
        { class: 'FObjectArray', name: 'items', of: 'foam.ascript.AScriptPropertyFilterTest.Item' },
        { class: 'FObjectProperty', name: 'outer', of: 'foam.ascript.AScriptPropertyFilterTest.Outer' },
        { class: 'Date', name: 'day' },
        // A Date property keeps only the day (noon GMT); a DateTime keeps the time of day the UTC checks need.
        { class: 'DateTime', name: 'stamp' },
        { class: 'Int', name: 'count' },
        // Named like the TEXT function: TEXT(...) must parse as the call, a bare text as the field.
        { class: 'String', name: 'text' }
      ]
    },
    {
      name: 'Outer',
      properties: [
        { class: 'FObjectProperty', name: 'inner', of: 'foam.ascript.AScriptPropertyFilterTest.Item' }
      ]
    },
    {
      name: 'Item',
      properties: [
        { class: 'String', name: 'code' },
        { class: 'String', name: 'label' },
        { class: 'Int', name: 'qty' }
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

    function textTests(x) {
      var subject = this.Subject.create({ day: new Date(Date.UTC(2025, 2, 29, 12)), count: 7, text: 'hello' });
      x.test( this.lookup('TEXT(day, "YYMMDD")', subject) === '250329', 'TEXT formats a date as YYMMDD in UTC, got ' + this.lookup('TEXT(day, "YYMMDD")', subject) );
      x.test( this.lookup('TEXT(day, "YYYY-MM-DD")', subject) === '2025-03-29', 'TEXT formats a date as YYYY-MM-DD' );
      x.test( this.lookup('TEXT(count, "")', subject) === '7', 'TEXT of a number is its plain text' );
      x.test( this.lookup('TEXT(count)', subject) === '7', 'TEXT with no format is its plain text, got ' + this.lookup('TEXT(count)', subject) );
      x.test( this.lookup('TEXT(day, "DD/MM/YYYY DD")', subject) === '29/03/2025 29', 'TEXT replaces every occurrence of a token, got ' + this.lookup('TEXT(day, "DD/MM/YYYY DD")', subject) );
      x.test( this.lookup('text', subject) === 'hello', 'A bare name that matches a function still parses as the property' );
      x.test( this.lookup('LEN(TEXT(day, "YYMMDD")) + LEN(text)', subject) === 11, 'TEXT(...) parses as the call on a model with a text property' );
      var d = this.lookup('DATE(2025, 3, 29)', subject);
      x.test( d && d.getTime() === Date.UTC(2025, 2, 29, 12), 'DATE is noon UTC of that day, got ' + d );
    },

    function dateTests(x) {
      // 23:30Z is already the next day in zones east of UTC and 18:30 or earlier west of it:
      // a local-time read fails in at least one zone, a UTC read passes in all.
      var subject = this.Subject.create({ stamp: new Date(Date.UTC(2025, 2, 29, 23, 30, 45)) });
      var self = this;
      [ [ 'YEAR(stamp)', 2025 ], [ 'MONTH(stamp)', 3 ], [ 'DAY(stamp)', 29 ], [ 'HOUR(stamp)', 23 ],
        [ 'MINUTE(stamp)', 30 ], [ 'SECOND(stamp)', 45 ], [ 'WEEKDAY(stamp)', 6 ] ].forEach(function(c) {
        x.test( self.lookup(c[0], subject) === c[1], c[0] + ' reads UTC, got ' + self.lookup(c[0], subject) );
      });
      x.test( this.lookup('TEXT(stamp, "YYMMDD")', subject) === '250329', 'TEXT reads UTC late in the day' );
      x.test( this.lookup('HOUR(DATE(2025, 3, 29))', subject) === 12, 'DATE builds noon UTC in every zone' );
    },

    function pathTests(x) {
      var subject = this.Subject.create({ outer: this.Outer.create({ inner: this.Item.create({ code: '00' }) }) });
      x.test( this.lookup('outer.inner.code', subject) === '00',
        'A three-step path reads the last step, got ' + this.lookup('outer.inner.code', subject) );
      x.test( this.lookup('outer.inner', subject) && this.lookup('outer.inner', subject).code === '00',
        'A two-step path still reads the nested object' );
      x.test( this.lookup('outer.inner.code', this.Subject.create()) === null,
        'A path through an unset step is null, got ' + this.lookup('outer.inner.code', this.Subject.create()) );
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
      var withQty = S.create({ items: [ I.create({ qty: 5, label: 'Five' }) ] });
      x.test( this.lookup('LOOKUP(items, "qty", 5, "label")', withQty) === 'Five',
        'LOOKUP matches an Int key field against a number literal');
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
      this.pathTests(x);
      this.textTests(x);
      this.dateTests(x);
    }
  ]
});
