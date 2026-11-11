/**
* @license
* Copyright 2026 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.u2.test',
  name: 'RORelativeDateTimeViewTest',
  extends: 'foam.core.test.JSTest',

  requires: [
    'foam.u2.view.RelativeDateTimeView',
    'foam.u2.view.RORelativeDateTimeView'
  ],

  methods: [
    async function runTest(x) {
      // Exact strings need a fixed language; put the app's back afterwards.
      var oldLocale = foam.locale;
      foam.locale = 'en-US';
      try {
        this.testStrings(x);
        await this.testViews(x);
      } finally {
        foam.locale = oldLocale;
      }
    },

    function atNow(t, fn) {
      // Fix "now" so calendar words (today, last week) are exact.
      var realNow = Date.now;
      Date.now = () => t;
      try { fn(); } finally { Date.now = realNow; }
    },

    function testStrings(x) {
      var MINUTE = 60000, HOUR = 3600000, DAY = 86400000;
      var R   = (d, u) => foam.Date.relativeDateString(d, u);
      var NOW = new Date(2026, 10, 6, 9, 0, 0).getTime(); // Friday Nov 6, 9:00am local

      this.atNow(NOW, () => {
        x.test(R(new Date(NOW - 10000)) === 'now', 'under a minute reads now');
        x.test(R(new Date(NOW + 2 * MINUTE)) === 'now', 'a clock 2 minutes ahead reads now');
        x.test(R(new Date(NOW - 3 * HOUR)) === '3 hours ago', 'hours');
        x.test(R(new Date(NOW - 40 * HOUR)) === '1 day ago', 'elapsed days');
        x.test(R(new Date(NOW - 7 * DAY)) === 'Oct 30', '7 days is a date, got ' + R(new Date(NOW - 7 * DAY)));
        x.test(R(new Date(2025, 11, 30, 9)) === 'Dec 30, 2025',
          'last calendar year shows the year, got ' + R(new Date(2025, 11, 30, 9)));
        x.test(R(new Date(NOW + 3 * DAY)) === 'in 3 days', 'future');
        x.test(R(null) === '' && R(new Date('x')) === '', 'a bad date is blank, no throw');
        foam.locale = 'fr';
        x.test(R(new Date(NOW - 3 * HOUR)) === 'il y a 3 heures', 'app language wins');
        // A malformed saved language (underscore) must not break every date.
        foam.locale = 'en_US';
        var bad;
        try { bad = R(new Date(NOW - 3 * HOUR)); } catch (e) { bad = 'threw ' + e; }
        x.test(/\b3\b/.test(bad), 'a malformed app language falls back, got ' + bad);
        foam.locale = 'en-US';
      });

      // smallestUnit. Weeks start on Monday here, whatever the test browser says.
      var U = foam.time.TimeUnit;
      var t = ms => new Date(NOW + ms);
      var realWeekStart = foam.Date.weekStart_;
      var hasWeekInfo = !! ( Intl.Locale && ( Intl.Locale.prototype.getWeekInfo ||
        'weekInfo' in new Intl.Locale('en-US') ) );
      x.test(realWeekStart('en-GB') === 1, 'en-GB weeks start on Monday');
      x.test(realWeekStart('en-US') === ( hasWeekInfo ? 7 : 1 ),
        'en-US weeks start on Sunday when the browser knows, else Monday; got ' + realWeekStart('en-US'));
      x.test(realWeekStart('not a locale') === 1, 'a bad locale falls back to Monday');
      foam.Date.weekStart_ = () => 1;
      try {
        this.atNow(NOW, () => {
          x.test(R(t(-10000), U.HOUR) === 'this hour', 'HOUR: 8:59:50 is this hour');
          x.test(R(t(-40 * HOUR), U.HOUR) === '1 day ago', 'HOUR: past a day falls back');
          x.test(R(t(-3 * HOUR), U.DAY) === 'today', 'DAY: 6am is today');
          x.test(R(t(-13 * HOUR), U.DAY) === 'yesterday', 'DAY: 8pm yesterday');
          x.test(R(t(-40 * HOUR), U.DAY) === '2 days ago', 'DAY: calendar days');
          x.test(R(t(-40 * DAY), U.DAY) === '40 days ago', 'DAY: no 7-day fallback');
          x.test(R(t(-400 * DAY), U.DAY) === 'Oct 2, 2025', 'DAY: a year is a date, got ' + R(t(-400 * DAY), U.DAY));
          x.test(R(t(-13 * HOUR), U.WEEK) === 'this week', 'WEEK: this week');
          x.test(R(t(-5 * DAY), U.WEEK) === 'last week', 'WEEK: Sunday is last week');
          x.test(R(t(-40 * DAY), U.WEEK) === '6 weeks ago', 'WEEK: weeks');
          x.test(R(t(3 * DAY), U.WEEK) === 'next week', 'WEEK: Monday ahead is next week');
          x.test(R(t(-3 * HOUR), U.MONTH) === R(t(-3 * HOUR)), 'an unsupported unit acts as no setting');
        });

        // utc: a DateTimeUTC value counts UTC days, so the text names the
        // same day as its UTC tooltip whatever the viewer's time zone.
        var utcNow = Date.UTC(2026, 10, 6, 0, 30);        // Nov 6 00:30 UTC
        this.atNow(utcNow, () => {
          var lateNov5 = new Date(Date.UTC(2026, 10, 5, 23, 30));
          x.test(foam.Date.relativeDateString(lateNov5, U.DAY, true) === 'yesterday',
            'utc DAY: 23:30 UTC the day before is yesterday, got ' + foam.Date.relativeDateString(lateNov5, U.DAY, true));
          x.test(foam.Date.relativeDateString(new Date(Date.UTC(2026, 10, 6, 0, 5)), U.DAY, true) === 'today',
            'utc DAY: 00:05 UTC is today');
          // Thu Nov 5 23:30 UTC, Fri Nov 6 00:30 UTC: same Monday week.
          x.test(foam.Date.relativeDateString(lateNov5, U.WEEK, true) === 'this week', 'utc WEEK: this week');
          // Sun Nov 1 23:30 UTC vs Mon Nov 2 00:30 UTC: different weeks.
          var mondayStart = Date.UTC(2026, 10, 2, 0, 30);
          this.atNow(mondayStart, () => {
            x.test(foam.Date.relativeDateString(new Date(Date.UTC(2026, 10, 1, 23, 30)), U.WEEK, true) === 'last week',
              'utc WEEK: Sunday 23:30 UTC is last week on Monday 00:30 UTC');
          });
        });
      } finally {
        foam.Date.weekStart_ = realWeekStart;
      }
    },

    async function testViews(x) {
      var MINUTE = 60000, HOUR = 3600000, DAY = 86400000;
      var wait   = ms => new Promise(res => setTimeout(res, ms));

      // The relativeDateString contract the view renders
      x.test(foam.Date.relativeDateString(new Date(Date.now() - 3 * HOUR)) === '3 hours ago',
        'relativeDateString renders past hours');
      x.test(foam.Date.relativeDateString(new Date(Date.now() + 2 * DAY + HOUR)) === 'in 2 days',
        'relativeDateString renders future days');

      // View renders the relative string
      var v = this.RORelativeDateTimeView.create(
        { data: new Date(Date.now() - 3 * HOUR) }, x);
      v.write();
      await wait(50);
      x.test(v.element_.textContent.includes('3 hours ago'),
        'view renders relative string');

      // Tooltip carries the absolute timestamp
      var abs = v.formatAbsolute_(v.data);
      x.test(!! abs && abs.includes('' + v.data.getFullYear()),
        'absolute tooltip text includes the year');

      // Data change re-renders
      v.data = new Date(Date.now() - 2 * DAY);
      await wait(50);
      x.test(v.element_.textContent.includes('2 days ago'),
        'view re-renders on data change');

      // Timer schedules at sensible boundaries and never busy-loops
      var d1 = v.nextUpdateDelay_(new Date(Date.now() - 10000));
      x.test(d1 > 45000 && d1 <= MINUTE + 1050,
        'seconds tier waits for the minute boundary, got ' + d1);
      var d2 = v.nextUpdateDelay_(new Date(Date.now() - 90000));
      x.test(d2 > 25000 && d2 <= 35000,
        'minutes tier waits for the next minute, got ' + d2);
      var d3 = v.nextUpdateDelay_(new Date(Date.now() - 3 * HOUR - 10 * MINUTE));
      x.test(d3 > 45 * MINUTE && d3 <= 50 * MINUTE + 1050,
        'hours tier waits for the next hour, got ' + d3);
      var d4 = v.nextUpdateDelay_(new Date(Date.now() + 90000));
      x.test(d4 > 25000 && d4 <= 35000,
        'future values count down to the previous boundary, got ' + d4);
      x.test(v.nextUpdateDelay_(new Date()) >= 1000,
        'delay is clamped to at least a second');

      x.test(!! v.timer_, 'timer is scheduled while attached');
      v.element_.remove();
      v.detach();
      x.test(! v.timer_, 'timer is cleared on detach');

      // No timer without data
      var v2 = this.RORelativeDateTimeView.create({}, x);
      v2.schedule_();
      x.test(! v2.timer_, 'no timer scheduled when data is unset');
      v2.detach();

      // smallestUnit, <time datetime> and the absolute title
      var vd = this.RORelativeDateTimeView.create(
        { data: new Date(Date.now() - 40 * DAY), smallestUnit: 'DAY' }, x);
      vd.write();
      await wait(50);
      x.test(foam.Date.relativeDateString(vd.data, foam.time.TimeUnit.DAY) !== foam.Date.relativeDateString(vd.data),
        'the test date reads differently with DAY, so the next checks can fail');
      var el = vd.element_.querySelector('time') || ( vd.element_.tagName === 'TIME' && vd.element_ );
      x.test(!! el && el.getAttribute('datetime') === vd.data.toISOString(), 'draws <time datetime>');
      var timeEl = vd.childNodes.find(c => c.nodeName === 'time');
      x.test(!! timeEl && timeEl.tooltip === vd.formatAbsolute_(vd.data), 'the tooltip carries the absolute time');
      x.test(!! el && el.textContent === foam.Date.relativeDateString(vd.data, foam.time.TimeUnit.DAY),
        'view passes smallestUnit, got ' + ( el && el.textContent ));
      var midnight = new Date();
      midnight.setHours(24, 0, 0, 0);
      var dd = vd.nextUpdateDelay_(vd.data);
      x.test(Math.abs(dd - (midnight - Date.now())) < 2000, 'DAY ticks at the next local midnight, got ' + dd);
      var timerBefore = vd.timer_;
      vd.clearProperty('smallestUnit');
      x.test(vd.timer_ !== timerBefore, 'changing smallestUnit reschedules the timer');
      vd.element_.remove();
      vd.detach();

      // A DateTimeUTC property: the DAY timer waits for the next UTC midnight.
      var vu = this.RORelativeDateTimeView.create(
        { data: new Date(Date.now() - 40 * DAY), smallestUnit: 'DAY' }, x);
      vu.fromProperty(foam.lang.DateTimeUTC.create({ name: 'when' }));
      var utcMidnight = new Date();
      utcMidnight.setUTCHours(24, 0, 0, 0);
      var du = vu.nextUpdateDelay_(vu.data);
      x.test(Math.abs(du - (utcMidnight - Date.now())) < 2000, 'DateTimeUTC DAY ticks at the next UTC midnight, got ' + du);
      vu.detach();

      var wd = this.RelativeDateTimeView.create(
        { data: new Date(Date.now() - 40 * DAY), smallestUnit: 'DAY', mode: foam.u2.DisplayMode.RO }, x);
      wd.write();
      await wait(50);
      x.test(wd.element_.textContent.includes(foam.Date.relativeDateString(wd.data, foam.time.TimeUnit.DAY)),
        'RelativeDateTimeView passes smallestUnit to its read view, got ' + wd.element_.textContent);
      wd.element_.remove();
      wd.detach();

      // An Invalid Date (a DateTime property can adapt a bad string to one)
      // draws blank and schedules no timer.
      var vi, drew;
      try {
        vi = this.RORelativeDateTimeView.create({ data: new Date('x') }, x);
        vi.write();
        await wait(50);
        drew = true;
      } catch (e) { drew = 'threw ' + e; }
      x.test(drew === true, 'an Invalid Date draws without throwing: ' + drew);
      x.test(!! vi && ! vi.timer_, 'an Invalid Date schedules no timer');
      if ( vi && vi.element_ ) vi.element_.remove();
      if ( vi ) vi.detach();

      // Wrapper delegates read mode to the relative view
      var w = this.RelativeDateTimeView.create(
        { data: new Date(Date.now() - 5 * HOUR), mode: foam.u2.DisplayMode.RO }, x);
      w.write();
      await wait(50);
      x.test(w.element_.textContent.includes('5 hours ago'),
        'RelativeDateTimeView read mode renders relative string');
      w.element_.remove();
      w.detach();
    }
  ]
});
