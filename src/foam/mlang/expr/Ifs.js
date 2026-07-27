/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang.expr',
  name: 'IfsClause',

  documentation: 'An Ifs clause.',

  properties: [
    {
      class: 'foam.mlang.predicate.PredicateProperty',
      name: 'cond'
    },
    {
      class: 'foam.mlang.ExprProperty',
      name: 'expr'
    }
  ],

  methods: [
    function toString() {
      return this.cond + ' => ' + this.expr;
    }
  ]
});


foam.CLASS({
  package: 'foam.mlang.expr',
  name: 'Ifs',
  extends: 'foam.mlang.AbstractExpr',

  documentation: 'Excel "ifs" or Lisp "cond" like expression for multi-part if statements.',

  properties: [
    {
      class: 'FObjectArray',
      of: 'foam.mlang.expr.IfsClause',
      name: 'clauses'
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
      code: function f(obj) {
        for ( let i = 0 ; i < this.clauses.length ; i++ ) {
          if ( this.clauses[i].cond.f(obj) ) {
            return this.clauses[i].expr.f(obj);
          }
        }
        return '';
      },
      javaCode: `
        for ( int i = 0 ; i < getClauses().length ; i++ )
          if ( getClauses()[i].getCond().f(obj) ) return getClauses()[i].getExpr().f(obj);
        return "";
      `
    },
    {
      name: 'toString',
      code: function() {
        return foam.String.constantize(this.cls_.name) + '(' + this.clauses.join(', ') + ')';
      },
      javaCode: 'return String.format("Ifs");'
    }
  ]
});
