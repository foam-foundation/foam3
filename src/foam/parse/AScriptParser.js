/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

/**
  PROTOTYPE - reconciled against the real foam.parse.SimpleQueryParser.

  AScript: Excel-style value expressions, layered onto SimpleQueryParser through
  its two extension points: extensionGrammar_ (adds symbols) and addExtActions
  (adds actions). Shares the parent's literals, `or` predicate tree, and adds
  only the value layer + funcall. Predicate-only screens pay nothing.

  REQUIRES a one-line parent fix: grammar_ computes `ext` but never merges it.
  Add `...ext` (or Object.assign) into the `grammar` object, or none of the
  symbols below are registered.

  Decisions folded in:
    - `&`, `+`, CONCAT() all build ADD (Add concats strings). No Concat mlang.
    - No `.len`: field access is pure dotted property nav; LEN is a function.
      Function names use a dot-free `ident`, so they can't collide with paths.
    - Excel-like precedence: `-5^2 == -25` (unary `neg` wraps `^`).
    - String literals are QUOTED only ("abc"); bare names are field refs.
*/

foam.CLASS({
  package: 'foam.parse',
  name: 'FnExpr',
  implements: [ 'foam.mlang.Expr' ],

  properties: [
    'name',
    { name: 'args', factory: function() { return []; } },
    { class: 'Function', name: 'impl' }
  ],

  methods: [
    function f(o) {
      return this.impl.apply(null, this.args.map(function(a) {
        return ( a && a.f ) ? a.f(o) : a;
      }));
    },
    function toString() {
      return this.name + '(' + this.args.map(function(a) {
        return a && a.toString ? a.toString() : ('' + a);
      }).join(', ') + ')';
    }
  ]
});


