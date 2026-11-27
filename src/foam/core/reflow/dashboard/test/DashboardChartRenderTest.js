/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// A dashboard chart is configured in its form (colours, legend side, axis
// titles, an On Click Script) and drawn by a foam.u2.chart view. These tests
// run each chart over four rows and check that every form setting reaches
// the view, so a setting that stops working shows up here, not on a client's
// dashboard.

// Rows for the scatter's edge cases: a missing series value and a date field.
foam.CLASS({
  package: 'foam.core.reflow.dashboard.test',
  name: 'ScatterTestRow',
  properties: [
    { class: 'Int',    name: 'id' },
    { class: 'String', name: 'kind' },
    { class: 'Int',    name: 'size' },
    { class: 'Float',  name: 'time' },
    { class: 'Date',   name: 'when' },
    { class: 'DateTime', name: 'at' }
  ]
});

// Rows for the radar's edge cases: a row with no kind, and one with no day.
foam.CLASS({
  package: 'foam.core.reflow.dashboard.test',
  name: 'RadarTestRow',
  properties: [
    { class: 'Int',    name: 'id' },
    { class: 'String', name: 'kind' },
    { class: 'String', name: 'day' },
    { class: 'Int',    name: 'hits' },
    { class: 'Float',  name: 'ms' }
  ]
});

// Rows for the box plot: a row with no kind, one with no day, and a date field.
foam.CLASS({
  package: 'foam.core.reflow.dashboard.test',
  name: 'BoxPlotTestRow',
  properties: [
    { class: 'Int',    name: 'id' },
    { class: 'String', name: 'kind' },
    { class: 'String', name: 'day' },
    { class: 'Float',  name: 'ms' },
    { class: 'Date',   name: 'when' }
  ]
});

// Rows for the candlestick: four numbers per minute, a date and a date-and-time.
foam.CLASS({
  package: 'foam.core.reflow.dashboard.test',
  name: 'CandleTestRow',
  properties: [
    { class: 'Int',      name: 'id' },
    { class: 'String',   name: 'kind' },
    { class: 'DateTime', name: 'at' },
    { class: 'Date',     name: 'day' },
    { class: 'Float',    name: 'first' },
    { class: 'Float',    name: 'top' },
    { class: 'Float',    name: 'bottom' },
    { class: 'Float',    name: 'last' }
  ]
});

