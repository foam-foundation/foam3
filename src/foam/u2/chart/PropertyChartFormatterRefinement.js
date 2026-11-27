/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// How a property's value reads as a chart label. A dashboard that groups by
// a property asks the property to turn each group key into the label under
// its bar: 1234.5 becomes "1,234.5" and a Date becomes "2024-03-01".

foam.CLASS({
  package: 'foam.u2.chart',
  name: 'PropertyChartFormatterRefinement',
  refines: 'foam.lang.Property',

  properties: [
    {
      name: 'chartFormatter',
      value: function(v) { return v.toLocaleString(foam.locale); }
    }
  ]
});


foam.CLASS({
  package: 'foam.u2.chart',
  name: 'DateChartFormatterRefinement',
  refines: 'foam.lang.Date',

  properties: [
    {
      name: 'chartFormatter',
      // A Date is stored as midnight UTC, so it is read in UTC: in New York
      // 2024-03-01T00:00Z is still February 29, and local time would label
      // March's bar "2024-02-29".
      value: function(d) {
        if ( ! foam.Date.isInstance(d) ) d = new Date(d);
        return d.toISOString().slice(0, 10);
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.u2.chart',
  name: 'DateTimeChartFormatterRefinement',
  refines: 'foam.lang.DateTime',

  properties: [
    {
      name: 'chartFormatter',
      // A DateTime is a moment, so it reads in the viewer's time zone: "2024-03-01 9:05".
      value: function(d) {
        if ( ! foam.Date.isInstance(d) ) d = new Date(d);
        var pad = function(n) { return n < 10 ? '0' + n : n; };
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' +
               d.getHours() + ':' + pad(d.getMinutes());
      }
    }
  ]
});