foam.CLASS({
  package: 'foam.parse',
  name: 'AScriptParser',
  extends: 'foam.parse.SimpleQueryParser',

  documentation: 'Excel-style value expressions sharing SimpleQueryParser literals and predicates.',

  requires: [
    'foam.parse.FnExpr',
    'foam.parse.Alternate',
    'foam.parse.Literal',
    'foam.mlang.predicate.NamedProperty'
  ],

  constants: [
    {
      name: 'FUNCTIONS',
      factory: function() {
        const m = foam.mlang.Expressions.create();
        function raw(name, impl) {  // long-tail placeholder until backed by MLIB
          return function(args) { return foam.parse.FnExpr.create({ name: name, args: args, impl: impl }); };
        }
        // TODO: eventually move to a DAO. IF is NOT here (it has a typed parser).
        return {
          LEN:     { minArgs: 1, maxArgs: 1, build: function(a) { return m.STRING_LENGTH(a[0]); } },
          ABS:     { minArgs: 1, maxArgs: 1, build: function(a) { return m.ABS(a[0]); } },
          ROUND:   { minArgs: 1, maxArgs: 2, build: function(a) { return m.ROUND(a[0], a[1]); } }, // mixin bug: opt_Decimals typo
          MIN:     { minArgs: 1, build: function(a) { return m.MIN_FUNC.apply(m, a); } },  // *Func expr, not the sink
          MAX:     { minArgs: 1, build: function(a) { return m.MAX_FUNC.apply(m, a); } },
          SUM:     { minArgs: 1, build: function(a) { return m.ADD.apply(m, a); } },       // per-row n-ary Add
          CONCAT:  { minArgs: 1, build: function(a) { return m.ADD.apply(m, a); } },       // Add concats
          YEARS:   { minArgs: 1, maxArgs: 1, build: function(a) { return m.YEARS(a[0]); } },
          MONTHS:  { minArgs: 1, maxArgs: 1, build: function(a) { return m.MONTHS(a[0]); } },
          DAYS:    { minArgs: 1, maxArgs: 1, build: function(a) { return m.DAYS(a[0]); } },
          HOURS:   { minArgs: 1, maxArgs: 1, build: function(a) { return m.HOURS(a[0]); } },
          MINUTES: { minArgs: 1, maxArgs: 1, build: function(a) { return m.MINUTES(a[0]); } },
          NOW:     { minArgs: 0, maxArgs: 0, build: function( ) { return m.NOW(); } },

          UPPER:   { minArgs: 1, maxArgs: 1, build: raw('UPPER', function(s) { return ('' + s).toUpperCase(); }) },
          LOWER:   { minArgs: 1, maxArgs: 1, build: raw('LOWER', function(s) { return ('' + s).toLowerCase(); }) },
          LEFT:    { minArgs: 2, maxArgs: 2, build: raw('LEFT',  function(s, n) { return ('' + s).slice(0, n); }) },
          RIGHT:   { minArgs: 2, maxArgs: 2, build: raw('RIGHT', function(s, n) { return ('' + s).slice(-n); }) }
          // ... long tail
        };
      }
    }
  ],

  properties: [
    {
      name: 'extensionGrammar_',
      // NOTE: parameter names must match Parsers members (withArgs injects by name).
      value: function(alt, seq, seq1, repeat, repeat0, optional, literal, literalIC, str, substring, sym, range) {
        const self = this;
        const m    = foam.mlang.Expressions.create();

        // local short aliases
        var rep = repeat, rep0 = repeat0, opt = optional, lit = literal, litIC = literalIC;

        // leading-ws helpers so `a + b` parses (each token consumes leading ws;
        // the next token's leading ws swallows trailing space)
        function lead(p)         { return seq1(1, sym('ws'), p); }
        function binop(ch, val)  { return seq1(1, sym('ws'), lit(ch, val)); }
        var comma = seq1(1, sym('ws'), ',');

        // property-name literals (+ constants) as VALUE operands, longest-first
        var fields = [];
        this.of.getAxiomsByClass(foam.lang.Property).forEach(function(p) {
          fields.push(self.Literal.create({ s: p.name, value: p }));
        });
        this.of.getAxiomsByClass(foam.lang.Constant).forEach(function(c) {
          fields.push(self.Literal.create({ s: c.name, value: c.value }));
        });
        fields.sort(function(a, b) {
          var c = foam.util.compare(b.s.length, a.s.length);
          return c ? c : foam.util.compare(a.s, b.s);
        });

        return {
          // second entry point; predicate entry (START/'or') is inherited
          EXPR: sym('concat'),

          // Excel precedence: concat < +/- < * / < unary neg < ^ < primary
          concat: seq(
            sym('addsub'),
            opt(seq(binop('&', 'ADD'), sym('addsub')))),

          addsub: seq(
            sym('muldiv'),
            opt(seq(alt(binop('+', 'ADD'), binop('-', 'SUB')), sym('muldiv')))),

          muldiv: seq(
            sym('unary'),
            opt(seq(alt(binop('*', 'MUL'), binop('/', 'DIV')), sym('unary')))),

          unary: alt(sym('neg'), sym('power')),
          neg:   seq(seq1(1, sym('ws'), '-'), sym('unary')),              // -5^2 == -25
          power: seq(sym('primary'), opt(seq(seq1(1, sym('ws'), '^'), sym('unary')))), // right-assoc

          primary: alt(
            sym('expr_paren'),
            sym('funcall'),
            sym('quoted string'),                                   // "quoted" only
            sym('number'),
            lead(litIC('true',  m.CONSTANT(true))),
            lead(litIC('false', m.CONSTANT(false))),
            sym('field')                                     // bare names -> property refs
          ),

          expr_paren: seq1(3, sym('ws'), '(', sym('ws'), sym('EXPR'), sym('ws'), ')'),

          // dot-free identifier for function names
          ident: seq1(1, sym('ws'),
            substring(seq(alt(range('a','z'), range('A','Z'), '_'),
                    rep0(alt(range('a','z'), range('A','Z'), range('0','9'), '_'))))),

          // pure dotted property access; nothing reserved
          fieldname: this.Alternate.create({ args: fields }),
          field: seq(
            seq1(1, sym('ws'), sym('fieldname')),
            opt(sym('subField'))),

          subField: seq('.', sym('ident'), opt(sym('subField'))),

          // typed functions first, then the one generic rule for the other ~295
          funcall: alt(sym('fn_IF'), sym('generic_funcall')),

          // IF cond delegates to the inherited predicate tree via `or`
          fn_IF: seq(seq1(1, sym('ws'), litIC('IF')), sym('ws'), '(',
                     sym('or'),   comma,
                     sym('EXPR'), comma,
                     sym('EXPR'), sym('ws'), ')'),

          generic_funcall: seq(sym('funcname'), sym('ws'), '(', opt(sym('args')), sym('ws'), ')'),
          funcname: sym('ident'),
          args: rep(sym('EXPR'), comma, 0)
        };
      }
    }
  ],

  methods: [
    function parseExpression(s) {
      var e = this.parseString(s, 'EXPR');
      return e && e.partialEval ? e.partialEval() : e;
    },

    function addExtActions(g) {
      var self = this;
      var m    = foam.mlang.Expressions.create();
      var NO_PARSE = foam.parse.ParserWithAction.NO_PARSE;

      function binAction(v) {
        try {
          return v[1] ? m[v[1][0]].call(m, v[0], v[1][1]) : v[0];
        } catch (x) {
          debugger;
        }
      }

      g.addActions({
        concat: binAction,
        addsub: binAction,
        muldiv: binAction,
        neg:    function(v) { return m.MUL(m.CONSTANT(-1), v[1]); },
        power:  function(v) {
          return v[1] == null ? v[0]
            : self.FnExpr.create({ name: 'POW', args: [ v[0], v[1][1] ], impl: Math.pow });
        },

        field: function(v) { return v[1] ? m.DOT(v[0], v[1]) : v[0]; },
        subField: function(v) { return self.NamedProperty.create({propName: v[1]}); },

        // [ 'IF', ws, '(', cond, ',', a, ',', b, ws, ')' ]  ->  cond=v[3], a=v[5], b=v[7]
        fn_IF: function(v) { return m.MUX(v[3], v[5], v[7]); },

        // [ name, ws, '(', args|undefined, ws, ')' ]
        generic_funcall: function(v) {
          var spec = self.FUNCTIONS[('' + v[0]).toUpperCase()];
          if ( ! spec ) return NO_PARSE;                     // unknown function
          var args = v[3] || [];
          if ( spec.minArgs != null && args.length < spec.minArgs ) return NO_PARSE;
          if ( spec.maxArgs != null && args.length > spec.maxArgs ) return NO_PARSE;
          return spec.build(args);
        }
      });
    }
  ]
});













