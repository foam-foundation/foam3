/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang',
  name: 'PredicateExpr',
  extends: 'foam.mlang.AbstractExpr',
  implements: [ 'foam.lang.Serializable' ],

  documentation: 'An Expr that wraps a Predicate, allowing it to be used where an Expr is expected.',

  properties: [
    {
      class: 'foam.mlang.predicate.PredicateProperty',
      name: 'predicate'
    }
  ],

  methods: [
    {
      name: 'f',
      code: function(obj) { return this.predicate.f(obj); },
      javaCode: 'return getPredicate().f(obj);'
    }
  ]
});
