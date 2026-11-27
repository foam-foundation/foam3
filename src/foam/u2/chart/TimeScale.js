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
    of each unit: with unit MONTH a range from 2024-01-15 to 2024-04-02
    gets ticks at February 1, March 1 and April 1, labelled "Feb 2024",
    "Mar 2024", "Apr 2024".

    Ticks and labels read in the viewer's time zone, because a DateTime is a
    moment: 13:05 in Tokyo is 13:05 on the axis. Set utc for a Date, which
    is stored as midnight UTC: 2024-03-01T00:00Z is still February 29 in New
    York, so local time would label March's data as February.
  `,

  requires: [
    'foam.u2.chart.TimeUnit'
  ],

  messages: [
    { name: 'WEEK_OF', message: 'Week of' }
  ],

  properties: [
    {
      class: 'Enum',
      of: 'foam.u2.chart.TimeUnit',
      name: 'unit',
      value: 'DAY',
      documentation: 'The period each tick marks. A name such as \'month\' adapts to its value.'
    },
    {
      class: 'Boolean',
      name: 'utc',
      documentation: 'Read dates in UTC instead of the viewer\'s time zone; on for dates stored as midnight UTC.'
    },
    {
      class: 'Int',
      name: 'every',
      value: 1,
      documentation: `
        How many units apart the ticks are. With unit MINUTE and every 10 an
        hour of data gets 21:40, 21:50, 22:00 instead of one tick per minute,
        or one tick per hour. fit() picks it from the unit's steps.
      `
    }
  ],

  methods: [
    function parts_(d) {
      // The calendar fields of d, in UTC or the viewer's zone.
      var t = new Date(d), u = this.utc;
      return {
        y:   u ? t.getUTCFullYear() : t.getFullYear(),
        m:   u ? t.getUTCMonth()    : t.getMonth(),
        d:   u ? t.getUTCDate()     : t.getDate(),
        h:   u ? t.getUTCHours()    : t.getHours(),
        mi:  u ? t.getUTCMinutes()  : t.getMinutes(),
        day: u ? t.getUTCDay()      : t.getDay()
      };
    },

    function date_(y, m, d, h) {
      // Field arithmetic, not milliseconds, so a day stays a day across a
      // daylight-saving change: date_(2024, 2, 31) is March 31, and
      // date_(2024, 1, 30) rolls over to March 1.
      return this.utc ? new Date(Date.UTC(y, m, d, h || 0)) : new Date(y, m, d, h || 0);
    },

    function startOf(d) {
      // The first instant of the unit that holds d: 2024-03-17 -> 2024-03-01 for MONTH.
      return this.unit.startOf(this, this.parts_(d), new Date(d).getTime());
    },

    function next(d) {
      return this.unit.next(this, this.parts_(d), new Date(d).getTime());
    },

    function fit(maxTicks) {
      // Picks the unit and the step whose ticks fit: a year of data on DAY
      // with room for 12 ticks gets MONTH, and an hour of data on MINUTE with
      // room for 8 gets a tick every 10 minutes.
      var units = this.TimeUnit.VALUES;
      var span  = this.max - this.min;
      var i     = units.indexOf(this.unit);
      // A range shorter than its unit can hold no tick at all: three minutes
      // of data on HOUR from 21:31 to 21:34. Move to a finer unit until the
      // range holds two. A range of one instant keeps its unit; nice() widens it.
      this.every = 1;
      while ( i > 0 && span > 0 && span < units[i].ms ) {
        this.unit = units[i];
        if ( this.ticks().length >= 2 ) break;
        i--;
      }
      for ( ; i < units.length ; i++ ) {
        var steps = units[i].steps;
        for ( var j = 0 ; j < steps.length ; j++ ) {
          var last = i === units.length - 1 && j === steps.length - 1;
          if ( last || span / ( units[i].ms * steps[j] ) <= maxTicks ) {
            this.unit  = units[i];
            this.every = steps[j];
            return this;
          }
        }
      }
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
      // Every unit start is visited and only those on a multiple of every
      // are kept, so ticks land on round times: minute 40, 50, 0, never 43.
      // The cap stops a millisecond unit over a year-long range from
      // building millions of ticks.
      for ( var i = 0 ; i < this.MAX_TICKS * this.every && d.getTime() <= this.max ; i++ ) {
        if ( this.unit.index(this, this.parts_(d), d.getTime()) % this.every === 0 ) ret.push(d.getTime());
        d = this.next(d);
      }
      return ret;
    },

    function format(v, opt_long) {
      var d  = new Date(v);
      var tz = this.utc ? { timeZone: 'UTC' } : {};
      var f  = function(opts) { return d.toLocaleString(foam.locale, Object.assign({}, tz, opts)); };
      return this.unit.format(this, this.parts_(v), f, !! opt_long);
    }
  ]
});
