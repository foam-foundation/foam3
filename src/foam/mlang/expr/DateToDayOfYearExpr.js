/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang.expr',
  name: 'DateToDayOfYearExpr',
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
      documentation: 'Output type is String (YYYY-DDD format) - not parseable as a date'
    }
  ],

  methods: [
    {
      name: 'f',
      code: function(obj) {
        var date = this.delegate.f(obj);
        if ( ! date ) return '';

        var start = new Date(date.getFullYear(), 0, 0);
        var diff = date - start;
        var oneDay = 1000 * 60 * 60 * 24;
        var dayOfYear = Math.floor(diff / oneDay);

        return date.getFullYear() + '-' + String(dayOfYear).padStart(3, '0');
      },
      javaCode: `
        java.util.Date date = (java.util.Date) getDelegate().f(obj);
        if ( date == null ) return "";

        java.util.Calendar cal = java.util.Calendar.getInstance();
        cal.setTime(date);

        int year = cal.get(java.util.Calendar.YEAR);
        int dayOfYear = cal.get(java.util.Calendar.DAY_OF_YEAR);

        return String.format("%04d-%03d", year, dayOfYear);
      `
    }
  ]
});
