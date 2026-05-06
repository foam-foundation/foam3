/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang',
  name: 'Expressions',

  // Needed because we need to load Expressions to build java, but we don't want to
  // output it to a .java file.
  flags: [],

  documentation: 'Convenience mix-in for requiring all mlangs.',

  requires: [
    'foam.dao.ArraySink',
    'foam.mlang.Constant',
    'foam.mlang.expr.Add',
    'foam.mlang.expr.Divide',
    'foam.mlang.expr.Dot',
    'foam.mlang.expr.Ref',
    'foam.mlang.expr.MaxFunc',
    'foam.mlang.expr.MinFunc',
    'foam.mlang.expr.Multiply',
    'foam.mlang.expr.Subtract',
    'foam.mlang.order.Desc',
    'foam.mlang.order.ThenBy',
    'foam.mlang.predicate.And',
    'foam.mlang.predicate.Contains',
    'foam.mlang.predicate.ContainsIC',
    'foam.mlang.predicate.Find',
    'foam.mlang.predicate.DotF',
    'foam.mlang.predicate.Eq',
    'foam.mlang.predicate.False',
    'foam.mlang.predicate.Func',
    'foam.mlang.predicate.Gt',
    'foam.mlang.predicate.Gte',
    'foam.mlang.predicate.Has',
    'foam.mlang.predicate.In',
    'foam.mlang.predicate.Keyword',
    'foam.mlang.predicate.Lt',
    'foam.mlang.predicate.Lte',
    'foam.mlang.predicate.Neq',
    'foam.mlang.predicate.Not',
    'foam.mlang.predicate.Or',
    'foam.mlang.predicate.RegExp',
    'foam.mlang.predicate.IsClassOf',
    'foam.mlang.IsValid',
    'foam.mlang.predicate.IsInstanceOf',
    'foam.mlang.predicate.StartsWith',
    'foam.mlang.predicate.StartsWithIC',
    'foam.mlang.predicate.EndsWith',
    'foam.mlang.predicate.True',
    'foam.mlang.predicate.MQLExpr',
    'foam.mlang.predicate.FScriptPredicate',
    'foam.mlang.sink.Count',
    'foam.mlang.sink.Set',
    'foam.mlang.sink.Explain',
    'foam.mlang.sink.GroupBy',
    'foam.mlang.sink.Map',
    'foam.mlang.sink.Max',
    'foam.mlang.sink.Min',
    'foam.mlang.sink.Projection',
    'foam.mlang.sink.Plot',
    'foam.mlang.sink.Sequence',
    'foam.mlang.sink.Sum',
    'foam.mlang.sink.Unique',
    'foam.mlang.StringLength',
    'foam.mlang.Absolute',
    'foam.mlang.Round',
    'foam.mlang.sink.Average',
    'foam.mlang.Mux',
    'foam.mlang.Partition'
  ],

  constants: [
    {
      name: 'FALSE',
      factory: function() { return foam.mlang.predicate.False.create() }
    },
    {
      name: 'TRUE',
      factory: function() { return foam.mlang.predicate.True.create() }
    }
  ],

  methods: [
    function _nary_(name, args) {
      return this[name].create({ args: Array.from(args) });
    },

    function _unary_(name, arg) {
      foam.assert(arg !== undefined, 'arg is required.');
      return this[name].create({ arg1: arg });
    },

    function _binary_(name, arg1, arg2) {
      foam.assert(arg1 !== undefined, 'arg1 is required.');
      foam.assert(arg2 !== undefined, 'arg2 is required.');
      return this[name].create({ arg1: arg1, arg2: arg2 });
    },

    function OR() { return this._nary_("Or", arguments); },
    function AND() { return this._nary_("And", arguments); },
    function CONTAINS(a, b) { return this._binary_("Contains", a, b); },
    function CONTAINS_IC(a, b) { return this._binary_("ContainsIC", a, b); },
    function FIND(a, b) { return this._binary_("Find", a, b); },
    function EQ(a, b) { return this._binary_("Eq", a, b); },
    function NEQ(a, b) { return this._binary_("Neq", a, b); },
    function IN(a, b) { return this._binary_("In", a, b); },
    function LT(a, b) { return this._binary_("Lt", a, b); },
    function GT(a, b) { return this._binary_("Gt", a, b); },
    function LTE(a, b) { return this._binary_("Lte", a, b); },
    function GTE(a, b) { return this._binary_("Gte", a, b); },
    function HAS(a) { return this._unary_("Has", a); },
    function NOT(a) { return this._unary_("Not", a); },
    function KEYWORD(a) { return this._unary_("Keyword", a); },
    function STARTS_WITH(a, b) { return this._binary_("StartsWith", a, b); },
    function STARTS_WITH_IC(a, b) { return this._binary_("StartsWithIC", a, b); },
    function ENDS_WITH(a, b) { return this._binary_("EndsWith", a, b); },
    function FUNC(fn) { return this.Func.create({ fn: fn }); },
    function DOT(a, b) { return this._binary_("Dot", a, b); },
    function REF(a) { return this._unary_("Ref", a); },
    function DOT_F(a, b) { return this._binary_("DotF", a, b); },
    function ADD() { return this._nary_("Add", arguments); },
    function SUB() { return this._nary_("Subtract", arguments); },
    function MUL() { return this._nary_("Multiply", arguments); },
    function DIV() { return this._nary_("Divide", arguments); },
    function MIN_FUNC() { return this._nary_("MinFunc", arguments); },
    function MAX_FUNC() { return this._nary_("MaxFunc", arguments); },
    function CONSTANT(v) { return this.Constant.create({ value: v }); },

    function UNIQUE(expr, sink) { return this.Unique.create({ expr: expr, delegate: sink }); },
    function GROUP_BY(expr, opt_sinkProto, opt_limit) { return this.GroupBy.create({ arg1: expr, arg2: opt_sinkProto || this.COUNT(), groupLimit: opt_limit || -1 }); },
    function PLOT() { return this._nary_('Plot', arguments); },
    function MAP(expr, sink) { return this.Map.create({ arg1: expr, delegate: sink }); },
    function EXPLAIN(sink) { return this.Explain.create({ delegate: sink }); },
    function COUNT() { return this.Count.create(); },
    function SET(arg1) { return this.Set.create({ arg1: arg1 }); },
    function MAX(arg1) { return this.Max.create({ arg1: arg1 }); },
    function MIN(arg1) { return this.Min.create({ arg1: arg1 }); },
    function SUM(arg1) { return this.Sum.create({ arg1: arg1 }); },
    function AVG(arg1) { return this.Average.create({ arg1: arg1 }); },
    function ABS(arg1) { return this.Absolute.create({ delegate: arg1 }); },
    function ROUND(arg1, opt_decimals) { return this.Round.create({ arg1: arg1, arg2: opt_Decimals || 0 }); },
    function ARRAY() { return this.ArraySink.create() },
    function MUX(cond, a, b) { return this.Mux.create({ cond: cond, a: a, b: b }); },
    function SEQ() { return this._nary_("Sequence", arguments); },
    function PROJECTION(exprs) {
      return this.Projection.create({
        exprs: foam.Array.isInstance(exprs) ?
          exprs :
          foam.Array.clone(arguments)
        });
    },
    function REG_EXP(arg1, regExp) { return this.RegExp.create({ arg1: arg1, regExp: regExp }); },
    {
      name: 'DESC',
      args: [ { name: 'a', type: 'foam.mlang.order.Comparator' } ],
      type: 'foam.mlang.order.Comparator',
      code: function DESC(a) { return this._unary_("Desc", a); },
      swiftCode: `return Desc_create(["arg1": a])`,
    },
    function THEN_BY(a, b) { return this.ThenBy.create({head: a, tail: b}); },

    function INSTANCE_OF(cls) { return this.IsInstanceOf.create({ of: cls }); },
    function CLASS_OF(cls, propExpr) { return this.IsClassOf.create({ of: cls, propExpr: propExpr }); },

    function MQL(mql) { return this.MQLExpr.create({query: mql}); },
    function FSCRIPT(query) { return this.FScriptPredicate.create({query: query}); },

    function STRING_LENGTH(a) { return this._unary_("StringLength", a); },
    function IS_VALID(o) { return this.IsValid.create({arg1: o}); },
    function YEARS(p) { return foam.mlang.Years.create({arg1: p}); },
    function MONTHS(d) { return foam.mlang.Months.create({arg1: d}); },
    function MONTH(d) { return foam.mlang.Month.create({numberOfMonths: d}); },
    function DAYS(d) { return foam.mlang.Days.create({arg1: d}); },
    function DAY(d) { return foam.mlang.Day.create({numberOfDays: d}); },
    function HOURS(d) { return foam.mlang.Hours.create({arg1: d}); },
    function MINUTES(d) { return foam.mlang.Minutes.create({arg1: d}); },
    function NOW() { return foam.mlang.CurrentTime.create(); }
  ]
});
