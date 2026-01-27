/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang.expr',
  name: 'DateToHHExpr',
  extends: 'foam.mlang.AbstractExpr',

  implements: [ 'foam.lang.Serializable' ],

  properties: [
    {
      class: 'foam.mlang.ExprProperty',
      name: 'delegate'
    },
    {
      name: 'outputType',
      value: 'String',
      documentation: 'Output type is String (HH format) - hour only, not a full date/time'
    }
  ],

  methods: [
    {
      name: 'f',
      code: function(obj) {
        var date = this.delegate.f(obj);
        if ( ! date ) return '';

        var hours = date.getHours().toString().padStart(2, '0');

        return hours;
      },
      javaCode: `
        java.util.Date date = (java.util.Date) getDelegate().f(obj);
        if ( date == null ) return "";

        java.util.Calendar cal = java.util.Calendar.getInstance();
        cal.setTime(date);

        int hours = cal.get(java.util.Calendar.HOUR_OF_DAY);

        return String.format("%02d", hours);
      `
    }
  ]
});
