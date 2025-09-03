/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang.predicate',
  name: 'Func',
  extends: 'foam.mlang.predicate.AbstractPredicate',

  documentation: 'A function to Predicate adapter.',

  // TODO: rename FunctionPredicate

  properties: [
    {
      /** The function to apply to objects passed to this expression */
      name: 'fn'
    }
  ],

  methods: [
    function f(o) { return this.fn(o); },
    function toString() {
      return 'FUNC(' + fn.toString() + ')';
    }
  ]
});


/** Binary expression for equality of two arguments. */
