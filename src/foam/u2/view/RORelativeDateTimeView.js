/**
* @license
* Copyright 2026 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.u2.view',
  name: 'RORelativeDateTimeView',
  extends: 'foam.u2.View',

  documentation: `A ReadOnly DateTime view which renders the value as a
    relative time string ("3 hours ago", "in 2 days") via
    foam.Date.relativeDateString, which uses Intl.RelativeTimeFormat in the
    app's language. It draws a <time datetime> element with the absolute
    timestamp in a tooltip. smallestUnit (a
    foam.time.TimeUnit) changes the words: DAY gives "today", "yesterday",
    "12 days ago"; WEEK gives "this week", "last week"; HOUR hides minutes.
    The text self-updates as time passes: a timer fires at the next
    boundary where the string can change and is cancelled when the view is
    detached. Purely client-side; makes no server calls.`,

  constants: [
    { name: 'MINUTE', value: 60000 },
    { name: 'HOUR',   value: 3600000 },
    { name: 'DAY',    value: 86400000 }
  ],

  properties: [
    {
      name: 'prop'
    },
    {
      class: 'Enum',
      of: 'foam.time.TimeUnit',
      name: 'smallestUnit',
      documentation: 'HOUR, DAY or WEEK; empty or any other unit means "pick the unit from the age".'
    },
    {
      class: 'Long',
      name: 'now_',
      documentation: 'Bumped by tick to re-evaluate the relative string.',
      factory: function() { return Date.now(); }
    },
    {
      name: 'timer_'
    }
  ],

  methods: [
    function fromProperty(prop) {
      this.SUPER(prop);
      this.prop = prop;
    },

    function render() {
      this.SUPER();
      var self = this;
      // <time datetime> gives the exact moment to machines and assistive
      // tech; the absolute text is foam's tooltip (a title attribute would be
      // removed by foam.u2.Tooltip).
      // Not start('time', args): with args it draws a div, not a time element.
      this.start('time').
        call(function() {
          this.tooltip$.follow(self.data$.map(d => d ?
            self.formatAbsolute_(d) : foam.u2.DateTimeView.DATE_FORMAT));
        }).
        attrs({ datetime: this.data$.map(d => self.isValid_(d) ? d.toISOString() : '') }).
        addClass(this.myClass()).
        add(this.slot(function(data, now_, smallestUnit) {
          return data ?
            foam.Date.relativeDateString(data, smallestUnit) :
            foam.u2.DateTimeView.DATE_FORMAT;
        })).
      end();
      this.schedule_();
      this.onDetach(function() { self.clearTimer_(); });
    },

    function formatAbsolute_(d) {
      // Use the same absolute format the property renders elsewhere
      // (RODateTimeView body / DateTime tableCellFormatter) so the tooltip
      // agrees with other views of the same value. formatLocale also keeps
      // DateTimeUTC properties in UTC.
      if ( this.prop && this.prop.formatLocale ) return this.prop.formatLocale(d);
      return new Date(d).toLocaleString(foam.Date.relativeLocale_(), {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short'
      });
    },

    function isValid_(d) {
      // A DateTime property can adapt a bad string to an Invalid Date.
      return !! d && ! isNaN(d.getTime());
    },

    function clearTimer_() {
      if ( this.timer_ ) {
        clearTimeout(this.timer_);
        this.timer_ = null;
      }
    },

    function schedule_() {
      this.clearTimer_();
      // An Invalid Date would give setTimeout(NaN), which fires at once, forever.
      if ( ! this.isValid_(this.data) ) return;
      this.timer_ = setTimeout(this.tick, this.nextUpdateDelay_(this.data));
    },

    function nextUpdateDelay_(date) {
      /* Milliseconds until the displayed string can next change. Past
         values age forward to the next minute/hour/day boundary; future
         values count down to the previous one. Beyond that the string
         only changes daily. DAY and WEEK count calendar days, so their
         string changes at local midnight. */
      var TU = foam.time.TimeUnit;
      if ( this.smallestUnit === TU.DAY || this.smallestUnit === TU.WEEK ) {
        var midnight = new Date(Date.now());
        midnight.setHours(24, 0, 0, 0);
        return midnight.getTime() - Date.now() + 50;
      }
      var diff = Date.now() - date.getTime();
      var abs  = Math.abs(diff);
      var delay;
      if ( this.smallestUnit === TU.HOUR && abs < this.HOUR ) {
        // "this hour" holds until the value is an hour away.
        delay = diff >= 0 ? this.HOUR - abs : abs;
      } else if ( abs < this.MINUTE ) {
        delay = diff >= 0 ? this.MINUTE - diff : abs;
      } else {
        var unit = abs < this.HOUR ? this.MINUTE :
                   abs < this.DAY  ? this.HOUR   : this.DAY;
        delay = diff >= 0 ? unit - abs % unit : abs % unit;
      }
      // Clamp, and overshoot the boundary slightly so the re-evaluated
      // string lands on the far side of it.
      return Math.max(delay, 1000) + 50;
    }
  ],

  listeners: [
    {
      name: 'onDataChange',
      // smallestUnit moves the next boundary too (DAY waits for midnight).
      on: [ 'this.propertyChange.data', 'this.propertyChange.smallestUnit' ],
      code: function() { this.schedule_(); }
    },
    {
      name: 'tick',
      code: function() {
        this.now_ = Date.now();
        this.schedule_();
      }
    }
  ]
});
