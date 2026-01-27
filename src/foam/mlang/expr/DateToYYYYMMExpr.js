/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang.expr',
  name: 'DateToYYYYMMExpr',
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
      documentation: 'Output type is String (YYYY/MM format)'
    }
  ],

  methods: [
    {
      name: 'f',
      code: function(obj) {
        var date = this.delegate.f(obj);
        if ( ! date ) return '';

        var year  = date.getFullYear();
        var month = (date.getMonth() + 1).toString().padStart(2, '0');

        return year + '/' + month;
      },
      javaCode: `
        java.util.Date date = (java.util.Date) getDelegate().f(obj);
        if ( date == null ) return "";

        java.util.Calendar cal = java.util.Calendar.getInstance();
        cal.setTime(date);

        int year  = cal.get(java.util.Calendar.YEAR);
        int month = cal.get(java.util.Calendar.MONTH) + 1;
        int day   = cal.get(java.util.Calendar.DAY_OF_MONTH);

        return String.format("%04d/%02d", year, month);
      `
    }
  ]
});
