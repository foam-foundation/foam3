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
    { class: 'Date',   name: 'when' }
  ]
});

foam.CLASS({
  package: 'foam.core.reflow.dashboard.test',
  name: 'DashboardChartRenderTest',
  extends: 'foam.core.test.JSTest',

  requires: [
    'foam.core.reflow.dashboard.DashboardBarChartDAOAgent',
    'foam.core.reflow.dashboard.DashboardBubbleChartDAOAgent',
    'foam.core.reflow.dashboard.DashboardLineChartDAOAgent',
    'foam.core.reflow.dashboard.DashboardPieChartDAOAgent',
    'foam.core.reflow.dashboard.DashboardScatterChartDAOAgent',
    'foam.core.reflow.dashboard.DashboardStackedBarChartDAOAgent',
    'foam.u2.chart.LegendPosition',
    'foam.core.reflow.dashboard.test.DashboardTestRow',
    'foam.core.reflow.dashboard.test.ScatterTestRow',
    'foam.core.reflow.SumDAOAgent',
    'foam.dao.ArrayDAO',
    'foam.u2.chart.BarChart',
    'foam.u2.chart.BubbleChart',
    'foam.u2.chart.LineChart',
    'foam.u2.chart.PieChart',
    'foam.u2.chart.ScatterChart'
  ],

  methods: [
    async function runTest(x) {
      x = x.createSubContext({ block: { value: {} } });
      await this.testBar(x);
      await this.testPie(x);
      await this.testStackedBar(x);
      await this.testLine(x);
      await this.testScatter(x);
      await this.testScatterEdges(x);
      await this.testBubble(x);
      await this.testBubbleEdges(x);
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
      x.test(text.indexOf(sink.NO_DATA) !== -1 && ! el.element_.querySelector('svg'),
        'Scatter: with no points the chart says "' + sink.NO_DATA + '" and draws no axes. Got ' + JSON.stringify(text));
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
      x.test(text.indexOf(sink.NO_DATA) !== -1 && ! el.element_.querySelector('svg'),
        'Bubble: with no points the chart says "' + sink.NO_DATA + '" and draws no axes. Got ' + JSON.stringify(text));
      el.remove();
    }
  ]
});
