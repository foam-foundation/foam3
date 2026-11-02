/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang.predicate',
  name: 'FScriptPredicate',
  extends: 'foam.mlang.predicate.AbstractPredicate',

  documentation: `
    Use FScript as an mlang predicate rather than an mlang expression.
    This makes it possible to use FScript with interfaces that expect
    a predicate. If the underlying expression does not return a boolean
    the result is a casting error.
  `,

  javaImports: [
    'foam.lang.PropertyInfo'
  ],

  properties: [
    {
      class: 'String',
      name: 'query'
    },
    {
      class: 'Object',
      name: 'prop',
      javaType: 'PropertyInfo'
    }
  ],

  methods: [
    {
      name: 'f',
      code: function(o) {
        return foam.mlang.predicate.FScript.create({
          query: this.query,
          prop: this.prop
        }).f(o);
      },
      javaCode: `
        var fScriptExpr = new FScript();
        fScriptExpr.setQuery(getQuery());
        fScriptExpr.setProp(getProp());
        return (boolean) fScriptExpr.f(obj);
      `
    },
    {
      name: 'authorize',
      javaCode: `
        var fScriptExpr = new FScript();
        fScriptExpr.setQuery(getQuery());
        fScriptExpr.setProp(getProp());
        fScriptExpr.authorize(x, of);
      `
    }
  ]
});
