/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang.expr',
  name: 'DateToYYYYMMDDExpr',
  extends: 'foam.mlang.AbstractExpr',

  implements: [ 'foam.lang.Serializable' ],

  properties: [
    {
      class: 'foam.mlang.ExprProperty',
      name: 'delegate'
    }
  ],

  methods: [
    {
      name: 'f',
      code: function(obj) {
        var date = this.delegate.f(obj);
        if ( ! date ) return '';

        // Use UTC methods to avoid DST/timezone shifts causing wrong date
        var year  = date.getUTCFullYear();
        var month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
        var day   = date.getUTCDate().toString().padStart(2, '0');

        return year + '/' + month + '/' + day;
      },
      javaCode: `
        java.util.Date date = (java.util.Date) getDelegate().f(obj);
        if ( date == null ) return "";

        java.util.Calendar cal = java.util.Calendar.getInstance(java.util.TimeZone.getTimeZone("UTC"));
        cal.setTime(date);

        int year  = cal.get(java.util.Calendar.YEAR);
        int month = cal.get(java.util.Calendar.MONTH) + 1;
        int day   = cal.get(java.util.Calendar.DAY_OF_MONTH);

        return String.format("%04d/%02d/%02d", year, month, day);
      `
    }
  ]
});
