/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang',
  name: 'Month',
  extends: 'foam.mlang.AbstractExpr',

  documentation: `Returns the first day of the month. The property numberOfMonths allows specify how many month ahead
                    of behind we want the date to be. For example new Month() returns the first day of the current month.
                    new Month(-1) returns the first day of the previous month`,

  implements: [
    'foam.lang.Serializable'
  ],

  javaImports:[
    'java.util.Calendar'
  ],

  properties: [
    {
      class: 'Int',
      name: 'numberOfMonths',
      value: 0
    }
  ],

  methods: [
    {
      name: 'f',
      code: function() {
        var date = new Date();
        if ( date.getMonth() + numberOfMonths > 12 ) date.setYear(date.getYear()+ Math.floor((date.getMonth()+ numberOfMonths)/12));
        if ( date.getMonth() + numberOfMonths < 0 ) date.setYear(date.getYear()-1-Math.floor((date.getMonth()- numberOfMonths)/12));
        date.setMonth(date.getMonth()+numberOfMonths);
        date.setDate(1);
        date.setHours(0);
        date.setMinutes(0);
        return date;
      },
      javaCode: `
        Calendar cal = Calendar.getInstance();
        cal.add(Calendar.MONTH, getNumberOfMonths());
        cal.set(Calendar.HOUR, 0);
        cal.set(Calendar.MINUTE, 0);
        return cal.getTime();
      `
    },
    {
      name: 'toString',
      type: 'String',
      code: function() {
        return 'Month(\'' + this.numberOfMonths + '\')';
      },
      javaCode: ' return "Month(\'" + getNumberOfMonths() + "\')"; '
    }
  ]
});
