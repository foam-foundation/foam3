/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang.predicate',
  name: 'Unary',
  extends: 'foam.mlang.predicate.AbstractPredicate',
  abstract: true,

  documentation: 'Abstract Unary (single-argument) Predicate base-class.',

  properties: [
    {
      class: 'foam.mlang.ExprProperty',
      name: 'arg1'
    }
  ],

  methods: [
    function toIndex(tail) {
      return this.arg1 && this.arg1.toIndex(tail);
    },

    function toString() {
      return foam.String.constantize(this.cls_.name) +
          '(' + this.arg1.toString() + ')';
    },
    {
      name: 'prepareStatement',
      javaCode: 'getArg1().prepareStatement(stmt);'
    }
  ]
});
