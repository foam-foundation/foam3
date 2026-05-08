/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.test',
  name: 'SimpleQueryParserMQLTest',
  extends: 'foam.core.test.JSTest',

  documentation: 'Tests that AQL queries parsed by SimpleQueryParser produce correct MQL output via toMQL().',

  requires: [ 'foam.parse.SimpleQueryParser' ],

  methods: [
    function runTest(x) {
      var EPSILON = 0.0000000001;
      var f = function(num) { return num - EPSILON; };
      var g = function(num) { return num + EPSILON; };
      // Expected float formatting: String() for normal decimals, toFixed for scientific notation
      var fmt = function(num) {
        var s = String(num);
        if ( s.indexOf('e') !== -1 || s.indexOf('E') !== -1 ) {
          s = num.toFixed(20);
          s = s.replace(/0+$/, '');
          if ( s.endsWith('.') ) s += '0';
        }
        return s;
      };
      // Format a date the same way Constant.toMQL does (truncate at second colon)
      var dateMQL = function(args) {
        var d = new Date(Date.UTC.apply(null, args));
        var iso = d.toISOString();
        return iso.substr(0, iso.indexOf(':', iso.indexOf(':') + 1));
      };

      // ── String predicates ──
      x.test(this.isValidMQL('firstName = SomeName', 'firstName="SomeName"'),
        'String MQL 1: equals');
      x.test(this.isValidMQL('firstName!=SomeName', '-firstName="SomeName"'),
        'String MQL 2: not equals');
      x.test(this.isValidMQL('firstName > SomeName', 'firstName>"SomeName"'),
        'String MQL 3: greater than');
      x.test(this.isValidMQL('firstName >= SomeName', 'firstName>="SomeName"'),
        'String MQL 4: greater than or equal');
      x.test(this.isValidMQL('firstName < SomeName', 'firstName<"SomeName"'),
        'String MQL 5: less than');
      x.test(this.isValidMQL('firstName <= SomeName', 'firstName<="SomeName"'),
        'String MQL 6: less than or equal');
      x.test(this.isValidMQL('firstName CONTAINS SomeName', 'firstName:"SomeName"'),
        'String MQL 7: contains');
      x.test(this.isValidMQL('firstName:SomeName', 'firstName:"SomeName"'),
        'String MQL 8: colon operator');
      x.test(this.isValidMQL('firstName~SomeName', 'firstName:"SomeName"'),
        'String MQL 9: tilde operator');
      x.test(this.isValidMQL('firstName IN (SomeName,AnotherName)', 'firstName:SomeName,AnotherName'),
        'String MQL 10: IN');
      x.test(this.isValidMQL('firstName NOT IN (SomeName,AnotherName)', '-firstName:SomeName,AnotherName'),
        'String MQL 11: NOT IN');
      x.test(this.isValidMQL('firstName IS EMPTY', 'firstName IS EMPTY'),
        'String MQL 12: IS EMPTY');
      x.test(this.isValidMQL('firstName IS NOT EMPTY', 'firstName IS NOT EMPTY'),
        'String MQL 13: IS NOT EMPTY');

      // ── StringArray predicates ──
      x.test(this.isValidMQL('disabledTopics IN (tag1,tag2,tag3)', 'disabledTopics:tag1,tag2,tag3'),
        'StringArray MQL 1: IN');
      x.test(this.isValidMQL('disabledTopics NOT IN (tag1,tag2,tag3)', '-disabledTopics:tag1,tag2,tag3'),
        'StringArray MQL 2: NOT IN');
      x.test(this.isValidMQL('disabledTopics = tag1', 'disabledTopics:"tag1"'),
        'StringArray MQL 3: equals single value');
      x.test(this.isValidMQL('disabledTopics HAS tag1', 'disabledTopics:"tag1"'),
        'StringArray MQL 4: HAS');
      x.test(this.isValidMQL('disabledTopics != tag1', '-disabledTopics:"tag1"'),
        'StringArray MQL 5: not equals single value');

      // ── Number predicates ──
      x.test(this.isValidMQL('id = 6', 'id=6'),
        'Number MQL 1: equals');
      x.test(this.isValidMQL('id!=6', '-id=6'),
        'Number MQL 2: not equals');
      x.test(this.isValidMQL('id > 6', 'id>6'),
        'Number MQL 3: greater than');
      x.test(this.isValidMQL('id>=6', 'id>=6'),
        'Number MQL 4: greater than or equal');
      x.test(this.isValidMQL('id<6', 'id<6'),
        'Number MQL 5: less than');
      x.test(this.isValidMQL('id<=6', 'id<=6'),
        'Number MQL 6: less than or equal');
      x.test(this.isValidMQL('id IN (6,7,8)', 'id:6,7,8'),
        'Number MQL 7: IN');
      x.test(this.isValidMQL('id NOT IN (6,7,8)', '-id:6,7,8'),
        'Number MQL 8: NOT IN');
      x.test(this.isValidMQL('id = 0', 'id=0'),
        'Number MQL 9: equals zero (falsy value guard)');
      x.test(this.isValidMQL('id!=0', '-id=0'),
        'Number MQL 10: not equals zero (falsy value guard)');

      // ── Float predicates ──
      x.test(this.isValidMQL('address.longitude = 6.5',
        'longitude>=' + fmt(f(6.5)) + ' AND longitude<' + fmt(g(6.5))),
        'Float MQL 1: equals');
      x.test(this.isValidMQL('address.longitude!=6.5',
        '(longitude>=' + fmt(g(6.5)) + ' OR longitude<' + fmt(f(6.5)) + ')'),
        'Float MQL 2: not equals');
      x.test(this.isValidMQL('address.longitude > 6.5',
        'longitude>' + fmt(g(6.5))),
        'Float MQL 3: greater than');
      x.test(this.isValidMQL('address.longitude>=6.5',
        'longitude>=' + fmt(f(6.5))),
        'Float MQL 4: greater than or equal');
      x.test(this.isValidMQL('address.longitude < 6.5',
        'longitude<' + fmt(f(6.5))),
        'Float MQL 5: less than');
      x.test(this.isValidMQL('address.longitude <= 6.5',
        'longitude<=' + fmt(g(6.5))),
        'Float MQL 6: less than or equal');
      x.test(this.isValidMQL('address.latitude IN RANGE (6.5, 8.5)',
        'latitude>=' + fmt(f(6.5)) + ' AND latitude<' + fmt(g(8.5))),
        'Float MQL 7: IN RANGE');
      x.test(this.isValidMQL('address.latitude NOT IN RANGE (6.5, 8.5)',
        '(latitude>=' + fmt(g(8.5)) + ' OR latitude<' + fmt(f(6.5)) + ')'),
        'Float MQL 8: NOT IN RANGE');

      // ── Float small-value precision (Constant.toMQL must not corrupt small floats) ──
      x.test(this.constantToMQL(0.001) === '0.001',
        'Float MQL constant 1: 0.001 formats correctly, got: ' + this.constantToMQL(0.001));
      x.test(this.constantToMQL(0.0001) === '0.0001',
        'Float MQL constant 2: 0.0001 formats correctly, got: ' + this.constantToMQL(0.0001));
      x.test(this.constantToMQL(-0.0001) === '-0.0001',
        'Float MQL constant 3: -0.0001 formats correctly, got: ' + this.constantToMQL(-0.0001));
      x.test(this.constantToMQL(0.5) === '0.5',
        'Float MQL constant 4: 0.5 formats correctly, got: ' + this.constantToMQL(0.5));
      x.test(this.constantToMQL(0.1) === '0.1',
        'Float MQL constant 5: 0.1 formats correctly, got: ' + this.constantToMQL(0.1));
      x.test(this.constantToMQL(1.23) === '1.23',
        'Float MQL constant 6: 1.23 formats correctly, got: ' + this.constantToMQL(1.23));
      x.test(this.constantToMQL(0.00000001) === '0.00000001',
        'Float MQL constant 7: 0.00000001 formats correctly, got: ' + this.constantToMQL(0.00000001));

      // ── Float epsilon-adjusted small values (the values that actually appear in MQL) ──
      x.test(this.constantToMQL(f(0.0001)) === String(f(0.0001)),
        'Float MQL epsilon 1: f(0.0001) no corruption, got: ' + this.constantToMQL(f(0.0001)));
      x.test(this.constantToMQL(g(0.0001)) === String(g(0.0001)),
        'Float MQL epsilon 2: g(0.0001) no corruption, got: ' + this.constantToMQL(g(0.0001)));
      x.test(this.constantToMQL(f(-0.0001)) === String(f(-0.0001)),
        'Float MQL epsilon 3: f(-0.0001) no corruption, got: ' + this.constantToMQL(f(-0.0001)));
      x.test(this.constantToMQL(g(-0.0001)) === String(g(-0.0001)),
        'Float MQL epsilon 4: g(-0.0001) no corruption, got: ' + this.constantToMQL(g(-0.0001)));

      // ── Float IN RANGE with small values (user-reported bug) ──
      x.test(this.isValidMQL('address.latitude IN RANGE (-0.0001, 0.0001)',
        'latitude>=' + String(f(-0.0001)) + ' AND latitude<' + String(g(0.0001))),
        'Float MQL small range 1: IN RANGE (-0.0001, 0.0001)');
      x.test(this.isValidMQL('address.latitude NOT IN RANGE (-0.0001, 0.0001)',
        '(latitude>=' + String(g(0.0001)) + ' OR latitude<' + String(f(-0.0001)) + ')'),
        'Float MQL small range 2: NOT IN RANGE (-0.0001, 0.0001)');
      x.test(this.isValidMQL('address.latitude IN RANGE (0.001, 0.01)',
        'latitude>=' + String(f(0.001)) + ' AND latitude<' + String(g(0.01))),
        'Float MQL small range 3: IN RANGE (0.001, 0.01)');

      // ── Float scientific notation guard ──
      x.test(this.hasNoScientificNotation(this.buildMQL('address.longitude = 0')),
        'Float MQL 9: equals zero has no scientific notation');
      x.test(this.hasNoScientificNotation(this.buildMQL('address.longitude!=0')),
        'Float MQL 10: not equals zero has no scientific notation');
      x.test(this.hasNoScientificNotation(this.buildMQL('address.longitude > 0')),
        'Float MQL 11: greater than zero has no scientific notation');
      x.test(this.hasNoScientificNotation(this.buildMQL('address.longitude < 0')),
        'Float MQL 12: less than zero has no scientific notation');

      // ── Date predicates (DateTime: created, defaults to midnight UTC) ──
      x.test(this.isValidMQL('created = 2025-01-01',
        'created>=' + dateMQL([2025, 0, 1, 0]) + ' AND created<' + dateMQL([2025, 0, 2, 0])),
        'Date MQL 1: equals');
      x.test(this.isValidMQL('created!=2025-01-01',
        '(created>=' + dateMQL([2025, 0, 2, 0]) + ' OR created<' + dateMQL([2025, 0, 1, 0]) + ')'),
        'Date MQL 2: not equals');
      x.test(this.isValidMQL('created > 2025-01-01',
        'created>' + dateMQL([2025, 0, 2, 0])),
        'Date MQL 3: greater than');
      x.test(this.isValidMQL('created>=2025-01-01',
        'created>=' + dateMQL([2025, 0, 1, 0])),
        'Date MQL 4: greater than or equal');
      x.test(this.isValidMQL('created < 2025-01-01',
        'created<' + dateMQL([2025, 0, 1, 0])),
        'Date MQL 5: less than');
      x.test(this.isValidMQL('created<=2025-01-01',
        'created<=' + dateMQL([2025, 0, 2, 0])),
        'Date MQL 6: less than or equal');
      x.test(this.isValidMQL('created IN RANGE (2025-01-01, 2025-06-01)',
        'created>=' + dateMQL([2025, 0, 1, 0]) + ' AND created<' + dateMQL([2025, 5, 2, 0])),
        'Date MQL 7: IN RANGE');
      x.test(this.isValidMQL('created NOT IN RANGE (2025-01-01, 2025-06-01)',
        '(created>=' + dateMQL([2025, 5, 2, 0]) + ' OR created<' + dateMQL([2025, 0, 1, 0]) + ')'),
        'Date MQL 8: NOT IN RANGE');

      // ── Date IS EMPTY / IS NOT EMPTY ──
      x.test(this.isValidMQL('lastLogin IS EMPTY', 'lastLogin IS EMPTY'),
        'Date MQL 9: IS EMPTY');
      x.test(this.isValidMQL('lastLogin IS NOT EMPTY', 'lastLogin IS NOT EMPTY'),
        'Date MQL 10: IS NOT EMPTY');

      // ── Date type (birthday, defaults to noon UTC) ──
      x.test(this.isValidMQL('birthday > 2025-01-01',
        'birthday>' + dateMQL([2025, 0, 2, 12])),
        'Date MQL 11: Date type greater than (noon default)');
      x.test(this.isValidMQL('birthday<=2025-01-01',
        'birthday<=' + dateMQL([2025, 0, 2, 12])),
        'Date MQL 12: Date type less than or equal (noon default)');

      // ── Enum predicates ──
      x.test(this.isValidMQL('lifecycleState = ACTIVE', 'lifecycleState=ACTIVE'),
        'Enum MQL 1: equals');
      x.test(this.isValidMQL('lifecycleState!=ACTIVE', '-lifecycleState=ACTIVE'),
        'Enum MQL 2: not equals');
      x.test(this.isValidMQL('lifecycleState IN (ACTIVE,REJECTED)', 'lifecycleState:ACTIVE,REJECTED'),
        'Enum MQL 3: IN');
      x.test(this.isValidMQL('lifecycleState NOT IN (ACTIVE,REJECTED)', '-lifecycleState:ACTIVE,REJECTED'),
        'Enum MQL 4: NOT IN');

      // ── Boolean predicates ──
      x.test(this.isValidMQL('loginEnabled IS TRUE', 'loginEnabled=true'),
        'Boolean MQL 1: IS TRUE');
      x.test(this.isValidMQL('loginEnabled IS FALSE', 'loginEnabled=false'),
        'Boolean MQL 2: IS FALSE');

      // ── Composite predicates ──
      x.test(this.isValidMQL('id > 5 AND firstName = John', 'id>5 AND firstName="John"'),
        'Composite MQL 1: AND');
      x.test(this.isValidMQL('id = 5 OR id = 10', '(id=5 OR id=10)'),
        'Composite MQL 2: OR');
      x.test(this.isValidMQL('( id = 6 )', 'id=6'),
        'Composite MQL 3: parentheses');
      // NOT id=5 gets partialEval'd to NEQ
      x.test(this.isValidMQL('NOT id = 5', '-id=5'),
        'Composite MQL 4: NOT (partialEval to NEQ)');
      // NOT CONTAINS survives partialEval, hits Not.toMQL general fallback
      x.test(this.isValidMQL('NOT firstName CONTAINS John', 'NOT (firstName:"John")'),
        'Composite MQL 5: NOT CONTAINS (general fallback)');

      // ── Operator precedence (OR inside AND) ──
      x.test(this.isValidMQL(
        'address.longitude!=6.5 AND id = 5',
        '(longitude>=' + fmt(g(6.5)) + ' OR longitude<' + fmt(f(6.5)) + ') AND id=5'),
        'Precedence MQL 1: float != inside AND');
      x.test(this.isValidMQL(
        'id = 5 AND address.longitude!=6.5',
        'id=5 AND (longitude>=' + fmt(g(6.5)) + ' OR longitude<' + fmt(f(6.5)) + ')'),
        'Precedence MQL 2: AND then float !=');
      x.test(this.isValidMQL(
        'address.latitude NOT IN RANGE (6.5, 8.5) AND firstName = John',
        '(latitude>=' + fmt(g(8.5)) + ' OR latitude<' + fmt(f(6.5)) + ') AND firstName="John"'),
        'Precedence MQL 3: NOT IN RANGE inside AND');
      x.test(this.isValidMQL(
        'created!=2025-01-01 AND id > 5',
        '(created>=' + dateMQL([2025, 0, 2, 0]) + ' OR created<' + dateMQL([2025, 0, 1, 0]) + ') AND id>5'),
        'Precedence MQL 4: date != inside AND');
    },

    function buildMQL(query) {
      var parser = this.SimpleQueryParser.create({ of: foam.core.auth.User });
      var predicate = parser.parseString(query);
      if ( ! predicate ) return null;
      if ( predicate.partialEval ) predicate = predicate.partialEval();
      if ( ! predicate.toMQL ) return null;
      return predicate.toMQL();
    },

    function isValidMQL(query, expectedMQL) {
      var mql = this.buildMQL(query);
      if ( mql == null ) return false;
      console.log('MQL Result: ' + mql + ', Expected: ' + expectedMQL);
      return mql === expectedMQL;
    },

    function constantToMQL(value) {
      var c = foam.mlang.Constant.create({ value: value });
      return c.toMQL();
    },

    function hasNoScientificNotation(mql) {
      if ( mql == null ) return false;
      console.log('Scientific notation check: ' + mql);
      return ! /[eE][+-]?\d+/.test(mql);
    }
  ]
});
