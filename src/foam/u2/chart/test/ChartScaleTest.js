/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// The scales place every mark on a chart, so these tests pin down the
// numbers a reader sees: the tick values on an axis, where a bar's band
// starts, and which month a date falls in.
foam.CLASS({
  package: 'foam.u2.chart.test',
  name: 'ChartScaleTest',
  extends: 'foam.core.test.JSTest',

  requires: [
    'foam.u2.chart.BandScale',
    'foam.u2.chart.LinearScale',
    'foam.u2.chart.TimeScale'
  ],

  methods: [
    function runTest(x) {
      this.testLinearScale(x);
      this.testBandScale(x);
      this.testTimeScale(x);
      this.testChartFormatter(x);
    },

    function testLinearScale(x) {
      var s = this.LinearScale.create({ min: 0, max: 97, tickCount: 5 }).nice();
      x.test(s.step === 20 && s.max === 100, 'Linear: 0..97 in about 5 steps rounds to steps of 20 up to 100. Got step ' + s.step + ', max ' + s.max);
      x.test(s.ticks().join() === '0,20,40,60,80,100', 'Linear: ticks are 0,20,...,100. Got ' + s.ticks().join());

      s = this.LinearScale.create({ min: -30, max: 70, tickCount: 5 }).nice();
      x.test(s.ticks().indexOf(0) !== -1, 'Linear: a range across zero has a tick at 0. Got ' + s.ticks().join());

      s = this.LinearScale.create({ min: 0, max: 0 }).nice();
      x.test(s.min === 0 && s.max === 1, 'Linear: all zeros still draws on 0..1. Got ' + s.min + '..' + s.max);

      s = this.LinearScale.create({ min: 0, max: 0.2, tickCount: 4 }).nice();
      x.test(s.ticks().join() === '0,0.05,0.1,0.15,0.2', 'Linear: small steps do not pile up float error. Got ' + s.ticks().join());
      x.test(s.format(0.05) === ( 0.05 ).toLocaleString(foam.locale), 'Linear: a 0.05 step keeps two decimals. Got ' + s.format(0.05));

      s = this.LinearScale.create({ min: 0, max: 10, start: 300, end: 0 });
      x.test(s.map(0) === 300 && s.map(10) === 0 && s.map(5) === 150, 'Linear: a vertical axis maps 0 to the bottom and 10 to the top');
    },

    function testBandScale(x) {
      var b = this.BandScale.create({ count: 4, start: 0, end: 400 });
      x.test(b.step() === 100, 'Band: 4 categories on 400 px are 100 px apart');
      x.test(b.center(0) === 50 && b.center(3) === 350, 'Band: the first band is centred at 50, the last at 350');
      x.test(Math.abs(b.bandwidth() - 72) < 1e-9, 'Band: bars cover 72% of their band. Got ' + b.bandwidth());
    },

    function testTimeScale(x) {
      var t = this.TimeScale.create({ unit: 'month', min: Date.UTC(2024, 0, 15), max: Date.UTC(2024, 3, 2) });
      var ticks = t.ticks().map(function(v) { return new Date(v).toISOString().slice(0, 10); });
      x.test(ticks.join() === '2024-02-01,2024-03-01,2024-04-01', 'Time: month ticks fall on the 1st of each month in range. Got ' + ticks.join());

      // 2024-03-01T00:00Z is February 29 in the Americas; the label must still say March.
      var march = Date.parse('2024-03-01T00:00:00Z');
      var label = t.format(march);
      x.test(label.indexOf('2024') !== -1 && label === new Date(march).toLocaleString(foam.locale, { timeZone: 'UTC', month: 'short', year: 'numeric' }),
        'Time: midnight UTC on March 1 labels as March in every time zone. Got ' + label);

      t = this.TimeScale.create({ unit: 'week' });
      x.test(t.startOf(Date.UTC(2024, 2, 3)).toISOString().slice(0, 10) === '2024-02-26',
        'Time: the week of Sunday 2024-03-03 starts on Monday 2024-02-26');
      x.test(t.format(Date.UTC(2024, 1, 26), true).indexOf('Week of ') === 0, 'Time: a week reads "Week of ..." in a tooltip');

      t = this.TimeScale.create({ unit: 'quarter' });
      x.test(t.format(Date.UTC(2024, 4, 10)) === 'Q2 2024', 'Time: May 2024 is "Q2 2024". Got ' + t.format(Date.UTC(2024, 4, 10)));

      t = this.TimeScale.create({ unit: 'day', min: Date.UTC(2024, 0, 1), max: Date.UTC(2024, 11, 31) }).fit(12);
      x.test(t.unit === 'month', 'Time: a year on unit day with room for 12 ticks moves up to month. Got ' + t.unit);
      t = this.TimeScale.create({ unit: 'millisecond', min: Date.UTC(2024, 0, 1), max: Date.UTC(2024, 3, 1) }).fit(10);
      x.test(t.ticks().length <= 10 && t.ticks().length >= 2, 'Time: a millisecond unit over three months draws a handful of ticks, not thousands. Got ' + t.ticks().length);
      t = this.TimeScale.create({ unit: 'month', min: Date.UTC(2024, 0, 1), max: Date.UTC(2024, 1, 1) }).fit(50);
      x.test(t.unit === 'month', 'Time: fit never moves to a finer unit than the one asked for');
    },

    function testChartFormatter(x) {
      var d = foam.lang.Date.create({ name: 'd' });
      x.test(d.chartFormatter(new Date('2024-03-01T00:00:00Z')) === '2024-03-01', 'Label: a Date reads in UTC, so March 1 stays March 1');
      var p = foam.lang.Property.create({ name: 'p' });
      x.test(p.chartFormatter(1234.5) === ( 1234.5 ).toLocaleString(foam.locale), 'Label: a number reads in the locale, e.g. "1,234.5"');
    }
  ]
});
