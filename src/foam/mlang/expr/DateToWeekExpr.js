/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang.expr',
  name: 'DateToWeekExpr',
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
      documentation: 'Output type is String (YYYY-WWW format) - not parseable as a date'
    }
  ],

  methods: [
    {
      name: 'f',
      code: function(obj) {
        var date = this.delegate.f(obj);
        if ( ! date ) return '';

        // Get ISO week number (1-53)
        // ISO week starts on Monday, week 1 contains first Thursday of year
        var d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        var dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        var weekNum = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);

        return date.getFullYear() + '-W' + String(weekNum).padStart(2, '0');
      },
      javaCode: `
        java.util.Date date = (java.util.Date) getDelegate().f(obj);
        if ( date == null ) return "";

        java.util.Calendar cal = java.util.Calendar.getInstance();
        cal.setTime(date);
        cal.setFirstDayOfWeek(java.util.Calendar.MONDAY);
        cal.setMinimalDaysInFirstWeek(4);

        int year = cal.get(java.util.Calendar.YEAR);
        int week = cal.get(java.util.Calendar.WEEK_OF_YEAR);

        return String.format("%04d-W%02d", year, week);
      `
    }
  ]
});
