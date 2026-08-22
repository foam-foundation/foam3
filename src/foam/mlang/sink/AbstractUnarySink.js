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
     return Number(val).toFixed(this.precision);
    },

    function addValueToE(e, value) {
      // A Date can't be added as text: foam.u2.Text's String property adapts a
      // Date to undefined, so e.add(date) renders nothing. Format through the
      // property's own tableCellFormatter so a Date and a DateTime each display
      // the way their table cell does.
      var prop = this.arg1;
      if ( foam.Date.isInstance(value) && prop && prop.tableCellFormatter ) {
        e.add(e.E('span').call(function() {
          prop.tableCellFormatter.format(this, value, null, prop);
        }));
        return;
      }
      e.add(value);
    }
  ]
});
