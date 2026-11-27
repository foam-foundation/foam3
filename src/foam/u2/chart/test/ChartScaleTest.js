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
    'foam.u2.chart.ColorScale',
    'foam.u2.chart.LinearScale',
    'foam.u2.chart.SVGPath',
    'foam.u2.chart.TimeScale',
    'foam.u2.chart.TimeUnit'
  ],

  methods: [
    function runTest(x) {
      this.testLinearScale(x);
      this.testBandScale(x);
      this.testColorScale(x);
      this.testTimeScale(x);
      this.testChartFormatter(x);
      this.testSVGPath(x);
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

      s = this.LinearScale.create({ min: 0.5, max: 9.5, step: 2 });
      x.test(s.ticks().join() === '2,4,6,8', 'Linear: hand-set ends tick on the multiples of the step inside them. Got ' + s.ticks().join());

      s = this.LinearScale.create({ min: 0, max: 1e6, step: 1 });
      x.test(s.ticks().length === s.MAX_TICKS, 'Linear: a step far finer than the range stops at MAX_TICKS. Got ' + s.ticks().length);

      s = this.LinearScale.create({ min: 0, max: 10, start: 300, end: 0 });
      x.test(s.map(0) === 300 && s.map(10) === 0 && s.map(5) === 150, 'Linear: a vertical axis maps 0 to the bottom and 10 to the top');
    },

    function testSVGPath(x) {
      var p = this.SVGPath.create().moveTo(0, 0).lineTo(10, 0).verticalTo(5).horizontalTo(0).close();
      x.test(p.toString() === 'M0,0 L10,0 V5 H0 Z', 'SVGPath: each step adds its command. Got ' + p);
      p = this.SVGPath.create().moveTo(0, 0).curveTo(1, 2, 3, 4, 5, 6).arcTo(5, true, false, 10, 0);
      x.test(p.toString() === 'M0,0 C1,2 3,4 5,6 A5,5 0 1 0 10,0', 'SVGPath: a curve and an arc write their points and flags. Got ' + p);
    },

    function testBandScale(x) {
      var b = this.BandScale.create({ count: 4, start: 0, end: 400 });
      x.test(b.step() === 100, 'Band: 4 categories on 400 px are 100 px apart');
      x.test(b.center(0) === 50 && b.center(3) === 350, 'Band: the first band is centred at 50, the last at 350');
      x.test(Math.abs(b.bandwidth() - 72) < 1e-9, 'Band: bars cover 72% of their band. Got ' + b.bandwidth());
    },

    function testColorScale(x) {
      var s = this.ColorScale.create({ min: 0, max: 10, strong: '#0000ff', tint: '#ffffff', fade: 0.8 });
      x.test(s.blend('#000000', '#ffffff', 0.5) === '#808080', 'Color: half way from black to white is #808080. Got ' + s.blend('#000000', '#ffffff', 0.5));
      x.test(s.colorAt(10) === '#0000ff', 'Color: the highest value is the strong colour. Got ' + s.colorAt(10));
      x.test(s.colorAt(0) === '#ccccff' && s.light() === '#ccccff', 'Color: the lowest value is the strong colour faded 80% toward white. Got ' + s.colorAt(0));
      x.test(s.colorAt(5) === '#6666ff', 'Color: 5 is half way between the pale shade and the strong colour. Got ' + s.colorAt(5));
      x.test(s.colorAt(99) === '#0000ff' && s.colorAt(-9) === '#ccccff', 'Color: a value outside min..max stays on the scale');
      x.test(s.blend('rgb(0, 0, 0)', '#fff', 1) === '#ffffff', 'Color: rgb() and 3-digit hex colours parse');

      s.min = 4; s.max = 4;
      x.test(s.colorAt(4) === '#0000ff', 'Color: when every value is the same each cell is as strong as it gets. Got ' + s.colorAt(4));

      x.test(s.isDark('#0000ff') && ! s.isDark('#ccccff'), 'Color: strong blue is dark and its pale shade is light');
      x.test(s.isDark('#000000') && ! s.isDark('#ffffff'), 'Color: black is dark and white is light');
    },

    function testTimeScale(x) {
      var t = this.TimeScale.create({ unit: 'month', utc: true, min: Date.UTC(2024, 0, 15), max: Date.UTC(2024, 3, 2) });
      var ticks = t.ticks().map(function(v) { return new Date(v).toISOString().slice(0, 10); });
      x.test(ticks.join() === '2024-02-01,2024-03-01,2024-04-01', 'Time: month ticks fall on the 1st of each month in range. Got ' + ticks.join());

      // 2024-03-01T00:00Z is February 29 in the Americas; the label must still say March.
      var march = Date.parse('2024-03-01T00:00:00Z');
      var label = t.format(march);
      x.test(label.indexOf('2024') !== -1 && label === new Date(march).toLocaleString(foam.locale, { timeZone: 'UTC', month: 'short', year: 'numeric' }),
        'Time: midnight UTC on March 1 labels as March in every time zone. Got ' + label);

      t = this.TimeScale.create({ unit: 'week', utc: true });
      x.test(t.startOf(Date.UTC(2024, 2, 3)).toISOString().slice(0, 10) === '2024-02-26',
        'Time: the week of Sunday 2024-03-03 starts on Monday 2024-02-26');
      x.test(t.format(Date.UTC(2024, 1, 26), true).indexOf('Week of ') === 0, 'Time: a week reads "Week of ..." in a tooltip');

      // Without utc a moment reads in the viewer's zone, as on a clock: 13:05 local
      // labels "13:05" and its month starts at local midnight, wherever the test runs.
      t = this.TimeScale.create({ unit: 'minute' });
      x.test(t.format(new Date(2024, 2, 17, 13, 5).getTime()) === '13:05', 'Time: 13:05 local time labels "13:05". Got ' + t.format(new Date(2024, 2, 17, 13, 5).getTime()));
      t = this.TimeScale.create({ unit: 'month' });
      x.test(t.startOf(new Date(2024, 2, 17, 1, 30)).getTime() === new Date(2024, 2, 1).getTime(), 'Time: March 17 local starts its month at local midnight on March 1');
      t = this.TimeScale.create({ unit: 'day' });
      x.test(t.next(new Date(2024, 2, 30)).getTime() === new Date(2024, 2, 31).getTime(), 'Time: the day after March 30 is March 31, even across a daylight-saving change');

      t = this.TimeScale.create({ unit: 'quarter', utc: true });
      x.test(t.format(Date.UTC(2024, 4, 10)) === 'Q2 2024', 'Time: May 2024 is "Q2 2024". Got ' + t.format(Date.UTC(2024, 4, 10)));

      t = this.TimeScale.create({ unit: 'day', min: Date.UTC(2024, 0, 1), max: Date.UTC(2024, 11, 31) }).fit(12);
      x.test(t.unit === this.TimeUnit.MONTH, 'Time: a year on unit day with room for 12 ticks moves up to month. Got ' + t.unit);
      t = this.TimeScale.create({ unit: 'millisecond', min: Date.UTC(2024, 0, 1), max: Date.UTC(2024, 3, 1) }).fit(10);
      x.test(t.ticks().length <= 10 && t.ticks().length >= 2, 'Time: a millisecond unit over three months draws a handful of ticks, not thousands. Got ' + t.ticks().length);
      t = this.TimeScale.create({ unit: 'month', min: Date.UTC(2024, 0, 1), max: Date.UTC(2024, 1, 1) }).fit(50);
      x.test(t.unit === this.TimeUnit.MONTH, 'Time: fit never moves to a finer unit than the one asked for');
    },

    function testChartFormatter(x) {
      var d = foam.lang.Date.create({ name: 'd' });
      x.test(d.chartFormatter(new Date('2024-03-01T00:00:00Z')) === '2024-03-01', 'Label: a Date reads in UTC, so March 1 stays March 1');
      var p = foam.lang.Property.create({ name: 'p' });
      x.test(p.chartFormatter(1234.5) === ( 1234.5 ).toLocaleString(foam.locale), 'Label: a number reads in the locale, e.g. "1,234.5"');
    }
  ]
});
