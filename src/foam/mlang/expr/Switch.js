/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang.expr',
  name: 'Switch',
  extends: 'foam.mlang.AbstractExpr',

  documentation: 'Excel "switch" statements.',

  properties: [
    {
      class: 'foam.mlang.ExprProperty',
      name: 'expr'
    },
    {
      class: 'foam.mlang.ExprArrayProperty',
      name: 'exprs'
    }
  ],

  // SWITCH(switch_value, match_1, result_1, [match_2, result_2, ...], [default])
  methods: [
    {
      type: 'FObject',
      name: 'fclone',
      javaCode: 'return this;'
    },
    {
      name: 'f',
      code: function f(obj) {
        let val = this.expr.f(obj);

        for ( let i = 0 ; i < this.exprs.length ; i += 2 ) {
          let key = this.exprs[i].f(obj);

          // Last default value
          if ( i == this.exprs.length - 1 ) {
            return key;
          }

          if ( key === val ) {
            return this.exprs[i+1].f(obj);
          }
        }

        return '';
      },
      javaCode: `
        Object val = getExpr().f(obj);

        for ( int i = 0 ; i < this.getExprs().length ; i += 2 ) {
          Object key = getExprs()[i].f(obj);

          // Last default value
          if ( i == getExprs().length - 1 ) {
            return key;
          }

          if ( foam.util.SafetyUtil.equals(key, val) ) {
            return getExprs()[i+1].f(obj);
          }
        }

        return "";
      `
    },
    {
      name: 'toString',
      code: function() {
        return foam.String.constantize(this.cls_.name) + '(' + this.expr + ',' + this.exprs.join(', ') + ')';
      },
      // TODO: add exprs() to toString()
      javaCode: 'return "SWITCH(" + getExpr() + ")"; '
    }
  ]
});
