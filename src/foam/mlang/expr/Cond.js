/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang.expr',
  name: 'Cond',
  extends: 'foam.mlang.AbstractExpr',

  documentation: 'A condition/if statement.',

  properties: [
    {
      class: 'foam.mlang.predicate.PredicateProperty',
      name: 'cond'
    },
    {
      class: 'foam.mlang.ExprProperty',
      name: 'ifExpr'
    },
    {
      class: 'foam.mlang.ExprProperty',
      name: 'elseExpr'
    }
  ],

  methods: [
    {
      type: 'FObject',
      name: 'fclone',
      javaCode: 'return this;'
    },
    {
      name: 'f',
      code: function f(obj) { return this.cond.f(obj) ? this.ifExpr.f(obj) : this.elseExpr.f(obj); },
      javaCode: 'return getCond().f(obj) ? getIfExpr().f(obj) : getElseExpr().f(obj);'
    },
    {
      name: 'toString',
      code: function() {
        return foam.String.constantize(this.cls_.name) + `(${this.cond}, ${this.ifExpr}, ${this.elseExpr})`;
      },
      javaCode: 'return String.format("If(%s, %s, %s)", getCond().toString(), getIfExpr().toString(), getElseExpr().toString());'
    },
    {

      name: 'partialEval',
      code: function() {
        // TODO
        return this;
      },
      javaCode:
      `
        // TODO
        return this;
      `
    },
  ]
});