foam.CLASS({
  package: 'foam.core.reflow.dashboard.test',
  name: 'DashboardChartRenderTest',
  extends: 'foam.core.test.JSTest',

  requires: [
    'foam.core.reflow.dashboard.DashboardBarChartDAOAgent',
    'foam.core.reflow.dashboard.DashboardBoxPlotChartDAOAgent',
    'foam.core.reflow.dashboard.DashboardBubbleChartDAOAgent',
    'foam.core.reflow.dashboard.DashboardCandlestickChartDAOAgent',
    'foam.core.reflow.dashboard.DashboardFunnelChartDAOAgent',
    'foam.core.reflow.dashboard.DashboardGaugeChartDAOAgent',
    'foam.core.reflow.dashboard.DashboardHeatmapChartDAOAgent',
    'foam.core.reflow.dashboard.DashboardHistogramChartDAOAgent',
    'foam.core.reflow.dashboard.DashboardLineChartDAOAgent',
    'foam.core.reflow.dashboard.DashboardPieChartDAOAgent',
    'foam.core.reflow.dashboard.DashboardRadarChartDAOAgent',
    'foam.core.reflow.dashboard.DashboardScatterChartDAOAgent',
    'foam.core.reflow.dashboard.DashboardStackedBarChartDAOAgent',
    'foam.core.reflow.dashboard.DashboardTreemapChartDAOAgent',
    'foam.core.reflow.dashboard.DashboardWaterfallChartDAOAgent',
    'foam.u2.chart.LegendPosition',
    'foam.core.reflow.dashboard.test.BoxPlotTestRow',
    'foam.core.reflow.dashboard.test.CandleTestRow',
    'foam.core.reflow.dashboard.test.DashboardTestRow',
    'foam.core.reflow.dashboard.test.RadarTestRow',
    'foam.core.reflow.dashboard.test.ScatterTestRow',
    'foam.core.reflow.AvgDAOAgent',
    'foam.core.reflow.MaxDAOAgent',
    'foam.core.reflow.MinDAOAgent',
    'foam.core.reflow.SumDAOAgent',
    'foam.dao.ArrayDAO',
    'foam.u2.chart.BarChart',
    'foam.u2.chart.BoxPlotChart',
    'foam.u2.chart.BubbleChart',
    'foam.u2.chart.CandlestickChart',
    'foam.u2.chart.FunnelChart',
    'foam.u2.chart.GaugeChart',
    'foam.u2.chart.HeatmapChart',
    'foam.u2.chart.HistogramChart',
    'foam.u2.chart.LineChart',
    'foam.u2.chart.PieChart',
    'foam.u2.chart.RadarChart',
    'foam.u2.chart.ScatterChart',
    'foam.u2.chart.TreemapChart',
    'foam.u2.chart.WaterfallChart'
  ],

  methods: [
    async function runTest(x) {
      x = x.createSubContext({ block: { value: {} } });
      await this.testBar(x);
      await this.testPie(x);
      await this.testStackedBar(x);
      await this.testLine(x);
      await this.testStackedLine(x);
      await this.testScatter(x);
      await this.testScatterEdges(x);
      await this.testBubble(x);
      await this.testBubbleEdges(x);
      await this.testCandlestick(x);
      await this.testCandlestickEdges(x);
      await this.testRadar(x);
      await this.testRadarEdges(x);
      await this.testHeatmap(x);
      await this.testHeatmapEdges(x);
      await this.testHistogram(x);
      await this.testHistogramEdges(x);
      await this.testWaterfall(x);
      await this.testWaterfallEdges(x);
      await this.testFunnel(x);
      await this.testFunnelEdges(x);
      await this.testBoxPlot(x);
      await this.testBoxPlotEdges(x);
      await this.testTreemap(x);
      await this.testTreemapEdges(x);
      await this.testGauge(x);
      await this.testGaugeEdges(x);
      this.testServerFields(x);
    },

    function testServerFields(x) {
      // A GridBy or GroupBy sink is Serializable, so a select runs it on the
      // server, in Java, and its Java put reads the grouping properties below.
      // A property with generateJava: false is missing from that Java class:
      // the radar's series field once was, and the server grouped nothing
      // while every test here, which runs in the browser, passed.
      var grid = foam.core.reflow.GridBy, group = foam.mlang.sink.GroupBy;
      var ids  = Object.keys(foam.USED).filter(function(id) {
        return /^foam\.core\.reflow\.dashboard\.Dashboard\w+Sink$/.test(id);
      });
      [ 'DashboardRadarSink', 'DashboardHeatmapSink', 'DashboardStackedBarSink', 'DashboardWaterfallSink', 'DashboardBoxPlotSink', 'DashboardCandlestickSink', 'DashboardTreemapSink', 'DashboardFunnelSink', 'DashboardGaugeSink' ].forEach(function(n) {
        x.test(ids.indexOf('foam.core.reflow.dashboard.' + n) !== -1, 'Server fields: ' + n + ' is checked');
      });
      ids.forEach(function(id) {
        var cls   = foam.lookup(id);
        var names = grid.isSubClass(cls) ? [ 'xFunc', 'yFunc', 'acc' ] : group.isSubClass(cls) ? [ 'arg1', 'arg2' ] : [];
        names.forEach(function(n) {
          var p = cls.getAxiomByName(n);
          x.test(p && p.generateJava !== false, 'Server fields: ' + id + '.' + n + ' is in the Java class, which the server groups with');
        });
      });
      // The candlestick keeps its candles in put(), which has no Java, so its sink must
      // stay in the browser: a Serializable sink would run on the server with an empty put.
      x.test(! foam.core.reflow.dashboard.DashboardCandlestickSink.getAxiomByName('implements_foam.lang.Serializable'),
        'Server fields: DashboardCandlestickSink is not Serializable, so a select never sends it to the server');
      // The box plot's collector is a Plot, which has Java: the server keeps each box's numbers in it.
      x.test(foam.mlang.sink.Plot.getAxiomByName('data').generateJava !== false && foam.mlang.sink.Plot.getAxiomByName('args').generateJava !== false,
        'Server fields: the Plot that collects a box\'s numbers is in the Java class');
      var vp = foam.core.reflow.dashboard.DashboardBoxPlotSink.getAxiomByName('valueProp');
      x.test(vp && vp.generateJava !== false, 'Server fields: DashboardBoxPlotSink.valueProp is in the Java class, which the server collects with');
      // The gauge's put adds each row to its total, so the total needs Java.
      var total = foam.core.reflow.dashboard.DashboardGaugeSink.getAxiomByName('total');
      x.test(total && total.generateJava !== false, 'Server fields: DashboardGaugeSink.total is in the Java class, which the server totals with');

      // A select sends a Serializable sink to the server and the client draws
      // the copy that comes back. A field the chart reads (a parameter of
      // chart_) and that has no Java is gone from that copy: the gauge's bands
      // once were, and the dial drew a grey track in a live flow while the
      // tests here, which never leave the browser, passed.
      var serializable = ids.filter(function(id) {
        return !! foam.lookup(id).getAxiomByName('implements_foam.lang.Serializable');
      });
      x.test(serializable.indexOf('foam.core.reflow.dashboard.DashboardGaugeSink') !== -1 && serializable.indexOf('foam.core.reflow.dashboard.DashboardPieSink') !== -1,
        'Server fields: the sinks a select sends to the server are found. Got ' + serializable.length);
      serializable.forEach(function(id) {
        var cls   = foam.lookup(id);
        var chart = cls.getAxiomByName('chart_');
        if ( ! chart || ! chart.expression ) return;
        foam.Function.argNames(chart.expression).forEach(function(n) {
          var p = cls.getAxiomByName(n);
          x.test(p && p.generateJava !== false, 'Server fields: ' + id + '.' + n + ' is read by the chart, so it is in the Java class and comes back from the server');
        });
      });
      var bands = foam.core.reflow.dashboard.DashboardGaugeSink.getAxiomByName('bands');
      x.test(bands.generateJava !== false && foam.u2.chart.GaugeBand.getAxiomByName('upTo').generateJava !== false,
        'Server fields: the gauge\'s bands and the GaugeBand they hold are in the Java class');
    },

    function candleRows(x) {
      var T = this.CandleTestRow;
      var day = function(d) { return new Date(Date.UTC(2026, 2, d)); };
      return this.ArrayDAO.create({ of: T, array: [
        // Out of time order on purpose: the chart sorts them.
        T.create({ id: 2, kind: 'b', at: new Date(2026, 2, 2, 10, 5), day: day(2), first: 13, top: 16, bottom: 7, last: 9 }),
        T.create({ id: 1, kind: 'a', at: new Date(2026, 2, 2, 10, 4), day: day(1), first: 10, top: 14, bottom: 8, last: 13 }),
        T.create({ id: 3, kind: 'c', at: new Date(2026, 2, 2, 10, 6), day: day(3), first: 9,  top: 12, bottom: 9, last: 11 })
      ] }, x);
    },

    async function testCandlestick(x) {
      var T     = this.CandleTestRow;
      var rows  = this.candleRows(x);
      var agent = this.DashboardCandlestickChartDAOAgent.create({}, x);
      var s     = agent.displaySink;
      s.timeProp  = T.AT;
      s.openProp  = T.FIRST;
      s.highProp  = T.TOP;
      s.lowProp   = T.BOTTOM;
      s.closeProp = T.LAST;
      s.timeUnit  = 'MINUTE';
      s.colors    = [ '#00aa00', '#aa0000' ];
      s.onClickScript = '(function(t, o, h, l, c, cx, cy, pageX, pageY) { globalThis.candleClick_ = [ o, h, l, c, cx, cy, pageX, pageY ].join(); })';

      var chart = ( await rows.select(agent.createSink()) ).chart_;
      x.test(this.CandlestickChart.isInstance(chart), 'Candlestick: draws a foam.u2.chart.CandlestickChart. Got ' + ( chart && chart.cls_.id ));
      var d = chart.datasets[0].data;
      x.test(d.length === 3 && d.map(function(c) { return c.open + '/' + c.high + '/' + c.low + '/' + c.close; }).join() === '10/14/8/13,13/16/7/9,9/12/9/11',
        'Candlestick: each row is one candle of its four fields, in time order. Got ' + JSON.stringify(d));
      x.test(d[0].x === new Date(2026, 2, 2, 10, 4).getTime(), 'Candlestick: the time is the row\'s time in milliseconds. Got ' + d[0].x);
      x.test(JSON.stringify(chart.datasets[0].backgroundColor) === '["#00aa00","#aa0000"]' && chart.timeUnit === chart.TimeUnit.MINUTE,
        'Candlestick: Colors (rise, fall) and Time Unit reach the chart. Got ' + JSON.stringify(chart.datasets[0].backgroundColor));
      x.test(chart.xAxisLabel === T.AT.label && chart.yAxisLabel === T.LAST.label && ! chart.utc,
        'Candlestick: with no axis titles typed the axes take the Time and Close labels, and a date-and-time reads in local time. Got ' + chart.xAxisLabel + ', ' + chart.yAxisLabel);

      var box = { getBoundingClientRect: function() { return { left: 100, top: 50 }; } };
      chart.onCandleClick(1, { target: { ownerSVGElement: box }, clientX: 130, clientY: 80, pageX: 130, pageY: 280 });
      x.test(globalThis.candleClick_ === '13,16,7,9,30,30,130,280',
        'Candlestick: On Click Script gets open, high, low, close, and the point in the chart and on the page. Got ' + globalThis.candleClick_);
      delete globalThis.candleClick_;

      // A Date field reads in UTC; no On Click Script leaves the candles not clickable; one colour leaves the fall to the theme.
      s.timeProp = T.DAY;
      s.clearProperty('onClickScript');
      s.colors = [ '#00aa00' ];
      chart = ( await rows.select(agent.createSink()) ).chart_;
      x.test(chart.utc && ! chart.onCandleClick, 'Candlestick: a Date reads in UTC, and with no On Click Script the candles are not clickable');
      x.test(chart.kindColor_(true) === '#00aa00' && chart.kindColor_(false).indexOf('$') === -1 && chart.kindColor_(false) !== '#00aa00',
        'Candlestick: one colour sets the rise and the fall keeps its resolved theme colour. Got ' + chart.kindColor_(false));

      // A select can send the sink to the server as JSON and back; the copy must still collect candles.
      var copy = foam.json.parseString(foam.json.stringify(agent.createSink()), x);
      var err  = '';
      try { await rows.select(copy); } catch ( e ) { err = e.message; }
      x.test(! err && copy.chart_.datasets[0].data.length === 3, 'Candlestick: a sink sent as JSON and back still collects all three candles. Got ' + ( err || copy.chart_.datasets[0].data.length ));
    },

    async function testCandlestickEdges(x) {
      var T     = this.CandleTestRow;
      var rows  = this.candleRows(x);
      var agent = this.DashboardCandlestickChartDAOAgent.create({}, x);
      var s     = agent.displaySink;
      s.timeProp  = T.AT;
      s.openProp  = T.FIRST;
      s.highProp  = T.TOP;
      s.lowProp   = T.BOTTOM;
      s.closeProp = T.LAST;
      s.xAxisLabel = 'Minute';
      s.yAxisLabel = 'Latency';

      var chart = ( await rows.select(agent.createSink()) ).chart_;
      x.test(chart.xAxisLabel === 'Minute' && chart.yAxisLabel === 'Latency', 'Candlestick: typed axis titles win over the field labels');

      // A text field is not a number and a number is not a date: no candle for either.
      s.openProp = T.KIND;
      var sink = await rows.select(agent.createSink());
      x.test(sink.candles_.length === 0, 'Candlestick: a text field as Open makes no candles. Got ' + sink.candles_.length);
      s.openProp = T.FIRST;
      s.timeProp = T.FIRST;
      sink = await rows.select(agent.createSink());
      x.test(sink.candles_.length === 0, 'Candlestick: a number field as Time makes no candles. Got ' + sink.candles_.length);

      // With no candles the chart says so and draws no axes.
      var el = foam.u2.Element.create({}, x);
      el.add(sink);
      el.write();
      var text = el.element_.innerText || el.element_.textContent;
      x.test(text.indexOf(sink.ChartView.NO_DATA) !== -1 && ! el.element_.querySelector('svg'),
        'Candlestick: with no candles the chart says "' + sink.ChartView.NO_DATA + '" and draws no axes. Got ' + JSON.stringify(text));
      el.remove();

      // A row with an empty field is left out: the unset Float is 0, so only a real
      // value counts; a row whose time was never set has no date.
      var T2 = this.CandleTestRow;
      var some = this.ArrayDAO.create({ of: T2, array: [
        T2.create({ id: 1, at: new Date(2026, 2, 2, 10, 4), first: 1, top: 2, bottom: 0, last: 1 }),
        T2.create({ id: 2, first: 1, top: 2, bottom: 0, last: 1 })
      ] }, x);
      s.timeProp = T.AT;
      sink = await some.select(agent.createSink());
      x.test(sink.candles_.length === 1, 'Candlestick: a row with no time is left out. Got ' + sink.candles_.length);
    },

    function rowsDAO(x) {
      var R = this.DashboardTestRow;
      return this.ArrayDAO.create({ of: R, array: [
        R.create({ id: 1, year: 2025, month: 1, amount: 10 }),
        R.create({ id: 2, year: 2025, month: 2, amount: 20 }),
        R.create({ id: 3, year: 2026, month: 1, amount: 30 }),
        R.create({ id: 4, year: 2026, month: 2, amount: 40 })
      ] }, x);
    },

    async function testBar(x) {
      var R     = this.DashboardTestRow;
      var agent = this.DashboardBarChartDAOAgent.create({}, x);
      var s     = agent.displaySink;
      s.arg1           = R.YEAR;
      s.aggregation    = this.SumDAOAgent.create({ prop: R.AMOUNT }, x);
      s.horizontal     = true;
      s.datasetLabel   = 'Amount';
      s.xAxisLabel     = 'Year';
      s.legendPosition = this.LegendPosition.RIGHT;
      s.showTooltipSum = true;
      s.colors         = [ '#ff0000' ];

      var chart = ( await this.rowsDAO(x).select(agent.createSink()) ).chart_;
      x.test(this.BarChart.isInstance(chart), 'Bar: draws a foam.u2.chart.BarChart. Got ' + ( chart && chart.cls_.id ));
      var ds = chart.datasets[0];
      x.test(chart.labels.length === 2 && ds.data.join() === '30,70', 'Bar: sums amount per year: 30 and 70. Got ' + ds.data.join());
      x.test(ds.label === 'Amount', 'Bar: Dataset Label names the legend entry');
      x.test(foam.util.equals(ds.backgroundColor, [ '#ff0000', '#ff0000' ]), 'Bar: Colors reach the bars. Got ' + JSON.stringify(ds.backgroundColor));
      x.test(chart.horizontal && ! chart.stacked, 'Bar: Horizontal Bars turns the chart on its side');
      x.test(chart.xAxisLabel === 'Year', 'Bar: X-Axis Label is the axis title');
      x.test(chart.legendPosition === this.LegendPosition.RIGHT, 'Bar: Legend Position RIGHT reaches the chart');
      x.test(chart.showTooltipSum, 'Bar: Show Tooltip Sum reaches the tooltip');
    },

    async function testPie(x) {
      var R     = this.DashboardTestRow;
      var agent = this.DashboardPieChartDAOAgent.create({}, x);
      var s     = agent.displaySink;
      s.arg1             = R.YEAR;
      s.aggregation      = this.SumDAOAgent.create({ prop: R.AMOUNT }, x);
      s.cutoutPercentage = 50;
      s.showPercentages  = true;
      s.rotation         = 90;
      s.clockwise        = false;
      s.disableLegendClick    = true;
      s.legendPosition        = this.LegendPosition.LEFT;
      s.legendMinWidthPercent = 20;
      s.legendMaxWidthPercent = 40;

      var chart = ( await this.rowsDAO(x).select(agent.createSink()) ).chart_;
      x.test(this.PieChart.isInstance(chart), 'Pie: draws a foam.u2.chart.PieChart. Got ' + ( chart && chart.cls_.id ));
      x.test(chart.datasets[0].data.join() === '30,70', 'Pie: one slice per year, 30 and 70');
      x.test(chart.cutout === 50 && chart.showPercentages && chart.rotation === 90 && ! chart.clockwise,
        'Pie: Cutout, Show Percentages, Rotation and Clockwise reach the pie');
      x.test(chart.disableLegendClick, 'Pie: Disable Legend Click reaches the legend');
      x.test(chart.legendPosition === this.LegendPosition.LEFT && chart.legendMinWidthPercent === 20 && chart.legendMaxWidthPercent === 40,
        'Pie: the legend sits left between 20% and 40% wide');
      x.test(chart.percent(1) === '70.0%', 'Pie: 2026 is 70.0% of the total. Got ' + chart.percent(1));
    },

    async function testStackedBar(x) {
      var R     = this.DashboardTestRow;
      var agent = this.DashboardStackedBarChartDAOAgent.create({}, x);
      var s     = agent.displaySink;
      // A form reads rows and cols before the fields are picked. Reading them
      // first here checks that picking the fields still rebuilds them.
      s.rows; s.cols;
      s.xFunc       = R.MONTH;
      s.yFunc       = R.YEAR;
      s.aggregation = this.SumDAOAgent.create({ prop: R.AMOUNT }, x);
      // The script reports its first three arguments: the segment's value,
      // its x label and its stack label.
      s.onClickScript = '(function(y, xv, stack) { window.dashboardChartRenderTestClick_ = [ y, String(xv), String(stack) ]; })';

      var chart = ( await this.rowsDAO(x).select(agent.createSink()) ).chart_;
      x.test(this.BarChart.isInstance(chart) && chart.stacked, 'StackedBar: draws a stacked foam.u2.chart.BarChart');
      x.test(chart.datasets.length === 2 && chart.labels.length === 2, 'StackedBar: two months, one stack per year');

      // Find the 2026 stack and the February column, then click that segment.
      var di = chart.datasets.findIndex(function(d) { return String(d.label) === '2026'; });
      var i  = chart.labels.findIndex(function(l) { return String(l) === '2'; });
      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      var hit = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      svg.appendChild(hit);
      document.body.appendChild(svg);
      chart.onBarClick(di, i, { target: hit, clientX: 0, clientY: 0, pageX: 0, pageY: 0 });
      svg.remove();
      var got = window.dashboardChartRenderTestClick_;
      delete window.dashboardChartRenderTestClick_;
      x.test(JSON.stringify(got) === '[40,"2","2026"]',
        'StackedBar: On Click Script gets (value, x label, stack label) of the clicked segment: 40, February, 2026. Got ' + JSON.stringify(got));

      s.onClickScript = '';
      chart = ( await this.rowsDAO(x).select(agent.createSink()) ).chart_;
      x.test(! chart.onBarClick, 'StackedBar: with no On Click Script the bars are not clickable');
    },

    async function testLine(x) {
      var R     = this.DashboardTestRow;
      var agent = this.DashboardLineChartDAOAgent.create({}, x);
      var s     = agent.displaySink;
      s.arg1        = R.MONTH;
      s.aggregation = this.SumDAOAgent.create({ prop: R.AMOUNT }, x);
      s.fill        = true;
      s.stepped     = true;
      s.showPoints  = false;
      s.toggleCustomYScale = true;
      s.yAxisMinScale      = 0;
      s.yAxisMaxScale      = 100;

      var chart = ( await this.rowsDAO(x).select(agent.createSink()) ).chart_;
      x.test(this.LineChart.isInstance(chart), 'Line: draws a foam.u2.chart.LineChart. Got ' + ( chart && chart.cls_.id ));
      var ds = chart.datasets[0];
      var ys = ds.data.map(function(p) { return p.y; }).join();
      x.test(ys === '40,60', 'Line: sums amount per month, 40 and 60. Got ' + ys);
      x.test(ds.fill && ds.stepped && ds.pointRadius === 0, 'Line: Fill Area, Stepped Line and Show Points off reach the line');
      x.test(chart.yMin === 0 && chart.yMax === 100, 'Line: a custom y scale sets the axis to 0..100. Got ' + chart.yMin + '..' + chart.yMax);
      x.test(chart.xAxisLabel === R.MONTH.label, 'Line: with no X-Axis Label the axis is titled with the field\'s label');
    },

    async function testStackedLine(x) {
      // One line per year over the months. 2026 has no row for month 2, so
      // its line has no value there.
      var R   = this.DashboardTestRow;
      var dao = this.ArrayDAO.create({ of: R, array: [
        R.create({ id: 1, year: 2025, month: 1, amount: 10 }),
        R.create({ id: 2, year: 2025, month: 2, amount: 20 }),
        R.create({ id: 3, year: 2026, month: 1, amount: 30 })
      ] }, x);
      var agent = this.DashboardLineChartDAOAgent.create({}, x);
      var s     = agent.displaySink;
      s.arg1        = R.MONTH;
      s.yFunc       = R.YEAR;
      s.aggregation = this.SumDAOAgent.create({ prop: R.AMOUNT }, x);

      var sink = await dao.select(agent.createSink());
      x.test(sink.chart_.stacked === false, 'Stacked line: off unless the form switch is on, as every flow saved before it');

      agent.displaySink.stacked = true;
      var chart = ( await dao.select(agent.createSink()) ).chart_;
      var sets  = chart.datasets.map(function(d) { return d.label + '=' + d.data.map(function(p) { return p.y; }).join(':'); }).join();
      x.test(this.LineChart.isInstance(chart) && chart.stacked, 'Stacked line: the Stacked switch reaches the line chart. Got ' + ( chart && chart.cls_.id ));
      x.test(sets === '2025=10:20,2026=30:0', 'Stacked line: each line keeps its own values, a missing one is 0. Got ' + sets);

      // A saved flow keeps the switch; one saved before has none and loads off.
      var back = foam.json.parseString(foam.json.stringify(agent), x);
      x.test(back.displaySink.stacked === true, 'Stacked line: a saved flow keeps the Stacked switch');
      agent.displaySink.clearProperty('stacked');
      var old = foam.json.parseString(foam.json.stringify(agent), x);
      x.test(old.displaySink.stacked === false, 'Stacked line: a flow saved without the switch loads and draws as before');
      agent.displaySink.stacked = true;

      // A select can send the sink to the server as JSON and back.
      var copy = foam.json.parseString(foam.json.stringify(agent.createSink()), x);
      copy.clearProperty('aggregation');
      var err = '';
      try { await dao.select(copy); } catch ( e ) { err = e.message; }
      x.test(! err && copy.chart_ && copy.chart_.stacked, 'Stacked line: a sink sent as JSON and back still stacks. Got ' + ( err || ( copy.chart_ && copy.chart_.stacked ) ));
    },

    function radarRows(x) {
      var T = this.RadarTestRow;
      return this.ArrayDAO.create({ of: T, array: [
        T.create({ id: 1, kind: 'GET',  day: 'Mon', hits: 10, ms: 100 }),
        T.create({ id: 2, kind: 'GET',  day: 'Mon', hits: 30, ms: 300 }),
        T.create({ id: 3, kind: 'POST', day: 'Mon', hits: 5,  ms: 50 }),
        T.create({ id: 4, kind: 'GET',  day: 'Tue', hits: 20, ms: 200 }),
        // No kind: it belongs to no spoke.
        T.create({ id: 5, kind: '',     day: 'Tue', hits: 99, ms: 999 }),
        // No day: it belongs to no polygon when a Series Property is picked.
        T.create({ id: 6, kind: 'POST', day: '',    hits: 7,  ms: 150 })
      ] }, x);
    },

    async function testRadar(x) {
      var T     = this.RadarTestRow;
      var agent = this.DashboardRadarChartDAOAgent.create({}, x);
      var s     = agent.displaySink;
      s.xFunc       = T.KIND;
      s.yFunc       = T.DAY;
      s.aggregation = this.SumDAOAgent.create({ prop: T.HITS }, x);
      s.colors      = [ '#ff0000' ];
      s.legendPosition = this.LegendPosition.LEFT;
      s.showTooltipSum = true;
      s.animate        = false;
      // The script reports its first three arguments: the corner's value, its spoke and its polygon.
      s.onClickScript = '(function(v, spoke, series, cx, cy, pageX, pageY) { globalThis.radarClick_ = [ v, spoke, series, cx, cy, pageX, pageY ].join(); })';

      var chart = ( await this.radarRows(x).select(agent.createSink()) ).chart_;
      x.test(this.RadarChart.isInstance(chart), 'Radar: draws a foam.u2.chart.RadarChart. Got ' + ( chart && chart.cls_.id ));
      x.test(chart.labels.join() === 'GET,POST', 'Radar: one spoke per kind; the row with no kind is left out. Got ' + chart.labels.join());
      var sets = chart.datasets.map(function(d) { return d.label + '=' + d.data.join(':'); }).join();
      x.test(sets === 'Mon=40:5,Tue=20:0', 'Radar: Series Property gives one polygon per day with the Sum of hits per kind, and the row with no day is left out. Got ' + sets);
      x.test(chart.datasets[0].backgroundColor === '#ff0000' && chart.datasets[1].backgroundColor === '#ff0000', 'Radar: Colors reach the polygons, in turn');
      x.test(chart.legendPosition === this.LegendPosition.LEFT && chart.showTooltipSum && ! chart.animate, 'Radar: Legend Position, Tooltip Sum and Animation reach the chart');

      var box = { getBoundingClientRect: function() { return { left: 100, top: 50 }; } };
      chart.onPointClick(1, 0, { target: { ownerSVGElement: box }, clientX: 130, clientY: 80, pageX: 130, pageY: 280 });
      x.test(globalThis.radarClick_ === '20,GET,Tue,30,30,130,280',
        'Radar: On Click Script gets value, spoke, polygon, the point in the chart and on the page. Got ' + globalThis.radarClick_);
      delete globalThis.radarClick_;

      // With no Series Property every row lands in one polygon, and Count is the default total.
      s.clearProperty('yFunc');
      s.clearProperty('aggregation');
      s.onClickScript = '';
      chart = ( await this.radarRows(x).select(agent.createSink()) ).chart_;
      sets = chart.datasets.map(function(d) { return d.label + '=' + d.data.join(':'); }).join();
      x.test(sets === s.DEFAULT_SERIES + '=3:2', 'Radar: with no Series Property one polygon counts the rows per kind (the row with no day included). Got ' + sets);
      x.test(! chart.onPointClick, 'Radar: with no On Click Script the corners are not clickable');

      // An Average total is the mean per spoke, not a sum of per-row values.
      s.aggregation = this.AvgDAOAgent.create({ prop: T.MS }, x);
      chart = ( await this.radarRows(x).select(agent.createSink()) ).chart_;
      x.test(chart.datasets[0].data.join() === '200,100', 'Radar: Average of ms per kind is 200 and 100. Got ' + chart.datasets[0].data.join());

      // The agent's own form is untouched by a run: a second run does not count twice.
      chart = ( await this.radarRows(x).select(agent.createSink()) ).chart_;
      x.test(chart.datasets[0].data.join() === '200,100', 'Radar: a second run from the same agent gives the same values. Got ' + chart.datasets[0].data.join());

      // A select can send the sink to the server as JSON and back. The copy
      // must still collect every row.
      var copy = foam.json.parseString(foam.json.stringify(agent.createSink()), x);
      // The server's copy has no aggregation (its Java class lacks the field), so the value's name must come from the total.
      copy.clearProperty('aggregation');
      var err  = '';
      try { await this.radarRows(x).select(copy); } catch ( e ) { err = e.message; }
      var got = copy.chart_ && copy.chart_.datasets.length ? copy.chart_.datasets[0].data.join() : '';
      x.test(! err && got === '200,100', 'Radar: a sink sent as JSON and back still collects every row. Got ' + ( err || got ));
    },

    async function testRadarEdges(x) {
      var T     = this.RadarTestRow;
      var agent = this.DashboardRadarChartDAOAgent.create({}, x);
      var s     = agent.displaySink;
      s.xFunc = T.KIND;

      // A saved flow holds the form as displaySink: { ... } and nothing else.
      var back = foam.json.parseString(foam.json.stringify(agent), x);
      x.test(back.displaySink.xFunc && back.displaySink.xFunc.name === 'kind',
        'Radar: a saved agent keeps the Category Property in its displaySink');

      // No rows: no spokes, and a message in place of the chart.
      var empty = foam.u2.Element.create({}, x);
      var none  = await this.ArrayDAO.create({ of: T, array: [] }, x).select(agent.createSink());
      x.test(none.chart_.labels.length === 0, 'Radar: with no rows there are no spokes');
      empty.add(none);
      empty.write();
      var text = empty.element_.innerText || empty.element_.textContent;
      x.test(text.indexOf(none.ChartView.NO_DATA) !== -1 && ! empty.element_.querySelector('svg'),
        'Radar: with no rows the chart says "' + none.ChartView.NO_DATA + '" and draws no spokes. Got ' + JSON.stringify(text));
      empty.remove();

      s.emptyValueMessage = 'Nothing yet';
      none = await this.ArrayDAO.create({ of: T, array: [] }, x).select(agent.createSink());
      empty = foam.u2.Element.create({}, x);
      empty.add(none);
      empty.write();
      x.test(( empty.element_.innerText || empty.element_.textContent ).indexOf('Nothing yet') !== -1, 'Radar: Empty Message replaces the default text');
      empty.remove();

      // Rows only with a category and no series: the chart draws.
      var drawn = await this.radarRows(x).select(agent.createSink());
      var el    = foam.u2.Element.create({}, x);
      el.add(drawn);
      el.write();
      x.test(!! el.element_.querySelector('.' + drawn.chart_.myClass()) && ! el.element_.querySelector('.' + drawn.cls_.id.replace(/\./g, '-') + '-empty'),
        'Radar: with rows the chart is added in place of the message');
      el.remove();
    },

    function boxRows(x) {
      var T = this.BoxPlotTestRow;
      return this.ArrayDAO.create({ of: T, array: [
        T.create({ id: 1,  kind: 'GET',  day: 'Mon', ms: 10 }),
        T.create({ id: 2,  kind: 'GET',  day: 'Mon', ms: 12 }),
        T.create({ id: 3,  kind: 'GET',  day: 'Tue', ms: 14 }),
        T.create({ id: 4,  kind: 'GET',  day: 'Tue', ms: 16 }),
        T.create({ id: 5,  kind: 'GET',  day: 'Mon', ms: 100 }),
        T.create({ id: 6,  kind: 'POST', day: 'Mon', ms: 20 }),
        T.create({ id: 7,  kind: 'POST', day: 'Tue', ms: 22 }),
        // No kind: it belongs to no box.
        T.create({ id: 8,  kind: '',     day: 'Mon', ms: 999 }),
        // No day: it belongs to no series when a Series Property is picked.
        T.create({ id: 9,  kind: 'GET',  day: '',    ms: 7 })
      ] }, x);
    },

    async function testFunnel(x) {
      var R     = this.DashboardTestRow;
      var agent = this.DashboardFunnelChartDAOAgent.create({}, x);
      var s     = agent.displaySink;
      s.arg1        = R.YEAR;
      s.aggregation = this.SumDAOAgent.create({ prop: R.AMOUNT }, x);
      s.colors      = [ '#00aa00', '#aa0000', '#0000aa' ];
      s.legendPosition = this.LegendPosition.RIGHT;
      // The script reports its arguments: the step's value, its label and the x of the click.
      s.onClickScript = '(function(v, label, cx, cy, px, py) { globalThis.funnelClick_ = [ v, label, cx, cy, px, py ].join(); })';

      var chart = ( await this.rowsDAO(x).select(agent.createSink()) ).chart_;
      x.test(this.FunnelChart.isInstance(chart), 'Funnel: draws a foam.u2.chart.FunnelChart. Got ' + ( chart && chart.cls_.id ));
      x.test(chart.labels.join() === '2025,2026' && chart.datasets[0].data.join() === '30,70',
        'Funnel: sums the amounts per year as the steps, in the field\'s order. Got ' + chart.labels.join() + ' / ' + chart.datasets[0].data.join());
      x.test(foam.util.equals(chart.datasets[0].backgroundColor, [ '#00aa00', '#aa0000', '#0000aa' ]),
        'Funnel: the colours reach the chart. Got ' + JSON.stringify(chart.datasets[0].backgroundColor));
      x.test(chart.legendPosition === this.LegendPosition.RIGHT, 'Funnel: Legend Position reaches the chart');

      var box = { getBoundingClientRect: function() { return { left: 100, top: 50 }; } };
      var evt = { target: { ownerSVGElement: box }, clientX: 130, clientY: 80, pageX: 130, pageY: 280 };
      chart.onStepClick(1, evt);
      x.test(globalThis.funnelClick_ === '70,2026,30,30,130,280',
        'Funnel: On Click Script gets the value, label, and the point in the chart and on the page. Got ' + globalThis.funnelClick_);
      delete globalThis.funnelClick_;

      // Sort By Value: the largest step first.
      s.sortByValue = true;
      chart = ( await this.rowsDAO(x).select(agent.createSink()) ).chart_;
      x.test(chart.labels.join() === '2026,2025' && chart.datasets[0].data.join() === '70,30',
        'Funnel: Sort By Value puts the largest step first. Got ' + chart.labels.join() + ' / ' + chart.datasets[0].data.join());

      // With no aggregation picked the form shows Count, so each step counts its rows.
      s.clearProperty('aggregation');
      s.sortByValue = false;
      chart = ( await this.rowsDAO(x).select(agent.createSink()) ).chart_;
      x.test(chart.datasets[0].data.join() === '2,2', 'Funnel: with no Aggregation each step counts its rows. Got ' + chart.datasets[0].data.join());

      s.onClickScript = '';
      chart = ( await this.rowsDAO(x).select(agent.createSink()) ).chart_;
      x.test(! chart.onStepClick, 'Funnel: with no On Click Script the bands are not clickable');

      // A select can send the sink to the server as JSON and back; the copy must still group and sort.
      s.aggregation = this.SumDAOAgent.create({ prop: R.AMOUNT }, x);
      s.sortByValue = true;
      var copy = foam.json.parseString(foam.json.stringify(agent.createSink()), x);
      // The server's copy has no aggregation (its Java class lacks the field), so the value's name must come from the total.
      copy.clearProperty('aggregation');
      var err  = '';
      try { await this.rowsDAO(x).select(copy); } catch ( e ) { err = e.message; }
      x.test(! err && copy.sortByValue && copy.chart_.labels.join() === '2026,2025',
        'Funnel: a sink sent as JSON and back still groups and keeps its order. Got ' + ( err || copy.chart_.labels.join() ));
    },

    async function testFunnelEdges(x) {
      var T = this.ScatterTestRow;
      var rows = this.ArrayDAO.create({ of: T, array: [
        T.create({ id: 1, kind: 'GET',  size: 10 }),
        T.create({ id: 2, kind: 'POST', size: 4 }),
        T.create({ id: 3, kind: '',     size: 30 }),
        T.create({ id: 4, kind: 'GET',  size: 5 })
      ] }, x);
      var agent = this.DashboardFunnelChartDAOAgent.create({}, x);
      var s     = agent.displaySink;
      s.aggregation = this.SumDAOAgent.create({ prop: T.SIZE }, x);

      // A row with no kind is left out, not drawn as a step called "".
      s.arg1 = T.KIND;
      var chart = ( await rows.select(agent.createSink()) ).chart_;
      x.test(chart.labels.join() === 'GET,POST' && chart.datasets[0].data.join() === '15,4',
        'Funnel: a row with no value in Group By adds no step. Got ' + chart.labels.join() + ' / ' + chart.datasets[0].data.join());

      // No rows: a message in place of an empty chart.
      var none = this.ArrayDAO.create({ of: T, array: [] }, x);
      var sink = await none.select(agent.createSink());
      var el   = foam.u2.Element.create({}, x);
      el.add(sink);
      el.write();
      var text = el.element_.innerText || el.element_.textContent;
      x.test(text.indexOf(sink.ChartView.NO_DATA) !== -1 && ! el.element_.querySelector('svg'),
        'Funnel: with no rows the chart says "' + sink.ChartView.NO_DATA + '". Got ' + JSON.stringify(text));
      el.remove();
    },

    async function testBoxPlot(x) {
      var T     = this.BoxPlotTestRow;
      var agent = this.DashboardBoxPlotChartDAOAgent.create({}, x);
      var s     = agent.displaySink;
      s.xFunc      = T.KIND;
      s.valueProp  = T.MS;
      s.xAxisLabel = 'Endpoint';
      s.colors     = [ '#ff0000' ];

      var chart = ( await this.boxRows(x).select(agent.createSink()) ).chart_;
      x.test(this.BoxPlotChart.isInstance(chart), 'BoxPlot: draws a foam.u2.chart.BoxPlotChart. Got ' + ( chart && chart.cls_.id ));
      x.test(chart.labels.join() === 'GET,POST', 'BoxPlot: one category per kind, the row with no kind left out. Got ' + chart.labels.join());
      x.test(chart.datasets.length === 1 && chart.datasets[0].label === T.MS.label,
        'BoxPlot: with no Series Property all rows are one dataset, named after the value property\'s label. Got ' + chart.datasets.map(function(d) { return d.label; }).join());
      var get = chart.datasets[0].data[0].slice().sort(function(a, b) { return a - b; }).join();
      x.test(get === '7,10,12,14,16,100', 'BoxPlot: GET collects the six numbers of its rows. Got ' + get);
      x.test(chart.datasets[0].data[1].length === 2, 'BoxPlot: POST collects its two numbers');
      // A cached select is keyed by the sink's text, so two Plots over different values must not print alike.
      var plotA = foam.mlang.sink.Plot.create({ args: [ T.MS ] }).toString();
      var plotB = foam.mlang.sink.Plot.create({ args: [ T.ID ] }).toString();
      x.test(plotA !== plotB && plotA.indexOf('ms') !== -1,
        'Plot: two Plots over different properties give different text. Got ' + plotA + ' and ' + plotB);
      x.test(chart.datasets[0].backgroundColor === '#ff0000' && chart.xAxisLabel === 'Endpoint', 'BoxPlot: Colors and X-Axis Label reach the chart');
      x.test(chart.yAxisLabel === T.MS.label, 'BoxPlot: with no Y-Axis Label the value axis takes its field\'s label. Got ' + chart.yAxisLabel);

      // A Series Property gives one dataset per day; a row with no day is left out.
      s.yFunc = T.DAY;
      chart = ( await this.boxRows(x).select(agent.createSink()) ).chart_;
      x.test(chart.datasets.map(function(d) { return d.label; }).join() === 'Mon,Tue', 'BoxPlot: Series Property gives one dataset per day. Got ' + chart.datasets.map(function(d) { return d.label; }).join());
      x.test(chart.datasets[1].data.map(function(d) { return d.join(); }).join(';') === '14,16;22', 'BoxPlot: Tue holds 14 and 16 for GET, 22 for POST. Got ' + chart.datasets[1].data.map(function(d) { return d.join(); }).join(';'));
      s.clearProperty('yFunc');

      // A select can send the sink to the server as JSON and back. The copy
      // must keep every number of every box through the trip.
      var copy = foam.json.parseString(foam.json.stringify(agent.createSink()), x);
      // The server's copy has no aggregation (its Java class lacks the field), so the value's name must come from the total.
      copy.clearProperty('aggregation');
      var err  = '';
      try { await this.boxRows(x).select(copy); } catch ( e ) { err = e.message; }
      var n = copy.chart_ && copy.chart_.datasets.length ? copy.chart_.datasets[0].data.map(function(d) { return d.length; }).join() : '';
      x.test(! err && n === '6,2', 'BoxPlot: a sink sent as JSON and back still collects the numbers of each box. Got ' + ( err || n ));
    },

    async function testBoxPlotEdges(x) {
      var T     = this.BoxPlotTestRow;
      var agent = this.DashboardBoxPlotChartDAOAgent.create({}, x);
      var s     = agent.displaySink;
      s.xFunc     = T.KIND;
      s.valueProp = T.MS;

      // A saved flow holds the form as displaySink: { ... } and nothing else.
      var back = foam.json.parseString(foam.json.stringify(agent), x);
      x.test(back.displaySink.xFunc && back.displaySink.xFunc.name === 'kind' && back.displaySink.valueProp.name === 'ms',
        'BoxPlot: a saved agent keeps the Category and Value Properties in its displaySink');

      s.onClickScript = '(function(median, cat, series, cx, cy, pageX, pageY) { globalThis.boxClick_ = [ median, cat, series, cx, cy, pageX, pageY ].join(); })';
      var chart = ( await this.boxRows(x).select(agent.createSink()) ).chart_;
      var box = { getBoundingClientRect: function() { return { left: 100, top: 50 }; } };
      chart.onBoxClick(0, 1, { target: { ownerSVGElement: box }, clientX: 130, clientY: 80, pageX: 130, pageY: 280 });
      x.test(globalThis.boxClick_ === '21,POST,' + T.MS.label + ',30,30,130,280',
        'BoxPlot: On Click Script gets the median, category, series, the point in the chart and on the page. Got ' + globalThis.boxClick_);
      delete globalThis.boxClick_;
      s.clearProperty('onClickScript');

      // No rows: no categories, and a message in place of the chart.
      var empty = foam.u2.Element.create({}, x);
      var none  = await this.ArrayDAO.create({ of: T, array: [] }, x).select(agent.createSink());
      x.test(none.chart_.labels.length === 0, 'BoxPlot: with no rows there are no categories');
      empty.add(none);
      empty.write();
      var text = empty.element_.innerText || empty.element_.textContent;
      x.test(text.indexOf(none.ChartView.NO_DATA) !== -1 && ! empty.element_.querySelector('svg'),
        'BoxPlot: with no rows the chart says "' + none.ChartView.NO_DATA + '" and draws no axes. Got ' + JSON.stringify(text));
      empty.remove();

      s.emptyValueMessage = 'Nothing yet';
      none  = await this.ArrayDAO.create({ of: T, array: [] }, x).select(agent.createSink());
      empty = foam.u2.Element.create({}, x);
      empty.add(none);
      empty.write();
      x.test(( empty.element_.innerText || empty.element_.textContent ).indexOf('Nothing yet') !== -1, 'BoxPlot: Empty Message replaces the default text');
      empty.remove();
      s.clearProperty('emptyValueMessage');

      // A date is not a number: no box is drawn, and the message shows.
      s.valueProp = T.WHEN;
      var rows = this.ArrayDAO.create({ of: T, array: [ T.create({ id: 1, kind: 'GET', when: new Date(Date.UTC(2026, 0, 1)) }) ] }, x);
      var sink = await rows.select(agent.createSink());
      x.test(sink.chart_.labels.length === 0, 'BoxPlot: a date value makes no box. Got ' + sink.chart_.labels.join());
      s.valueProp = T.MS;

      // Rows with a category: the chart is added in place of the message.
      var drawn = await this.boxRows(x).select(agent.createSink());
      var el    = foam.u2.Element.create({}, x);
      el.add(drawn);
      el.write();
      x.test(!! el.element_.querySelector('.' + drawn.chart_.myClass()) && ! el.element_.querySelector('.' + drawn.cls_.id.replace(/\./g, '-') + '-empty'),
        'BoxPlot: with rows the chart is added in place of the message');
      el.remove();
    },

    async function testGauge(x) {
      var R     = this.DashboardTestRow;
      var agent = this.DashboardGaugeChartDAOAgent.create({}, x);
      var s     = agent.displaySink;
      s.aggregation     = this.SumDAOAgent.create({ prop: R.AMOUNT }, x);
      s.maxValue        = 200;
      s.bands           = [ { upTo: 50, color: '#ff0000' }, { upTo: 100, color: '#00ff00' } ];
      s.showLegend      = true;
      s.legendPosition  = this.LegendPosition.BOTTOM;
      s.showTooltips    = false;
      s.animate         = false;
      // The script reports its arguments: the value, then the point in the chart and on the page.
      s.onClickScript   = '(function(value, cx, cy, pageX, pageY) { globalThis.gaugeClick_ = [ value, cx, cy, pageX, pageY ].join(); })';

      var chart = ( await this.rowsDAO(x).select(agent.createSink()) ).chart_;
      x.test(this.GaugeChart.isInstance(chart), 'Gauge: draws a foam.u2.chart.GaugeChart. Got ' + ( chart && chart.cls_.id ));
      x.test(chart.datasets[0].data.join() === '100', 'Gauge: sums amount over every row: 100. Got ' + chart.datasets[0].data.join());
      x.test(chart.datasets[0].label === R.AMOUNT.label, 'Gauge: the value is named after its field. Got ' + chart.datasets[0].label);
      x.test(chart.max === 200 && chart.min === 0, 'Gauge: Maximum is the right end of the dial, which starts at 0');
      x.test(chart.bands.length === 2 && chart.bands[1].upTo === 100 && chart.bands[1].color === '#00ff00', 'Gauge: Bands reach the chart as GaugeBands');
      x.test(chart.showLegend && chart.legendPosition === this.LegendPosition.BOTTOM && ! chart.showTooltips && ! chart.animate,
        'Gauge: Show Legend, Legend Position, Show Tooltips and Enable Animation reach the chart');
      x.test(chart.legendItems().length === 2, 'Gauge: the legend lists the two bands');

      // The sink's text is the key a client DAO caches the select under, so a total over another field must not print alike.
      var other = this.DashboardGaugeChartDAOAgent.create({}, x);
      other.displaySink.aggregation = this.SumDAOAgent.create({ prop: R.YEAR }, x);
      var textA = agent.createSink().toString();
      var textB = other.createSink().toString();
      var textC = this.DashboardGaugeChartDAOAgent.create({}, x).createSink().toString();
      x.test(textA !== textB && textA !== textC && textA.indexOf('amount') !== -1, 'Gauge: sinks over different totals give different text. Got ' + textA + ' | ' + textB + ' | ' + textC);

      // A select can send the sink to the server as JSON and back; the total must survive the trip.
      var copy = foam.json.parseString(foam.json.stringify(agent.createSink()), x);
      // The server's copy has no aggregation (its Java class lacks the field), so the value's name must come from the total.
      copy.clearProperty('aggregation');
      var err  = '';
      try { await this.rowsDAO(x).select(copy); } catch ( e ) { err = e.message; }
      var got = copy.chart_ && copy.chart_.datasets.length ? copy.chart_.datasets[0].data.join() : '';
      x.test(! err && got === '100', 'Gauge: a sink sent as JSON and back still totals the rows. Got ' + ( err || got ));
      x.test(copy.bands.length === 2 && copy.bands[0].upTo === 50 && copy.bands[1].color === '#00ff00' && copy.chart_.bands.length === 2,
        'Gauge: a sink sent as JSON and back still has its bands. Got ' + copy.bands.length);
      x.test(copy.chart_.datasets[0].label === R.AMOUNT.label, 'Gauge: the value is still named after its field, which the total holds. Got ' + copy.chart_.datasets[0].label);

      // A saved flow holds the form as displaySink: { ... } and nothing else.
      var back = foam.json.parseString(foam.json.stringify(agent), x);
      x.test(back.displaySink.maxValue === 200 && back.displaySink.bands.length === 2 && back.displaySink.bands[0].upTo === 50,
        'Gauge: a saved agent keeps Maximum and Bands in its displaySink');

      var box = { getBoundingClientRect: function() { return { left: 100, top: 50 }; } };
      chart.onValueClick({ target: { ownerSVGElement: box }, clientX: 130, clientY: 80, pageX: 130, pageY: 280 });
      x.test(globalThis.gaugeClick_ === '100,30,30,130,280', 'Gauge: On Click Script gets the value, the point in the chart and on the page. Got ' + globalThis.gaugeClick_);
      delete globalThis.gaugeClick_;

      // With no aggregation picked the value is a Count, named "Value".
      var counted = this.DashboardGaugeChartDAOAgent.create({}, x);
      chart = ( await this.rowsDAO(x).select(counted.createSink()) ).chart_;
      x.test(chart.datasets[0].data.join() === '4' && chart.datasets[0].label === counted.displaySink.DEFAULT_SERIES,
        'Gauge: with no aggregation the value is the count of rows, 4, named "Value". Got ' + chart.datasets[0].data.join() + ' ' + chart.datasets[0].label);
    },

    async function testGaugeEdges(x) {
      var R     = this.DashboardTestRow;
      var agent = this.DashboardGaugeChartDAOAgent.create({}, x);
      var s     = agent.displaySink;
      s.aggregation = this.MaxDAOAgent.create({ prop: R.AMOUNT }, x);
      var sink = await this.rowsDAO(x).select(agent.createSink());
      x.test(sink.chart_.datasets[0].data.join() === '40', 'Gauge: Max of amount is 40. Got ' + sink.chart_.datasets[0].data.join());

      // A value that is not a number (the Min of no rows) draws no dial: the message shows in its place.
      s.aggregation = this.MinDAOAgent.create({ prop: R.AMOUNT }, x);
      var none  = await this.ArrayDAO.create({ of: R, array: [] }, x).select(agent.createSink());
      var empty = foam.u2.Element.create({}, x);
      empty.add(none);
      empty.write();
      var text = empty.element_.innerText || empty.element_.textContent;
      x.test(none.chart_.datasets[0].data[0] === null && text.indexOf(none.ChartView.NO_DATA) !== -1 && ! empty.element_.querySelector('svg'),
        'Gauge: with no number the chart says "' + none.ChartView.NO_DATA + '" and draws no dial. Got ' + JSON.stringify(text) + ' ' + JSON.stringify(none.chart_.datasets[0].data));
      empty.remove();

      s.emptyValueMessage = 'Nothing yet';
      none  = await this.ArrayDAO.create({ of: R, array: [] }, x).select(agent.createSink());
      empty = foam.u2.Element.create({}, x);
      empty.add(none);
      empty.write();
      x.test(( empty.element_.innerText || empty.element_.textContent ).indexOf('Nothing yet') !== -1, 'Gauge: Empty Message replaces the default text');
      empty.remove();
      s.clearProperty('emptyValueMessage');

      // Rows: the chart is added in place of the message.
      var drawn = await this.rowsDAO(x).select(agent.createSink());
      var el    = foam.u2.Element.create({}, x);
      el.add(drawn);
      el.write();
      x.test(!! el.element_.querySelector('.' + drawn.chart_.myClass()) && ! el.element_.querySelector('.' + drawn.cls_.id.replace(/\./g, '-') + '-empty'),
        'Gauge: with a number the chart is added in place of the message');
      el.remove();

      // The legend is off by default: one value needs none.
      x.test(! this.DashboardGaugeChartDAOAgent.create({}, x).displaySink.showLegend, 'Gauge: the legend is off by default');
    },

    async function testScatter(x) {
      var R     = this.DashboardTestRow;
      var agent = this.DashboardScatterChartDAOAgent.create({}, x);
      var s     = agent.displaySink;
      s.xProp      = R.MONTH;
      s.yProp      = R.AMOUNT;
      s.seriesProp = R.YEAR;
      s.xAxisLabel = 'Month';
      s.colors     = [ '#ff0000' ];

      var chart = ( await this.rowsDAO(x).select(agent.createSink()) ).chart_;
      x.test(this.ScatterChart.isInstance(chart), 'Scatter: draws a foam.u2.chart.ScatterChart. Got ' + ( chart && chart.cls_.id ));
      var labels = chart.datasets.map(function(d) { return d.label; }).join();
      x.test(labels === '2025,2026', 'Scatter: Series Property gives one dataset per year. Got ' + labels);
      var pts = chart.datasets[1].data.map(function(p) { return p.x + ':' + p.y; }).join();
      x.test(pts === '1:30,2:40', 'Scatter: each row is one { x, y } point. Got ' + pts);
      x.test(chart.datasets[1].backgroundColor === '#ff0000' && chart.xAxisLabel === 'Month', 'Scatter: Colors and X-Axis Label reach the chart');

      // With no Series Property every row lands in one dataset.
      s.clearProperty('seriesProp');
      chart = ( await this.rowsDAO(x).select(agent.createSink()) ).chart_;
      x.test(chart.datasets.length === 1 && chart.datasets[0].data.length === 4, 'Scatter: with no Series Property all four rows are one dataset');

      // A select can send the sink to the server as JSON and back. The copy
      // must still collect points: it once kept them in a JS Map, which came
      // back as {} and failed on the first put.
      var copy = foam.json.parseString(foam.json.stringify(agent.createSink()), x);
      // The server's copy has no aggregation (its Java class lacks the field), so the value's name must come from the total.
      copy.clearProperty('aggregation');
      var err  = '';
      try { await this.rowsDAO(x).select(copy); } catch ( e ) { err = e.message; }
      var n = copy.chart_ && copy.chart_.datasets.length ? copy.chart_.datasets[0].data.length : 0;
      x.test(! err && n === 4, 'Scatter: a sink sent as JSON and back still collects all four rows. Got ' + ( err || n ));
    },

    async function testScatterEdges(x) {
      var T    = this.ScatterTestRow;
      var rows = this.ArrayDAO.create({ of: T, array: [
        T.create({ id: 1, kind: 'GET',  size: 10, time: 1.5, when: new Date(Date.UTC(2026, 0, 1)) }),
        T.create({ id: 2, kind: '',     size: 20, time: 2.5 }),
        T.create({ id: 3, kind: 'POST', size: 30, time: 3.5 })
      ] }, x);
      var agent = this.DashboardScatterChartDAOAgent.create({}, x);
      var s     = agent.displaySink;
      s.xProp      = T.SIZE;
      s.yProp      = T.TIME;
      s.seriesProp = T.KIND;
      s.onClickScript = '(function(px, py, series, cx, cy, pageX, pageY) { globalThis.scatterClick_ = [ px, py, series, cx, cy, pageX, pageY ].join(); })';

      var sink  = await rows.select(agent.createSink());
      var chart = sink.chart_;
      var labels = chart.datasets.map(function(d) { return d.label; }).join();
      x.test(labels === 'GET,POST', 'Scatter: a row with an empty Series value is left out, not drawn as "undefined". Got ' + labels);
      x.test(chart.xAxisLabel === T.SIZE.label && chart.yAxisLabel === T.TIME.label,
        'Scatter: with no axis titles typed, each axis takes its field\'s label. Got ' + chart.xAxisLabel + ', ' + chart.yAxisLabel);

      var box = { getBoundingClientRect: function() { return { left: 100, top: 50 }; } };
      chart.onPointClick(1, 0, { target: { ownerSVGElement: box }, clientX: 130, clientY: 80, pageX: 130, pageY: 280 });
      x.test(globalThis.scatterClick_ === '30,3.5,POST,30,30,130,280',
        'Scatter: On Click Script gets x, y, series, the point in the chart and on the page. Got ' + globalThis.scatterClick_);
      delete globalThis.scatterClick_;

      // A date field is not a number: no point is drawn, and the sink shows
      // its empty message instead of empty axes.
      s.xProp = T.WHEN;
      s.clearProperty('seriesProp');
      sink = await rows.select(agent.createSink());
      x.test(sink.series_.length === 0, 'Scatter: a date field makes no points. Got ' + sink.series_.length + ' series');
      var el = foam.u2.Element.create({}, x);
      el.add(sink);
      el.write();
      var text = el.element_.innerText || el.element_.textContent;
      x.test(text.indexOf(sink.ChartView.NO_DATA) !== -1 && ! el.element_.querySelector('svg'),
        'Scatter: with no points the chart says "' + sink.ChartView.NO_DATA + '" and draws no axes. Got ' + JSON.stringify(text));
      el.remove();
    },

    async function testBubble(x) {
      var R     = this.DashboardTestRow;
      var agent = this.DashboardBubbleChartDAOAgent.create({}, x);
      var s     = agent.displaySink;
      s.xProp      = R.MONTH;
      s.yProp      = R.AMOUNT;
      s.sizeProp   = R.YEAR;
      s.seriesProp = R.YEAR;
      s.xAxisLabel = 'Month';
      s.sizeLabel  = 'Year';
      s.colors     = [ '#ff0000' ];

      var chart = ( await this.rowsDAO(x).select(agent.createSink()) ).chart_;
      x.test(this.BubbleChart.isInstance(chart), 'Bubble: draws a foam.u2.chart.BubbleChart. Got ' + ( chart && chart.cls_.id ));
      var labels = chart.datasets.map(function(d) { return d.label; }).join();
      x.test(labels === '2025,2026', 'Bubble: Series Property gives one dataset per year. Got ' + labels);
      var pts = chart.datasets[1].data.map(function(p) { return p.x + ':' + p.y + ':' + p.r; }).join();
      x.test(pts === '1:30:2026,2:40:2026', 'Bubble: each row is one { x, y, r } point. Got ' + pts);
      x.test(chart.datasets[1].backgroundColor === '#ff0000' && chart.xAxisLabel === 'Month' && chart.sizeLabel === 'Year',
        'Bubble: Colors, X-Axis Label and Size Label reach the chart');

      s.clearProperty('seriesProp');
      chart = ( await this.rowsDAO(x).select(agent.createSink()) ).chart_;
      x.test(chart.datasets.length === 1 && chart.datasets[0].data.length === 4, 'Bubble: with no Series Property all four rows are one dataset');

      var copy = foam.json.parseString(foam.json.stringify(agent.createSink()), x);
      // The server's copy has no aggregation (its Java class lacks the field), so the value's name must come from the total.
      copy.clearProperty('aggregation');
      var err  = '';
      try { await this.rowsDAO(x).select(copy); } catch ( e ) { err = e.message; }
      var n = copy.chart_ && copy.chart_.datasets.length ? copy.chart_.datasets[0].data.length : 0;
      x.test(! err && n === 4 && copy.chart_.datasets[0].data[0].r === 2025, 'Bubble: a sink sent as JSON and back still collects all four rows with their size. Got ' + ( err || n ));
    },

    async function testBubbleEdges(x) {
      var T    = this.ScatterTestRow;
      var rows = this.ArrayDAO.create({ of: T, array: [
        T.create({ id: 1, kind: 'GET',  size: 10, time: 1.5, when: new Date(Date.UTC(2026, 0, 1)) }),
        T.create({ id: 2, kind: '',     size: 20, time: 2.5 }),
        T.create({ id: 3, kind: 'POST', size: 30, time: 3.5 })
      ] }, x);
      var agent = this.DashboardBubbleChartDAOAgent.create({}, x);
      var s     = agent.displaySink;
      s.xProp      = T.SIZE;
      s.yProp      = T.TIME;
      s.sizeProp   = T.ID;
      s.seriesProp = T.KIND;
      s.onClickScript = '(function(px, py, r, series, cx, cy, pageX, pageY) { globalThis.bubbleClick_ = [ px, py, r, series, cx, cy, pageX, pageY ].join(); })';

      var sink  = await rows.select(agent.createSink());
      var chart = sink.chart_;
      var labels = chart.datasets.map(function(d) { return d.label; }).join();
      x.test(labels === 'GET,POST', 'Bubble: a row with an empty Series value is left out. Got ' + labels);
      x.test(chart.xAxisLabel === T.SIZE.label && chart.yAxisLabel === T.TIME.label && chart.sizeLabel === T.ID.label,
        'Bubble: with no titles typed, each axis and the size take their field\'s label. Got ' + chart.xAxisLabel + ', ' + chart.yAxisLabel + ', ' + chart.sizeLabel);

      var box = { getBoundingClientRect: function() { return { left: 100, top: 50 }; } };
      chart.onPointClick(1, 0, { target: { ownerSVGElement: box }, clientX: 130, clientY: 80, pageX: 130, pageY: 280 });
      x.test(globalThis.bubbleClick_ === '30,3.5,3,POST,30,30,130,280',
        'Bubble: On Click Script gets x, y, size, series, the point in the chart and on the page. Got ' + globalThis.bubbleClick_);
      delete globalThis.bubbleClick_;

      // A date Size Property is not a number: no bubble is drawn, and the
      // sink shows its empty message instead of empty axes.
      s.sizeProp = T.WHEN;
      s.clearProperty('seriesProp');
      sink = await rows.select(agent.createSink());
      x.test(sink.series_.length === 0, 'Bubble: a date Size Property makes no points. Got ' + sink.series_.length + ' series');
      var el = foam.u2.Element.create({}, x);
      el.add(sink);
      el.write();
      var text = el.element_.innerText || el.element_.textContent;
      x.test(text.indexOf(sink.ChartView.NO_DATA) !== -1 && ! el.element_.querySelector('svg'),
        'Bubble: with no points the chart says "' + sink.ChartView.NO_DATA + '" and draws no axes. Got ' + JSON.stringify(text));
      el.remove();
    },

    async function testHistogram(x) {
      var R     = this.DashboardTestRow;
      var agent = this.DashboardHistogramChartDAOAgent.create({}, x);
      var s     = agent.displaySink;
      s.valueProp  = R.AMOUNT;
      s.seriesProp = R.YEAR;
      s.binCount   = 6;
      s.colors     = [ '#ff0000' ];
      s.onClickScript = '(function(lo, hi, n, series, cx, cy, pageX, pageY) { globalThis.histogramClick_ = [ lo, hi, n, series, cx, cy, pageX, pageY ].join(); })';

      var chart = ( await this.rowsDAO(x).select(agent.createSink()) ).chart_;
      x.test(this.HistogramChart.isInstance(chart), 'Histogram: draws a foam.u2.chart.HistogramChart. Got ' + ( chart && chart.cls_.id ));
      var labels = chart.datasets.map(function(d) { return d.label; }).join();
      x.test(labels === '2025,2026', 'Histogram: Series Property gives one dataset per year. Got ' + labels);
      x.test(chart.datasets[1].data.join() === '30,40', 'Histogram: each row adds its value. Got ' + chart.datasets[1].data.join());
      x.test(chart.datasets[1].backgroundColor === '#ff0000' && chart.binCount === 6, 'Histogram: Colors and Number of Bins reach the chart');
      x.test(chart.xAxisLabel === R.AMOUNT.label && chart.yAxisLabel === 'Count',
        'Histogram: with no axis titles typed, x is the field\'s label and y is "Count". Got ' + chart.xAxisLabel + ', ' + chart.yAxisLabel);

      // 10 to 40 in 6 bins is a step of 5; 2026's 30 is the only value in 30 to 35.
      var box = { getBoundingClientRect: function() { return { left: 100, top: 50 }; } };
      chart.onBinClick(1, 4, { target: { ownerSVGElement: box }, clientX: 130, clientY: 80, pageX: 130, pageY: 280 });
      x.test(globalThis.histogramClick_ === '30,35,1,2026,30,30,130,280',
        'Histogram: On Click Script gets the bin range, its count, the series, the point in the chart and on the page. Got ' + globalThis.histogramClick_);
      delete globalThis.histogramClick_;

      // With no Series Property every row lands in one dataset.
      s.clearProperty('seriesProp');
      chart = ( await this.rowsDAO(x).select(agent.createSink()) ).chart_;
      x.test(chart.datasets.length === 1 && chart.datasets[0].data.length === 4, 'Histogram: with no Series Property all four rows are one dataset');
      x.test(chart.datasets[0].label === R.AMOUNT.label,
        'Histogram: the one legend entry is named after the value property\'s label. Got ' + chart.datasets[0].label);

      // A select can send the sink to the server as JSON and back. The copy
      // must still collect values: a JS Map would come back as {}.
      var copy = foam.json.parseString(foam.json.stringify(agent.createSink()), x);
      // The server's copy has no aggregation (its Java class lacks the field), so the value's name must come from the total.
      copy.clearProperty('aggregation');
      var err  = '';
      try { await this.rowsDAO(x).select(copy); } catch ( e ) { err = e.message; }
      var n = copy.chart_ && copy.chart_.datasets.length ? copy.chart_.datasets[0].data.length : 0;
      x.test(! err && n === 4, 'Histogram: a sink sent as JSON and back still collects all four rows. Got ' + ( err || n ));
    },

    async function testHistogramEdges(x) {
      var T    = this.ScatterTestRow;
      var rows = this.ArrayDAO.create({ of: T, array: [
        T.create({ id: 1, kind: 'GET',  size: 10, when: new Date(Date.UTC(2026, 0, 1)) }),
        T.create({ id: 2, kind: '',     size: 20 }),
        T.create({ id: 3, kind: 'POST', size: 30 })
      ] }, x);
      var agent = this.DashboardHistogramChartDAOAgent.create({}, x);
      var s     = agent.displaySink;
      s.valueProp  = T.SIZE;
      s.seriesProp = T.KIND;

      var sink   = await rows.select(agent.createSink());
      var labels = sink.chart_.datasets.map(function(d) { return d.label; }).join();
      x.test(labels === 'GET,POST', 'Histogram: a row with an empty Series value is left out, not drawn as "undefined". Got ' + labels);

      // A date field is not a number: no value is kept, and the sink shows
      // its empty message instead of empty axes.
      s.valueProp = T.WHEN;
      s.clearProperty('seriesProp');
      sink = await rows.select(agent.createSink());
      x.test(sink.series_.length === 0, 'Histogram: a date field makes no values. Got ' + sink.series_.length + ' series');
      var el = foam.u2.Element.create({}, x);
      el.add(sink);
      el.write();
      var text = el.element_.innerText || el.element_.textContent;
      x.test(text.indexOf(sink.ChartView.NO_DATA) !== -1 && ! el.element_.querySelector('svg'),
        'Histogram: with no values the chart says "' + sink.ChartView.NO_DATA + '" and draws no axes. Got ' + JSON.stringify(text));
      el.remove();
    },

    async function testHeatmap(x) {
      var R     = this.DashboardTestRow;
      var agent = this.DashboardHeatmapChartDAOAgent.create({}, x);
      var s     = agent.displaySink;
      // A form reads rows and cols before the fields are picked. Reading them
      // first here checks that picking the fields still rebuilds them.
      s.rows; s.cols;
      s.xFunc       = R.MONTH;
      s.yFunc       = R.YEAR;
      s.aggregation = this.SumDAOAgent.create({ prop: R.AMOUNT }, x);
      s.colors      = [ '#ff0000' ];
      s.xAxisLabel  = 'Month';
      s.showValues  = true;
      s.legendPosition = this.LegendPosition.RIGHT;
      // The script reports its first three arguments: the cell's value, its
      // column name and its row name.
      s.onClickScript = '(function(v, xl, yl, cx, cy, px, py) { globalThis.heatmapClick_ = [ v, xl, yl, cx, cy, px, py ].join(); })';

      var chart = ( await this.rowsDAO(x).select(agent.createSink()) ).chart_;
      x.test(this.HeatmapChart.isInstance(chart), 'Heatmap: draws a foam.u2.chart.HeatmapChart. Got ' + ( chart && chart.cls_.id ));
      var y25 = '2025', y26 = '2026';
      x.test(chart.labels.join() === '1,2', 'Heatmap: X Axis gives one column per month. Got ' + chart.labels.join());
      x.test(chart.datasets.map(function(d) { return d.label; }).join() === y25 + ',' + y26, 'Heatmap: Y Axis gives one row per year. Got ' + chart.datasets.map(function(d) { return d.label; }).join());
      x.test(chart.datasets[0].data.join() === '10,20' && chart.datasets[1].data.join() === '30,40',
        'Heatmap: each cell sums the amounts of its month and year. Got ' + chart.datasets.map(function(d) { return d.data.join(); }).join(' / '));
      x.test(chart.datasets[0].backgroundColor === '#ff0000', 'Heatmap: the first colour is the strong end of the scale. Got ' + chart.datasets[0].backgroundColor);
      x.test(chart.xAxisLabel === 'Month' && chart.yAxisLabel === R.YEAR.label,
        'Heatmap: a typed X-Axis Label is used, and with none typed the axis takes the field\'s label. Got ' + chart.xAxisLabel + ', ' + chart.yAxisLabel);
      x.test(chart.showValues && chart.legendPosition === this.LegendPosition.RIGHT, 'Heatmap: Show Values and Legend Position reach the chart');

      var box = { getBoundingClientRect: function() { return { left: 100, top: 50 }; } };
      chart.onCellClick(1, 0, { target: { ownerSVGElement: box }, clientX: 130, clientY: 80, pageX: 130, pageY: 280 });
      x.test(globalThis.heatmapClick_ === '20,2,' + y25 + ',30,30,130,280',
        'Heatmap: On Click Script gets the value, column and row names, the point in the chart and on the page. Got ' + globalThis.heatmapClick_);
      delete globalThis.heatmapClick_;

      // With no aggregation picked the form shows Count, so each cell counts its rows.
      s.clearProperty('aggregation');
      chart = ( await this.rowsDAO(x).select(agent.createSink()) ).chart_;
      x.test(chart.datasets[0].data.join() === '1,1', 'Heatmap: with no Aggregation each cell counts its rows. Got ' + chart.datasets[0].data.join());

      s.onClickScript = '';
      chart = ( await this.rowsDAO(x).select(agent.createSink()) ).chart_;
      x.test(! chart.onCellClick, 'Heatmap: with no On Click Script the cells are not clickable');

      // A select can send the sink to the server as JSON and back; the copy must still fill the grid.
      var copy = foam.json.parseString(foam.json.stringify(agent.createSink()), x);
      // The server's copy has no aggregation (its Java class lacks the field), so the value's name must come from the total.
      copy.clearProperty('aggregation');
      var err  = '';
      try { await this.rowsDAO(x).select(copy); } catch ( e ) { err = e.message; }
      var n = copy.chart_ && copy.chart_.datasets.length ? copy.chart_.datasets[0].data.length : 0;
      x.test(! err && n === 2, 'Heatmap: a sink sent as JSON and back still fills the grid. Got ' + ( err || n ));
    },

    async function testHeatmapEdges(x) {
      var T = this.ScatterTestRow;
      var at = function(day, hour) { return new Date(2026, 0, day, hour, 30); };
      var rows = this.ArrayDAO.create({ of: T, array: [
        T.create({ id: 1, kind: 'GET',  size: 10, when: at(1, 9),  at: at(1, 9) }),
        T.create({ id: 2, kind: 'GET',  size: 20, when: at(1, 14), at: at(1, 14) }),
        T.create({ id: 3, kind: 'POST', size: 10, when: at(2, 9),  at: at(2, 9) })
      ] }, x);
      var agent = this.DashboardHeatmapChartDAOAgent.create({}, x);
      var s     = agent.displaySink;
      s.xFunc = T.SIZE;
      s.yFunc = T.KIND;

      var sink  = await rows.select(agent.createSink());
      var chart = sink.chart_;
      x.test(chart.datasets.map(function(d) { return d.label + ':' + d.data.join('|'); }).join() === 'GET:1|1,POST:1|',
        'Heatmap: a pair with no rows is null, an empty cell and not a zero. Got ' + chart.datasets.map(function(d) { return d.label + ':' + d.data.join('|'); }).join());
      x.test(chart.datasets[1].data[1] === null, 'Heatmap: the empty cell holds null');
      x.test(chart.xAxisLabel === T.SIZE.label && chart.yAxisLabel === T.KIND.label,
        'Heatmap: with no axis titles typed, each axis takes its field\'s label. Got ' + chart.xAxisLabel + ', ' + chart.yAxisLabel);

      // The hour of a date, as the bar and line charts offer.
      s.xFunc = foam.mlang.expr.DateToHHExpr.create({ arg1: T.AT, delegate: T.AT });
      chart = ( await rows.select(agent.createSink()) ).chart_;
      x.test(chart.labels.join() === '09,14', 'Heatmap: a date expression such as the hour gives the columns. Got ' + chart.labels.join());
      x.test(chart.datasets.map(function(d) { return d.data.join('|'); }).join() === '1|1,1|', 'Heatmap: requests per hour for each kind. Got ' + chart.datasets.map(function(d) { return d.data.join('|'); }).join());

      // A date field is labelled as the bar charts label it.
      s.xFunc = T.WHEN;
      chart = ( await rows.select(agent.createSink()) ).chart_;
      x.test(chart.labels.length === 2 && chart.labels.every(function(l) { return /^\d{4}-\d\d-\d\d$/.test(l); }),
        'Heatmap: a date field gives one column per date value, labelled YYYY-MM-DD. Got ' + chart.labels.join());

      // A row with no value in X or Y is left out, not drawn as a "null" or
      // blank column or row, and a date field with no value does not throw.
      var gappy = this.ArrayDAO.create({ of: T, array: [
        T.create({ id: 1, kind: 'GET', size: 10, when: at(1, 9) }),
        T.create({ id: 2, kind: '',    size: 10, when: at(1, 9) }),
        T.create({ id: 3, kind: 'GET', size: 10 })
      ] }, x);
      s.xFunc = T.WHEN;
      s.yFunc = T.KIND;
      var err = null;
      try {
        chart = ( await gappy.select(agent.createSink()) ).chart_;
      } catch ( e ) { err = e; }
      x.test(! err && chart.labels.length === 1 && chart.datasets.map(function(d) { return d.label; }).join() === 'GET',
        'Heatmap: a row with no kind, and one with no date, add no row or column. Got ' + ( err || chart.labels.join() + ' / ' + chart.datasets.map(function(d) { return d.label; }).join() ));

      // No rows: a message in place of empty axes.
      var none = this.ArrayDAO.create({ of: T, array: [] }, x);
      s.xFunc  = T.SIZE;
      s.yFunc  = T.KIND;
      sink = await none.select(agent.createSink());
      var el = foam.u2.Element.create({}, x);
      el.add(sink);
      el.write();
      var text = el.element_.innerText || el.element_.textContent;
      x.test(text.indexOf(sink.ChartView.NO_DATA) !== -1 && ! el.element_.querySelector('svg'),
        'Heatmap: with no rows the chart says "' + sink.ChartView.NO_DATA + '" and draws no axes. Got ' + JSON.stringify(text));
      el.remove();
    },

    async function testTreemap(x) {
      var R     = this.DashboardTestRow;
      var agent = this.DashboardTreemapChartDAOAgent.create({}, x);
      var s     = agent.displaySink;
      s.arg1        = R.YEAR;
      s.aggregation = this.SumDAOAgent.create({ prop: R.AMOUNT }, x);
      s.colors      = [ '#ff0000', '#00ff00' ];
      s.legendPosition = this.LegendPosition.RIGHT;
      // The script reports its first four arguments: the rectangle's value,
      // its label, the sum of every rectangle and the x of the click.
      s.onClickScript = '(function(v, label, total, cx, cy, px, py) { globalThis.treemapClick_ = [ v, label, total, cx, cy, px, py ].join(); })';

      var chart = ( await this.rowsDAO(x).select(agent.createSink()) ).chart_;
      x.test(this.TreemapChart.isInstance(chart), 'Treemap: draws a foam.u2.chart.TreemapChart. Got ' + ( chart && chart.cls_.id ));
      x.test(chart.labels.join() === '2026,2025' && chart.datasets[0].data.join() === '70,30',
        'Treemap: sums the amounts per year, biggest first. Got ' + chart.labels.join() + ' / ' + chart.datasets[0].data.join());
      x.test(foam.util.equals(chart.datasets[0].backgroundColor, [ '#ff0000', '#00ff00' ]),
        'Treemap: Colors reach the rectangles. Got ' + JSON.stringify(chart.datasets[0].backgroundColor));
      x.test(chart.legendPosition === this.LegendPosition.RIGHT, 'Treemap: Legend Position reaches the chart');

      var box = { getBoundingClientRect: function() { return { left: 100, top: 50 }; } };
      var evt = { target: { ownerSVGElement: box }, clientX: 130, clientY: 80, pageX: 130, pageY: 280 };
      chart.onRectClick(1, evt);
      x.test(globalThis.treemapClick_ === '30,2025,100,30,30,130,280',
        'Treemap: On Click Script gets the value, label, total, and the point in the chart and on the page. Got ' + globalThis.treemapClick_);
      delete globalThis.treemapClick_;

      // Top N 1 keeps the biggest year and folds the other into "Others".
      s.topN = 1;
      chart = ( await this.rowsDAO(x).select(agent.createSink()) ).chart_;
      x.test(chart.labels.join() === '2026,Others' && chart.datasets[0].data.join() === '70,30',
        'Treemap: Top N 1 gives the biggest year and an Others rectangle. Got ' + chart.labels.join() + ' / ' + chart.datasets[0].data.join());

      // With no aggregation picked the form shows Count, so each rectangle counts its rows.
      s.topN = 0;
      s.clearProperty('aggregation');
      chart = ( await this.rowsDAO(x).select(agent.createSink()) ).chart_;
      x.test(chart.datasets[0].data.join() === '2,2', 'Treemap: with no Aggregation each rectangle counts its rows. Got ' + chart.datasets[0].data.join());

      s.onClickScript = '';
      chart = ( await this.rowsDAO(x).select(agent.createSink()) ).chart_;
      x.test(! chart.onRectClick, 'Treemap: with no On Click Script the rectangles are not clickable');

      // A select can send the sink to the server as JSON and back; the copy must still group.
      s.aggregation = this.SumDAOAgent.create({ prop: R.AMOUNT }, x);
      s.topN = 1;
      var copy = foam.json.parseString(foam.json.stringify(agent.createSink()), x);
      // The server's copy has no aggregation (its Java class lacks the field), so the value's name must come from the total.
      copy.clearProperty('aggregation');
      var err  = '';
      try { await this.rowsDAO(x).select(copy); } catch ( e ) { err = e.message; }
      x.test(! err && copy.topN === 1 && copy.chart_.labels.join() === '2026,Others',
        'Treemap: a sink sent as JSON and back still groups and keeps Top N. Got ' + ( err || copy.chart_.labels.join() ));
    },

    async function testTreemapEdges(x) {
      var T = this.ScatterTestRow;
      var rows = this.ArrayDAO.create({ of: T, array: [
        T.create({ id: 1, kind: 'GET',  size: 10 }),
        T.create({ id: 2, kind: 'POST', size: 10 }),
        T.create({ id: 3, kind: 'GET',  size: 20 }),
        T.create({ id: 4, kind: '',     size: 30 })
      ] }, x);
      var agent = this.DashboardTreemapChartDAOAgent.create({}, x);
      var s     = agent.displaySink;
      s.arg1        = T.KIND;
      s.aggregation = this.SumDAOAgent.create({ prop: T.SIZE }, x);

      // A row with no kind is left out, not drawn as a rectangle called "".
      var chart = ( await rows.select(agent.createSink()) ).chart_;
      x.test(chart.labels.join() === 'GET,POST' && chart.datasets[0].data.join() === '30,10',
        'Treemap: a row with no value in Group By adds no rectangle. Got ' + chart.labels.join() + ' / ' + chart.datasets[0].data.join());

      // No rows: a message in place of an empty plot.
      var none = this.ArrayDAO.create({ of: T, array: [] }, x);
      var sink = await none.select(agent.createSink());
      var el   = foam.u2.Element.create({}, x);
      el.add(sink);
      el.write();
      var text = el.element_.innerText || el.element_.textContent;
      x.test(text.indexOf(sink.ChartView.NO_DATA) !== -1 && ! el.element_.querySelector('svg'),
        'Treemap: with no rows the chart says "' + sink.ChartView.NO_DATA + '" and draws nothing. Got ' + JSON.stringify(text));
      el.remove();
    },

    async function testWaterfall(x) {
      var R     = this.DashboardTestRow;
      var agent = this.DashboardWaterfallChartDAOAgent.create({}, x);
      var s     = agent.displaySink;
      s.arg1        = R.YEAR;
      s.aggregation = this.SumDAOAgent.create({ prop: R.AMOUNT }, x);
      s.colors      = [ '#00aa00', '#aa0000', '#0000aa' ];
      s.xAxisLabel  = 'Year';
      s.legendPosition = this.LegendPosition.RIGHT;
      // The script reports its first four arguments: the step's change, its
      // label, the running total after it and the x of the click.
      s.onClickScript = '(function(v, label, total, cx, cy, px, py) { globalThis.waterfallClick_ = [ v, label, total, cx, cy, px, py ].join(); })';

      var chart = ( await this.rowsDAO(x).select(agent.createSink()) ).chart_;
      x.test(this.WaterfallChart.isInstance(chart), 'Waterfall: draws a foam.u2.chart.WaterfallChart. Got ' + ( chart && chart.cls_.id ));
      x.test(chart.labels.join() === '2025,2026' && chart.datasets[0].data.join() === '30,70',
        'Waterfall: sums the amounts per year as the steps, in year order. Got ' + chart.labels.join() + ' / ' + chart.datasets[0].data.join());
      x.test(foam.util.equals(chart.datasets[0].backgroundColor, [ '#00aa00', '#aa0000', '#0000aa' ]),
        'Waterfall: the first three colours are the rise, fall and total colours. Got ' + JSON.stringify(chart.datasets[0].backgroundColor));
      x.test(chart.xAxisLabel === 'Year' && chart.showTotal && chart.legendPosition === this.LegendPosition.RIGHT,
        'Waterfall: X-Axis Label, Show Total and Legend Position reach the chart');

      var box = { getBoundingClientRect: function() { return { left: 100, top: 50 }; } };
      var evt = { target: { ownerSVGElement: box }, clientX: 130, clientY: 80, pageX: 130, pageY: 280 };
      chart.onStepClick(1, evt);
      x.test(globalThis.waterfallClick_ === '70,2026,100,30,30,130,280',
        'Waterfall: On Click Script gets the change, label, running total, and the point in the chart and on the page. Got ' + globalThis.waterfallClick_);
      chart.onStepClick(2, evt);
      x.test(globalThis.waterfallClick_ === '100,' + chart.TOTAL + ',100,30,30,130,280',
        'Waterfall: a click on the total bar gets the end total. Got ' + globalThis.waterfallClick_);
      delete globalThis.waterfallClick_;

      // Change From Previous: the first group counts from zero, then each group less the one before.
      s.changeFromPrevious = true;
      s.showTotal          = false;
      chart = ( await this.rowsDAO(x).select(agent.createSink()) ).chart_;
      x.test(chart.datasets[0].data.join() === '30,40' && ! chart.showTotal,
        'Waterfall: Change From Previous plots 30 then 70 - 30 = 40, and Show Total reaches the chart. Got ' + chart.datasets[0].data.join());

      // With no aggregation picked the form shows Count, so each step counts rows.
      s.clearProperty('aggregation');
      s.changeFromPrevious = false;
      chart = ( await this.rowsDAO(x).select(agent.createSink()) ).chart_;
      x.test(chart.datasets[0].data.join() === '2,2', 'Waterfall: with no Aggregation each step counts its rows. Got ' + chart.datasets[0].data.join());

      s.onClickScript = '';
      chart = ( await this.rowsDAO(x).select(agent.createSink()) ).chart_;
      x.test(! chart.onStepClick, 'Waterfall: with no On Click Script the bars are not clickable');

      // A select can send the sink to the server as JSON and back; the copy must still group.
      s.aggregation = this.SumDAOAgent.create({ prop: R.AMOUNT }, x);
      s.changeFromPrevious = true;
      var copy = foam.json.parseString(foam.json.stringify(agent.createSink()), x);
      // The server's copy has no aggregation (its Java class lacks the field), so the value's name must come from the total.
      copy.clearProperty('aggregation');
      var err  = '';
      try { await this.rowsDAO(x).select(copy); } catch ( e ) { err = e.message; }
      x.test(! err && copy.changeFromPrevious && copy.chart_.datasets[0].data.join() === '30,40',
        'Waterfall: a sink sent as JSON and back still groups and keeps its mode. Got ' + ( err || copy.chart_.datasets[0].data.join() ));
    },

    async function testWaterfallEdges(x) {
      var T  = this.ScatterTestRow;
      var at = function(hour) { return new Date(2026, 0, 1, hour, 30); };
      var rows = this.ArrayDAO.create({ of: T, array: [
        T.create({ id: 1, kind: 'GET',  size: 10, at: at(16) }),
        T.create({ id: 2, kind: 'POST', size: 10, at: at(9) }),
        T.create({ id: 3, kind: 'GET',  size: 5,  at: at(14) }),
        T.create({ id: 4, kind: '',     size: 30, at: at(9) }),
        T.create({ id: 5, kind: 'GET',  size: 15, at: at(16) })
      ] }, x);
      var agent = this.DashboardWaterfallChartDAOAgent.create({}, x);
      var s     = agent.displaySink;
      s.aggregation = this.SumDAOAgent.create({ prop: T.SIZE }, x);

      // Hour of a date: requests that never go negative still show rises and falls.
      s.arg1 = foam.mlang.expr.DateToHHExpr.create({ delegate: T.AT });
      var chart = ( await rows.select(agent.createSink()) ).chart_;
      x.test(chart.labels.join() === '09,14,16' && chart.datasets[0].data.join() === '40,5,25',
        'Waterfall: the hours come in order, each summing its sizes. Got ' + chart.labels.join() + ' / ' + chart.datasets[0].data.join());
      s.changeFromPrevious = true;
      chart = ( await rows.select(agent.createSink()) ).chart_;
      x.test(chart.datasets[0].data.join() === '40,-35,20',
        'Waterfall: Change From Previous turns 40, 5, 25 into +40, a fall of 35 and a rise of 20. Got ' + chart.datasets[0].data.join());
      x.test(chart.xAxisLabel === T.AT.label, 'Waterfall: with no X-Axis Label the axis takes the field\'s label. Got ' + chart.xAxisLabel);

      // A row with no kind is left out, not drawn as a step called "".
      s.arg1 = T.KIND;
      s.changeFromPrevious = false;
      chart = ( await rows.select(agent.createSink()) ).chart_;
      x.test(chart.labels.join() === 'GET,POST' && chart.datasets[0].data.join() === '30,10',
        'Waterfall: a row with no value in Group By adds no step. Got ' + chart.labels.join() + ' / ' + chart.datasets[0].data.join());

      // No rows: a message in place of empty axes.
      var none = this.ArrayDAO.create({ of: T, array: [] }, x);
      var sink = await none.select(agent.createSink());
      var el   = foam.u2.Element.create({}, x);
      el.add(sink);
      el.write();
      var text = el.element_.innerText || el.element_.textContent;
      x.test(text.indexOf(sink.ChartView.NO_DATA) !== -1 && ! el.element_.querySelector('svg'),
        'Waterfall: with no rows the chart says "' + sink.ChartView.NO_DATA + '" and draws no axes. Got ' + JSON.stringify(text));
      el.remove();
    }
  ]
});
