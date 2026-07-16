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
  package: 'foam.ascript',
  name: 'AScriptParser',
  extends: 'foam.parse.SimpleQueryParser',

  documentation: 'Excel-style value expressions sharing SimpleQueryParser literals and predicates.',

  requires: [
    'foam.ascript.FnExpr',
    'foam.parse.Alternate',
    'foam.parse.Literal',
    'foam.mlang.predicate.NamedProperty'
  ],

  static: [
    function PARSE(of, s) {
      let p    = foam.ascript.AScriptParser.create({of: of});
      let expr = p.parseExpression(s);

      return expr;
    }
  ],

  constants: [
    {
      name: 'FUNCTIONS',
      factory: function() {
        const m = foam.mlang.Expressions.create();

        return {
          // lPAD is automatically added by ALIB()
          LEN:     { minArgs: 1, maxArgs: 1, build: function(a) { return m.STRING_LENGTH(a[0]); } },
          // TODO: remove foam.mlang.Absolute
//          ABS:     { minArgs: 1, maxArgs: 1, build: function(a) { return m.ABS(a[0]); } },
          // TODO: remove foam.mlang.Round
//          ROUND:   { minArgs: 1, maxArgs: 2, build: function(a) { return m.ROUND(a[0], a[1]); } }, // mixin bug: opt_Decimals typo
          MIN:     { minArgs: 1, build: function(a) { return m.MIN_FUNC.apply(m, a); } },
          MAX:     { minArgs: 1, build: function(a) { return m.MAX_FUNC.apply(m, a); } },
          SUM:     { minArgs: 1, build: function(a) { return m.ADD.apply(m, a); } },
          CONCAT:  { minArgs: 1, build: function(a) { return m.CONCAT.apply(m, a); } },       // Add concats
          YEARS:   { minArgs: 1, maxArgs: 1, build: function(a) { return m.YEARS(a[0]); } },
          MONTHS:  { minArgs: 1, maxArgs: 1, build: function(a) { return m.MONTHS(a[0]); } },
          DAYS:    { minArgs: 1, maxArgs: 1, build: function(a) { return m.DAYS(a[0]); } },
          HOURS:   { minArgs: 1, maxArgs: 1, build: function(a) { return m.HOURS(a[0]); } },
          MINUTES: { minArgs: 1, maxArgs: 1, build: function(a) { return m.MINUTES(a[0]); } },
          NOW:     { minArgs: 0, maxArgs: 0, build: function( ) { return m.NOW(); } },
        };
      }
    }
  ],

  properties: [
    {
      name: 'extensionGrammar_',
      // NOTE: parameter names must match Parsers members (withArgs injects by name).
      value: function(alt, seq, seq0, seq1, repeat, repeat0, optional, literal, literalIC, str, substring, sym, range) {
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

          power: seq(sym('primary'), opt(seq1(1, seq0(sym('ws'), '^'), sym('unary')))), // right-assoc

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
          if ( v[1] == null ) return v[0];

          return foam.mlang.expr.POWER.create({num: v[0], power: v[1]});
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
