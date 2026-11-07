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
        foam.locale = 'en-US';
      });
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
