/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.chart',
  name: 'TimeScale',
  extends: 'foam.u2.chart.LinearScale',

  documentation: `
    A LinearScale over dates, in milliseconds, whose ticks fall on the start
    of each unit: with unit 'month' a range from 2024-01-15 to 2024-04-02
    gets ticks at February 1, March 1 and April 1, labelled "Feb 2024",
    "Mar 2024", "Apr 2024".

    Everything is computed in UTC. A date stored as midnight UTC, such as
    2024-03-01T00:00Z, is still February 29 in New York, so local-time
    methods would label March's data as February.
  `,

  constants: [
    {
      name: 'UNITS',
      documentation: 'The units this scale understands, smallest first.',
      value: [ 'millisecond', 'second', 'minute', 'hour', 'day', 'week', 'month', 'quarter', 'year' ]
    }
  ],

  properties: [
    {
      class: 'String',
      name: 'unit',
      value: 'day',
      documentation: 'One of UNITS: the period each tick marks.'
    }
  ],

  methods: [
    function startOf(d) {
      // The first instant of the unit that holds d: 2024-03-17 -> 2024-03-01 for 'month'.
      var t = new Date(d);
      switch ( this.unit ) {
        case 'year':    return new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
        case 'quarter': return new Date(Date.UTC(t.getUTCFullYear(), Math.floor(t.getUTCMonth() / 3) * 3, 1));
        case 'month':   return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1));
        case 'week':
          // ISO weeks start on Monday; getUTCDay() is 0 on Sunday.
          var day = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
          return new Date(day - (( t.getUTCDay() + 6 ) % 7) * 86400000);
        case 'day':     return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()));
        case 'hour':    return new Date(Math.floor(t.getTime() / 3600000) * 3600000);
        case 'minute':  return new Date(Math.floor(t.getTime() / 60000) * 60000);
        case 'second':  return new Date(Math.floor(t.getTime() / 1000) * 1000);
        default:        return t;
      }
    },

    function next(d) {
      var t = new Date(d);
      switch ( this.unit ) {
        case 'year':    return new Date(Date.UTC(t.getUTCFullYear() + 1, t.getUTCMonth(), 1));
        case 'quarter': return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 3, 1));
        case 'month':   return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 1));
        case 'week':    return new Date(t.getTime() + 7 * 86400000);
        case 'day':     return new Date(t.getTime() + 86400000);
        case 'hour':    return new Date(t.getTime() + 3600000);
        case 'minute':  return new Date(t.getTime() + 60000);
        case 'second':  return new Date(t.getTime() + 1000);
        default:        return new Date(t.getTime() + 1);
      }
    },

    function fit(maxTicks) {
      // A unit too fine for the range moves up until its ticks fit: a year
      // of data on unit 'day' with room for 12 ticks gets unit 'month'.
      // Lengths are approximate (a month is taken as 30.44 days); that is
      // close enough to choose a unit.
      var ms = { millisecond: 1, second: 1e3, minute: 6e4, hour: 36e5, day: 864e5,
                 week: 6048e5, month: 2630016e3, quarter: 7890048e3, year: 31556952e3 };
      var i  = Math.max(0, this.UNITS.indexOf(this.unit));
      while ( i < this.UNITS.length - 1 && ( this.max - this.min ) / ms[this.UNITS[i]] > maxTicks ) i++;
      this.unit = this.UNITS[i];
      return this;
    },

    function nice() {
      // Dates keep their own range; ticks() snaps to unit boundaries instead.
      if ( this.min === this.max ) this.max = this.next(this.max).getTime();
      return this;
    },

    function ticks() {
      var ret = [];
      var d   = this.startOf(this.min);
      if ( d.getTime() < this.min ) d = this.next(d);
      // 2,000 ticks is far more than any axis can show; the cap stops a
      // millisecond unit over a year-long range from building millions.
      for ( var i = 0 ; i < 2000 && d.getTime() <= this.max ; i++ ) {
        ret.push(d.getTime());
        d = this.next(d);
      }
      return ret;
    },

    function format(v, opt_long) {
      var d = new Date(v);
      var f = function(opts) {
        return d.toLocaleString(foam.locale, Object.assign({ timeZone: 'UTC' }, opts));
      };
      var long = !! opt_long;
      switch ( this.unit ) {
        case 'year':    return String(d.getUTCFullYear());
        case 'quarter': return 'Q' + ( Math.floor(d.getUTCMonth() / 3) + 1 ) + ' ' + d.getUTCFullYear();
        case 'month':   return f({ month: 'short', year: 'numeric' });
        case 'week':    return ( long ? 'Week of ' : '' ) + f(long ? { month: 'short', day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric' });
        case 'day':     return f(long ? { month: 'short', day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric' });
        case 'hour':    return f({ month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
        case 'minute':  return f(long ? { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } : { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
        default:        return f({ hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', fractionalSecondDigits: this.unit === 'millisecond' ? 3 : undefined });
      }
    }
  ]
});
