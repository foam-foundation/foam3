/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang.sink',
  name: 'AbstractUnarySink',
  extends: 'foam.dao.AbstractSink',

  implements: [
    'foam.lang.Serializable'
  ],

  documentation: 'An Abstract Sink baseclass which takes only one argument.',

  properties: [
    {
      class: 'foam.mlang.ExprProperty',
      name: 'arg1',
      hidden: true
    },
    {
      class: 'Int',
      name: 'precision',
      value: -1,
      documentation: 'Number of decimal places for numeric results. -1 means no rounding (default behavior).'
    }
  ],

  methods: [
    function toString() {
      return foam.String.constantize(this.cls_.name) + '(' + this.arg1.toString() + ')';
    },

    function applyPrecision(val) {
      if ( this.precision < 0 || typeof val !== 'number' ) return val;
     return Number(val).toFixed(precision);
    }
  ]
});
