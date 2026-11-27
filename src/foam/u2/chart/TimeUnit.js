/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.ENUM({
  package: 'foam.u2.chart',
  name: 'TimeUnit',

  documentation: `
    The period each tick of a time axis marks, and how the tick reads: MONTH
    writes "Mar 2026" under each month, WEEK "Mar 2" on each Monday. Each
    value knows where its period starts, where the next one starts and how
    to label it; TimeScale asks the value and does the date arithmetic in
    UTC or local time. Values run smallest first, so TimeScale.fit can step
    up to a coarser unit by ordinal.
  `,

  properties: [
    {
      class: 'Long',
      name: 'ms',
      generateJava: false,
      documentation: 'About how long one period is, in milliseconds (a month is taken as 30.44 days); enough to pick a unit.'
    },
    {
      class: 'Function',
      name: 'startOf',
      generateJava: false,
      documentation: 'startOf(scale, parts, time): the first instant of the period holding time, as a Date. A fixed-length period rounds time down.',
      value: function(scale, p, t) { return new Date(Math.floor(t / this.ms) * this.ms); }
    },
    {
      class: 'Function',
      name: 'next',
      generateJava: false,
      documentation: 'next(scale, parts, time): the start of the period after the one starting at time, as a Date.',
      value: function(scale, p, t) { return new Date(t + this.ms); }
    },
    {
      class: 'Function',
      name: 'format',
      generateJava: false,
      documentation: 'format(scale, parts, f, long): the tick label. f(options) formats the date with Intl options in the scale\'s zone; long is for a tooltip title.',
      value: function(scale, p, f) { return f({ hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }); }
    }
  ],

  values: [
    {
      name: 'MILLISECOND', label: 'Millisecond', ms: 1,
      format: function(scale, p, f) {
        return f({ hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', fractionalSecondDigits: 3 });
      }
    },
    { name: 'SECOND', label: 'Second', ms: 1000 },
    {
      name: 'MINUTE', label: 'Minute', ms: 60000,
      format: function(scale, p, f, long) {
        return f(long ? { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } :
                        { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
      }
    },
    {
      name: 'HOUR', label: 'Hour', ms: 3600000,
      // From the fields, not by rounding: in a zone half an hour off UTC an
      // hour starts at :30 UTC.
      startOf: function(scale, p) { return scale.date_(p.y, p.m, p.d, p.h); },
      format:  function(scale, p, f) { return f({ month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }); }
    },
    {
      name: 'DAY', label: 'Day', ms: 86400000,
      startOf: function(scale, p) { return scale.date_(p.y, p.m, p.d); },
      next:    function(scale, p) { return scale.date_(p.y, p.m, p.d + 1); },
      format:  function(scale, p, f, long) {
        return f(long ? { month: 'short', day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric' });
      }
    },
    {
      name: 'WEEK', label: 'Week', ms: 604800000,
      // ISO weeks start on Monday; day is 0 on Sunday.
      startOf: function(scale, p) { return scale.date_(p.y, p.m, p.d - ( p.day + 6 ) % 7); },
      next:    function(scale, p) { return scale.date_(p.y, p.m, p.d + 7); },
      format:  function(scale, p, f, long) {
        return long ?
          scale.WEEK_OF + ' ' + f({ month: 'short', day: 'numeric', year: 'numeric' }) :
          f({ month: 'short', day: 'numeric' });
      }
    },
    {
      name: 'MONTH', label: 'Month', ms: 2630016000,
      startOf: function(scale, p) { return scale.date_(p.y, p.m, 1); },
      next:    function(scale, p) { return scale.date_(p.y, p.m + 1, 1); },
      format:  function(scale, p, f) { return f({ month: 'short', year: 'numeric' }); }
    },
    {
      name: 'QUARTER', label: 'Quarter', ms: 7890048000,
      startOf: function(scale, p) { return scale.date_(p.y, Math.floor(p.m / 3) * 3, 1); },
      next:    function(scale, p) { return scale.date_(p.y, Math.floor(p.m / 3) * 3 + 3, 1); },
      format:  function(scale, p) { return 'Q' + ( Math.floor(p.m / 3) + 1 ) + ' ' + p.y; }
    },
    {
      name: 'YEAR', label: 'Year', ms: 31556952000,
      startOf: function(scale, p) { return scale.date_(p.y, 0, 1); },
      next:    function(scale, p) { return scale.date_(p.y + 1, 0, 1); },
      format:  function(scale, p) { return String(p.y); }
    }
  ]
});
