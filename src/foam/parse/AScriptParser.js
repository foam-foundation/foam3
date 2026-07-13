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
    - String literals are QUOTED only ("abc"); bare names are field refs.
    - +,-,*,/,& are left-associative via a flat rep0 tail + left-fold; only `^`
      stays right-associative (via opt). Nodes remain binary either way.
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
          // lPAD is automatically added by ALIB()
          LEN:     { minArgs: 1, maxArgs: 1, build: function(a) { return m.STRING_LENGTH(a[0]); } },
          ABS:     { minArgs: 1, maxArgs: 1, build: function(a) { return m.ABS(a[0]); } },
          ROUND:   { minArgs: 1, maxArgs: 2, build: function(a) { return m.ROUND(a[0], a[1]); } }, // mixin bug: opt_Decimals typo
          MIN:     { minArgs: 1, build: function(a) { return m.MIN_FUNC.apply(m, a); } },  // *Func expr, not the sink
          MAX:     { minArgs: 1, build: function(a) { return m.MAX_FUNC.apply(m, a); } },
          SUM:     { minArgs: 1, build: function(a) { return m.ADD.apply(m, a); } },       // per-row n-ary Add
          CONCAT:  { minArgs: 1, build: function(a) { return m.CONCAT.apply(m, a); } },       // Add concats
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
//          EXPR: sym('concat'),
          EXPR: sym('addsub'),

          // Excel precedence: concat < +/- < * / < unary neg < ^ < primary
          // Flat rep0 tail over the NEXT-higher rung + left-fold action =>
          // left-associative (10-2-3 == 5), nodes still binary.
          concat: seq(sym('addsub'), rep(seq(binop('&', 'ADD'), sym('addsub')))),

          addsub: seq(sym('muldiv'), rep(seq(alt(binop('+', 'ADD'), binop('-', 'SUB')), sym('muldiv')))),

          muldiv: seq(sym('unary'),  rep(seq(alt(binop('*', 'MUL'), binop('/', 'DIV')), sym('unary')))),

          unary: alt(sym('neg'), sym('power')),

          neg:   seq(seq1(1, sym('ws'), '-'), sym('unary')),              // -5^2 == -25

          power: seq(sym('primary'), opt(seq(seq1(1, sym('ws'), '^'), sym('unary')))), // right-assoc

          primary: alt(
            sym('expr_paren'),
            sym('funcall'),
            lead(sym('quoted string')),                      // "quoted" only; lead() eats leading ws
            sym('floatValue'),                               // parent 'number' already eats its own ws
            sym('number'),                                   // parent 'number' already eats its own ws
            lead(litIC('true',  m.TRUE)),
            lead(litIC('false', m.FALSE)),
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
          funcall: alt(sym('fn_IF'), sym('ifs'), sym('generic_funcall')),

          // IF cond delegates to the inherited predicate tree via `or`
          fn_IF: seq(seq1(1, sym('ws'), litIC('IF')), sym('ws'), '(',
                     sym('or'),   comma,
                     sym('EXPR'), comma,
                     sym('EXPR'), sym('ws'), ')'),

          ifs: seq1(4,
            sym('ws'),
            litIC('IFS'),
            sym('ws'),
            '(',
            rep(sym('ifsClause'), ',', 1),
            sym('ws'),
            ')'),

          ifsClause: seq(sym('or'), comma, sym('EXPR')),

          generic_funcall: seq(sym('funcname'), sym('ws'), '(', opt(sym('args')), sym('ws'), ')'),
          funcname: sym('ident'),
          // TODO:
          args: rep(alt(sym('EXPR'), sym('or')), comma, 0),

          expr: alt(
            sym('paren'),
            sym('negate'),
            sym('propPredicates'),
            sym('rangePropPredicates'),
            lead(litIC('true',  m.TRUE)),
            lead(litIC('false', m.FALSE))
          )
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

      // Left-fold a flat operator tail: v = [ first, [ [opName, rhs], ... ] ].
      // MLangs adapt literal args to Constant, so no manual boxing needed.
      function fold(v) {
        var acc = foam.mlang.ExprProperty.prototype.adaptValue(v[0]);
        v = v[1];
        for ( let i = 0 ; i < v.length ; i++ )
          acc = m[v[i][0]].call(m, acc, v[i][1]);
        return acc;
      }

      g.addActions({
//        concat: fold,
        addsub: fold,
        muldiv: fold,
        neg:    function(v) { return m.MUL(m.CONSTANT(-1), v[1]); },
        // TODO: convert to Mlang
        power:  function(v) {
          return v[1] == null ? v[0]
            : self.FnExpr.create({ name: 'POW', args: [ v[0], v[1][1] ], impl: Math.pow });
        },

        field: function(v) { return v[1] ? m.DOT(v[0], v[1]) : v[0]; },
        // TODO: support nested sub-fields (a.b.c) — currently single-level only
        subField: function(v) { return self.NamedProperty.create({propName: v[1]}); },

        // [ 'IF', ws, '(', cond, ',', a, ',', b, ws, ')' ]  ->  cond=v[3], a=v[5], b=v[7]
        fn_IF: function(v) { return m.COND(v[3], v[5], v[7]); },

        ifs: function(v) {
          return foam.mlang.expr.Ifs.create({clauses: v});
        },

        ifsClause: function(v) {
          return foam.mlang.expr.IfsClause.create({cond: v[0], expr: v[2]});
        },

        // TODO: loop over FUNCTIONS and add each individually so that auto-complete works
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


/** Generate models for AScript Library and register in foam.alib registry. **/
// To debug Java code-generation in browser, load with ?genjava=true flag
foam.ALIB = function(ms) {
  ms.forEach(l => {
    l.aName = l.aName || l.name.toUpperCase();

    let properties = l.args.map(a => {
      let m = {...a, class: 'foam.mlang.ExprProperty' };

      // Re-encode default values and Constant expressions
      if ( a.value ) m.value = foam.mlang.Constant.create({value: a.value});

      return m;
    });

    let javaCode = foam.json.parse(l.args).map(
      a => `${a.javaType} ${a.name} = ${foam.String.constantize(a.name)}.cast(get${foam.String.capitalize(a.name)}().f(obj));\n`
    ).join('') + l.javaCode;

    // TODO: Generate Model
    let m = {
      package: 'foam.mlang.expr',
      name: l.aName,
      extends: 'foam.mlang.AbstractExpr',
      flags: [ 'java' ], // Cause java generation
      // Make all arguments into ExprProperty's
      properties: properties,
      methods: [
        {
          name: 'f',
          code: function(obj) {
            return l.code.apply(this, l.args.map(a => this[a.name].f(obj)));
          },
          javaCode: javaCode
        }
      ]
    };

    foam.CLASS(m);

    let min = 0;
    for ( ; min < l.args.length && ! l.args[min].hasOwnProperty('value') ; min++ );
    foam.parse.AScriptParser.FUNCTIONS[l.aName] = {
      minArgs: min,
      maxArgs: l.args.length,
      build: function(a) {
        let args = {};
        for ( let i = 0 ; i < l.args.length ; i++ ) {
          args[l.args[i].name] = a[i];
        }
        return foam.mlang.expr[l.aName].create(args);
      }
    }
  });
};


foam.ALIB([
  {
    name: 'lPad',
    documentation: "Left pad the supplied string to the specified length using the supplied character, or '0' is not specified.",
    args: [
      { class: 'String', name: 'str' },
      { class: 'Int',    name: 'len' },
      { class: 'String', name: 'ch', value: '0' }
    ],
    code: function(str, len, ch) {
      return foam.core.reflow.lib.lPad(str, len, ch || '0');
    },
    javaCode: `
      if ( str == null ) str = "";
      if ( ch == null || ch.isEmpty() ) ch = "0";
      int padLen = len - str.length();
      if ( padLen <= 0 ) return str;
      StringBuilder sb = new StringBuilder(len);   // final length is exactly len
      while ( sb.length() < padLen ) sb.append(ch);
      sb.setLength(padLen);                        // trim multi-char-pad overshoot (matches padStart)
      sb.append(str);
      return sb.toString();    `
  },
  {
    name: 'rPad',
    documentation: "Right pad the supplied string to the specified length using the supplied character, or '0' is not specified.",
    args: [
      { class: 'String', name: 'str' },
      { class: 'Int',    name: 'len' },
      { class: 'String', name: 'ch', value: '0' }
    ],
    code: function(str, len, ch) {
      return foam.core.reflow.lib.rPad(str, len, ch || '0');
    },
    javaCode: `
      if ( str == null ) str = "";
      if ( ch == null || ch.isEmpty() ) ch = "0";
      int padLen = len - str.length();
      if ( padLen <= 0 ) return str;
      StringBuilder sb = new StringBuilder(len);
      sb.append(str);
      while ( sb.length() < len ) sb.append(ch);
      sb.setLength(len);                           // trim overshoot (matches padEnd)
      return sb.toString();
    `
  },
  {
    name: 'diff',
    documentation: 'The positive (absolute) difference between two numbers.',
    args: [ { class: 'Double', name: 'a' }, { class: 'Double', name: 'b' } ],
    code: function(a, b) { return foam.core.reflow.lib.diff(a, b); },
    javaCode: `return Math.abs(a - b);`
  },
  {
    name: 'fix',
    documentation: 'Format a number to a fixed number of decimal places (default 0).',
    args: [ { class: 'Double', name: 'num' }, { class: 'Int', name: 'precision', value: 0 } ],
    code: function(num, precision) { return foam.core.reflow.lib.fix(num, precision); },
    javaCode: `return String.format("%." + precision + "f", num);`
  },
  {
    name: 'currency',
    documentation: 'Format a number with grouped thousands and a fixed precision (default 2).',
    args: [ { class: 'Double', name: 'amt' }, { class: 'Int', name: 'precision', value: 2 } ],
    code: function(amt, precision) { return foam.core.reflow.lib.currency(amt, precision); },
    javaCode: `
      java.text.NumberFormat nf = java.text.NumberFormat.getNumberInstance();
      nf.setMaximumFractionDigits(precision);
      return nf.format(amt);
  `
  },
  {
    name: 'mid',
    aName: 'MID',
    documentation: 'Return len characters of str starting at 1-based position start (Excel MID).',
    args: [
      { class: 'String', name: 'str' },
      { class: 'Int',    name: 'start' },
      { class: 'Int',    name: 'len' }
    ],
    code: function(str, start, len) {
      if ( str == null ) return '';
      str = '' + str;
      var begin = Math.max(0, start - 1);
      if ( begin >= str.length || len <= 0 ) return '';
      return str.substring(begin, Math.min(str.length, begin + len));
    },
    javaCode: `
      if ( str == null ) return "";
      int begin = Math.max(0, start - 1);
      if ( begin >= str.length() || len <= 0 ) return "";
      return str.substring(begin, Math.min(str.length(), begin + len));
  `
  },
  {
    name: 'substr',
    aName: 'SUBSTR',
    documentation: 'JS-style substring: 0-based, end index exclusive (SUBSTR("hello",1,3)="el"). Second arg optional -> to end.',
    args: [
      { class: 'String', name: 'str' },
      { class: 'Int',    name: 'start' },
      { class: 'Int',    name: 'end', value: -1 }   // -1 sentinel: "to end of string"
    ],
    code: function(str, start, end) {
      if ( str == null ) return '';
      str = '' + str;
      return str.substring(start, end < 0 ? str.length : end);
    },
    javaCode: `
      if ( str == null ) return "";
      int e = end < 0 ? str.length() : Math.min(end, str.length());
      int s = Math.max(0, Math.min(start, e));
      return str.substring(s, e);
    `
  }
]);






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

setTimeout(function() {
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
          if ( out !== expected ) debugger;
        } catch (err) {
          console.log(pad(s), '-> ERROR:', (err && err.message) || err);
          debugger;
        }
      }

      function ex(s, expected) {
        try {
          var e   = p.parseExpression(s);
          console.log('*****', s, ' -> ' , e);
          var out = ( e && e.f ) ? e.f(data) : e;
          var tag = expected === undefined ? ''
              : (out === expected ? '  PASS' : '  FAIL (expected ' + JSON.stringify(expected) + ')');
          try {
            console.log(pad(s), '->', (e ? e.toString() : '(no parse)'), '=', JSON.stringify(out) + tag);
          } catch (x) {
            // In case 'out' has circular references and can't be output as JSON
            console.log(pad(s), '->', (e ? e.toString() : '(no parse)'), '=', out, tag);
          }
          if ( out !== expected ) debugger;
        } catch (err) {
          console.log(pad(s), '-> ERROR:', (err && err.message) || err);
          debugger;
        }
      }

      ex('LPAD(firstName, 12, "X")', "XXXXXXXKevin");
      ex('LPAD(firstName, 12)', "0000000Kevin");

      ex('RPAD(firstName, 12, "X")', "KevinXXXXXXX");
      ex('RPAD("11111", 12)', "111110000000");

      ex('CONCAT(true, false)', 'truefalse');
      ex('IFS(true, 42)', 42);
      ex('IFS(balance > 200, "high")', 'high');
      ex('IFS(balance > 1000, "high", balance > 500, "medium", true, "low")', 'high');
      ex('CONCAT("abc","def")', "abcdef");

      /*
      exPart('true', 1, 'number');

      ex('IF(true, "true", "false")', 1);
      ex('IF(true, 1, 0)', 1);
      ex('IF(1 = 2, "true", "false")', 1);
      ex('IF("abc" = "def", 1, 0)', 1);
      ex('IF(balance > 1000, "high", "low")', 'high');
      ex('IF(id = 42, firstName, lastName)', 'Kevin');
      ex('IF(balance > 1000, balance * 2, 0)', 3000);

      console.log('── test parts ──');
      exPart('1', 1, 'number');
      exPart('12', 12, 'primary');
      exPart('"abc"', 'abc', 'primary');
      exPart('"def"', 'def', 'quoted string');
      exPart('true', true, 'primary');
      exPart('false', false, 'primary');
      exPart('3^2', 9, 'power');
      exPart('-2', -2, 'neg');
      exPart('-3^2', 9, 'unary'); // Not Excel compatible
      exPart('1+2', 3, 'addsub');
      exPart('2-1', 1, 'addsub');
      exPart('2*3', 6, 'muldiv');
      exPart('2*4', 8, 'concat');
      exPart('city', 'city', 'ident');
      */

      console.log('── leaves ──');
      ex('12', 12);
      ex('13', 13);
      ex('"abc"', 'abc');
      ex('"def"', 'def');
      ex('true', true);
      ex('false', false);

      console.log('── power / unary ──');
      ex('3^2', 9);
      ex('-2', -2);
      ex('-3^2', -9);
      ex('2 ^ -3', 0.125);

      console.log('── mul / add / concat (numeric) ──');
      ex('2*3', 6);
      ex('2*4', 8);
      ex('1+2', 3);
      ex('2-1', 1);
      ex('2 + 3 * 4', 14);
      ex('(2 + 3) * 4', 20);
      ex('10 / 4', 2.5);

      console.log('── associativity (left-assoc via fold) ──');
      ex('10-2-3', 5);      // SUB(SUB(10,2),3)
      ex('100/10/2', 5);    // DIV(DIV(100,10),2)

      console.log('── fields & dotted access ──');
      ex('id', 42);
      ex('firstName', 'Kevin');
      ex('balance * 2', 3000);
      ex('address.city', 'Toronto');

      console.log('── functions ──');
      ex('LEN(firstName)', 5);
      ex('LEFT(firstName, 3)', 'Kev');
      ex('UPPER(lastName)', 'GREER');
      ex('UPPER(address.city)', 'TORONTO');

      console.log('── concat over strings ──');
      ex('firstName + lastName', 'KevinGreer');
      ex('"Hello, " + firstName', 'Hello, Kevin');
      ex('firstName + "!"', 'Kevin!');
      ex('firstName + " " & lastName', 'Kevin Greer');
      ex('LEFT(firstName, 3) + "."', 'Kev.');

      console.log('── IF ──');
      ex('IF(true, 1, 0)', 1);
      ex('IF(false, 1, 0)', 0);
      ex('IF(balance > 1000, "high", "low")', 'high');
      ex('IF(id = 42, firstName, lastName)', 'Kevin');
      ex('IF(balance > 1000, balance * 2, 0)', 3000);

      console.log('── IFS ──');
      ex('IFS(1,2,3)', 'high');
      ex('IFS(balance > 1000, "high", balance > 500, "medium", true, "low")', 'high');

      console.log('── date fn (printed, not asserted) ──');
      ex('YEARS(born)');

      console.log('── should NOT parse ──');
      ex('BOGUS(1)');
      ex('LEFT("x")');

      console.log('── new lib mlangs: diff / fix / currency / MID / SUBSTR ──');

      // diff — absolute difference, mixed int/float args
      ex('diff(10, 3)', 7);
      ex('diff(3, 10)', 7);              // order-independent (abs)
      ex('diff(balance, 2000)', 500);    // Float prop vs int literal -> cast prelude exercised
      ex('diff(id, 50)', 8);             // both ints through Float-typed args

      // fix — fixed decimals, returns a STRING (toFixed / String.format)
      ex('fix(3.14159, 2)', '3.14');
      ex('fix(balance, 2)', '1500.00');
      ex('fix(2.5)', '2');               // precision defaults to 0 (value:0)  -> "2" or "3"? see note
      ex('fix(2.4)', '2');
      ex('fix(3)', '3');

      // currency — grouped, precision default 2; US-locale expectation
      ex('currency(1234.5)', '1,234.5'); // maximumFractionDigits:2, no trailing zero pad
      ex('currency(1234.567, 2)', '1,234.57');
      ex('currency(balance)', '1,500');

      // MID — Excel: 1-based, third arg is LENGTH
      ex('MID(firstName, 2, 3)', 'evi');   // chars 2..4
      ex('MID(firstName, 1, 2)', 'Ke');
      ex('MID(firstName, 4, 99)', 'in');   // len past end -> clamped
      ex('MID(firstName, 10, 3)', '');     // start past end -> empty

      // SUBSTR — JS: 0-based, third arg is END (exclusive)
      ex('SUBSTR(firstName, 1, 3)', 'ev'); // [1,3)
      ex('SUBSTR(firstName, 0, 2)', 'Ke');
      ex('SUBSTR(firstName, 2)', 'vin');   // end omitted -> to end (value:-1 sentinel)
      ex('SUBSTR(firstName, 10)', '');     // start past end -> clamped empty

      // MID vs SUBSTR: same window, different conventions, same result
      ex('MID(firstName, 2, 2)', 'ev');    // 1-based start 2, len 2
      ex('SUBSTR(firstName, 1, 3)', 'ev'); // 0-based [1,3)   -> both "ev"

    }
  ]
});

// auto-run if a context is available
try { foam.parse.test.AScriptDemo.create().run(); } catch (e) {}

}, 3000);