/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

/*
  End-to-end harness for AScriptParser. Load AFTER:
    1. the parent .ext merge fix in SimpleQueryParser.grammar_
    2. foam.parse.AScriptParser (and foam.parse.FnExpr)

  Run: node with FOAM bootstrapped, or paste into a browser console on a page
  that has FOAM loaded. Prints parsed MLang + evaluated value + PASS/FAIL.
*/

foam.CLASS({
  package: 'foam.parse.test',
  name: 'Address',
  properties: [ 'city', 'province' ]
});

foam.CLASS({
  package: 'foam.parse.test',
  name: 'Test',
  properties: [
    { class: 'Int',            name: 'id' },
    { class: 'String',         name: 'firstName' },
    { class: 'String',         name: 'lastName' },
    { class: 'Float',          name: 'balance' },
    { class: 'DateTime',       name: 'born' },
    { class: 'FObjectProperty', of: 'foam.parse.test.Address', name: 'address' }
  ]
});

foam.CLASS({
  package: 'foam.parse.test',
  name: 'AScriptDemo',
  requires: [ 'foam.parse.AScriptParser', 'foam.parse.test.Test' ],
  methods: [
    function run() {
      var p = this.AScriptParser.create({ of: this.Test });

      var born = new Date();
      born.setFullYear(born.getFullYear() - 20);
      born.setHours(9, 30, 0, 0);

      var data = this.Test.create({
        id: 42, firstName: 'Kevin', lastName: 'Greer', balance: 1500,
        born: born, address: { city: 'Toronto', province: 'ON' }
      });

      function pad(s) { return (s + '                                          ').slice(0, 42); }

      function exPart(s, expected, sym) {
        try {
          let parser = p.grammar_.getSymParser(sym);

          var e   = parser.parseString(s);
          console.log('*****', s, ' -> ' , e);
          var out = ( e && e.f ) ? e.f(data) : e;
          var tag = expected === undefined ? ''
                  : (out === expected ? '  PASS' : '  FAIL (expected ' + JSON.stringify(expected) + ')');
          console.log(pad(s), '->', (e ? e.toString() : '(no parse)'), '=', JSON.stringify(out) + tag);
        } catch (err) {
          console.log(pad(s), '-> ERROR:', (err && err.message) || err);
          debugger;
        }
      }

      console.log('── test parts ──');
      exPart('12', 12, 'number');
      exPart('13', 13, 'primary');
      exPart('"abc"', 'abc', 'primary');
      exPart('"def"', 'def', 'quoted string');
      exPart('true', true, 'primary');
      exPart('false', false, 'primary');
      exPart('3^2', 9, 'power');
      exPart('-2', -2, 'neg');
      exPart('-3^2', -9, 'unary');
      exPart('1+2', 3, 'addsub');
      exPart('2-1', 1, 'addsub');
      exPart('2*3', 6, 'muldiv');
      exPart('2*4', 8, 'concat');
      exPart('city', 'city', 'ident');

      /*
      console.log('── operands ──');
      exPart('firstName',     'Kevin',   'field');
      exPart('address.city',  'Toronto', 'field');    // DOT + NamedProperty chain
      exPart('id',            42,        'primary');

      console.log('── functions ──');
      exPart('LEN(firstName)',      5,         'generic_funcall');  // -> STRING_LENGTH
      exPart('LEFT(firstName, 3)',  'Kev',     'generic_funcall');  // -> FnExpr
      exPart('UPPER(address.city)', 'TORONTO', 'funcall');          // funcall alt + dotted arg

      console.log('── addsub / muldiv with fields ──');
      exPart('1 + 2',       3,    'addsub');
      exPart('balance * 2', 3000, 'addsub');

      console.log('── concat (Add over strings) ──');
      exPart('firstName & lastName', 'KevinGreer', 'concat');
      exPart('firstName & "!"',      'Kevin!',     'concat');

      console.log('── IF: cond delegates to the AQL predicate parser ──');
      exPart('IF(id = 42, firstName, lastName)',    'Kevin', 'fn_IF');
      exPart('IF(balance > 1000, "high", "low")',   'high',  'fn_IF');

      console.log('── full EXPR ──');
      exPart('LEFT(firstName, 3) & "."',            'Kev.',  'EXPR');
      exPart('IF(balance > 1000, balance * 2, 0)',  3000,    'EXPR');
*/
 //     exPart('(1)', 1, 'expr_paren');

      function ex(s, expected) {
        try {
          console.log('*****', s, ' -> ?');
          var e   = p.parseExpression(s);
          console.log('*****', s, ' -> ' , e);
          var out = ( e && e.f ) ? e.f(data) : e;
          var tag = expected === undefined ? ''
                  : (out === expected ? '  PASS' : '  FAIL (expected ' + JSON.stringify(expected) + ')');
          console.log(pad(s), '->', (e ? e.toString() : '(no parse)'), '=', JSON.stringify(out) + tag);
        } catch (err) {
          console.log(pad(s), '-> ERROR:', (err && err.message) || err);
          debugger;
        }
      }


      ex('1', 1);
      ex('2 + 3', 5);
      ex('2 + 3 * 4', 14);
      ex('(2 + 3) * 4', 20);
      ex('10 / 4', 2.5);
      ex('-5 ^ 2', -25);          // unary neg wraps ^  (Excel)
      ex('2 ^ -3', 0.125);

      console.log('── strings & concat (Add) ──');
      ex('"Hello, " & firstName', 'Hello, Kevin');
      ex('firstName & " " & lastName', 'Kevin Greer');
      ex('LEFT(firstName, 3) & "."', 'Kev.');
      ex('UPPER(lastName)', 'GREER');
      ex('LEN(firstName)', 5);

      console.log('── fields & dotted access ──');
      ex('id', 42);
      ex('balance * 2', 3000);
      ex('address.city', 'Toronto');
      ex('UPPER(address.city)', 'TORONTO');

      console.log('── IF: cond delegates to the AQL predicate parser ──');
      ex('IF(balance > 1000, "high", "low")', 'high');
      ex('IF(id = 42, firstName, lastName)', 'Kevin');
      ex('IF(balance > 1000, balance * 2, 0)', 3000);

      console.log('── date fn (value printed, not asserted) ──');
      ex('YEARS(born)');

      console.log('── validation: unknown fn / arity should NOT parse ──');
      ex('BOGUS(1)');             // unknown  -> (no parse)
      ex('LEFT("x")');            // too few  -> (no parse)
    }
  ]
});

// auto-run if a context is available
try { foam.parse.test.AScriptDemo.create().run(); } catch (e) {}

debugger;
