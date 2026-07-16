/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang.expr',
  name: 'Concat',
  extends: 'foam.mlang.AbstractExpr',

  documentation: 'A varg String concatenation expression.',

  properties: [
    {
      class: 'foam.mlang.ExprArrayProperty',
      name: 'exprs'
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
      code: function(obj) { return this.exprs.map(e => e.f(obj)).join(''); },
      javaCode: `
        StringBuilder sb = new StringBuilder();
        for ( int i = 0 ; i < getExprs().length ; i++ ) {
          sb.append(getExprs()[i].f(obj));
        }
        return sb.toString();
      `
    },
    {
      name: 'toString',
      code: function() {
        return foam.String.constantize(this.cls_.name) + '(' + this.exprs.join('') + ')';
      },
      javaCode: 'return String.format("Concat()");'
    }
  ]
});
