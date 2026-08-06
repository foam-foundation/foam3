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
    foam.Date.relativeDateString, with the absolute timestamp shown in a
    tooltip. The text self-updates as time passes: a timer fires at the
    next boundary where the string can change (minute/hour/day) and is
    cancelled when the view is detached. Values more than a week away
    render as an absolute date, matching relativeDateString's fallback.
    Purely client-side; makes no server calls.`,

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
      this.start('div', {
          tooltip$: this.data$.map(d => d ?
            self.formatAbsolute_(d) : foam.u2.DateTimeView.DATE_FORMAT)
        }).
        addClass(this.myClass()).
        // FUTURE: support a fixed-unit option (eg. always "N days ago").
        // relativeDateString takes no unit argument — it picks the unit
        // from the value's age — so a unit option needs either a local
        // formatter here or Intl.RelativeTimeFormat, whose format(n, unit)
        // gives both the explicit unit and localized plurals. Adopting
        // Intl inside relativeDateString would localize this view with
        // no changes here, so deferring the option until that decision.
        add(this.slot(function(data, now_) {
          return data ?
            foam.Date.relativeDateString(data) :
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
      return new Date(d).toLocaleString(foam.util.getClientLocale(), {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short'
      });
    },

    function clearTimer_() {
      if ( this.timer_ ) {
        clearTimeout(this.timer_);
        this.timer_ = null;
      }
    },

    function schedule_() {
      this.clearTimer_();
      if ( ! this.data ) return;
      this.timer_ = setTimeout(this.tick, this.nextUpdateDelay_(this.data));
    },

    function nextUpdateDelay_(date) {
      /* Milliseconds until the displayed string can next change. Past
         values age forward to the next minute/hour/day boundary; future
         values count down to the previous one. Beyond that the string
         only changes daily. */
      var diff = Date.now() - date.getTime();
      var abs  = Math.abs(diff);
      var delay;
      if ( abs < this.MINUTE ) {
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
      on: [ 'this.propertyChange.data' ],
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
