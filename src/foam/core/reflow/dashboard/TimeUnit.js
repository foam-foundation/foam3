/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.ENUM({
  package: 'foam.core.reflow.dashboard',
  name: 'TimeUnit',

  documentation: `
    How far apart the ticks of a dashboard's date axis are, and how each one
    reads: MONTH writes "Mar 2026" under each month, WEEK "Mar 2" on each
    Monday. foam.u2.chart.TimeScale draws the axis from the unit.
  `,

  properties: [
    {
      class: 'String',
      name: 'unit',
      documentation: 'The foam.u2.chart.TimeScale unit this value stands for, e.g. "month".'
    }
  ],

  values: [
    { name: 'MILLISECOND', label: 'Millisecond', unit: 'millisecond' },
    { name: 'SECOND', label: 'Second', unit: 'second' },
    { name: 'MINUTE', label: 'Minute', unit: 'minute' },
    { name: 'HOUR', label: 'Hour', unit: 'hour' },
    { name: 'DAY', label: 'Day', unit: 'day' },
    { name: 'WEEK', label: 'Week', unit: 'week' },
    { name: 'MONTH', label: 'Month', unit: 'month' },
    { name: 'QUARTER', label: 'Quarter', unit: 'quarter' },
    { name: 'YEAR', label: 'Year', unit: 'year' }
  ]
});
