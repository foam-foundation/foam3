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
foam.CLASS({
  package: 'foam.core.reflow.dashboard.test',
  name: 'DashboardChartRenderTest',
  extends: 'foam.core.test.JSTest',

  requires: [
    'foam.core.reflow.dashboard.DashboardBarChartDAOAgent',
    'foam.core.reflow.dashboard.DashboardLineChartDAOAgent',
    'foam.core.reflow.dashboard.DashboardPieChartDAOAgent',
    'foam.core.reflow.dashboard.DashboardStackedBarChartDAOAgent',
    'foam.u2.chart.LegendPosition',
    'foam.core.reflow.dashboard.test.DashboardTestRow',
    'foam.core.reflow.SumDAOAgent',
    'foam.dao.ArrayDAO',
    'foam.u2.chart.BarChart',
    'foam.u2.chart.LineChart',
    'foam.u2.chart.PieChart'
  ],

  methods: [
    async function runTest(x) {
      x = x.createSubContext({ block: { value: {} } });
      await this.testBar(x);
      await this.testPie(x);
      await this.testStackedBar(x);
      await this.testLine(x);
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
      var ds = chart.data.datasets[0];
      x.test(chart.data.labels.length === 2 && ds.data.join() === '30,70', 'Bar: sums amount per year: 30 and 70. Got ' + ds.data.join());
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
      x.test(chart.data.datasets[0].data.join() === '30,70', 'Pie: one slice per year, 30 and 70');
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
      x.test(chart.data.datasets.length === 2 && chart.data.labels.length === 2, 'StackedBar: two months, one stack per year');

      // Find the 2026 stack and the February column, then click that segment.
      var di = chart.data.datasets.findIndex(function(d) { return String(d.label) === '2026'; });
      var i  = chart.data.labels.findIndex(function(l) { return String(l) === '2'; });
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
      var ds = chart.data.datasets[0];
      var ys = ds.data.map(function(p) { return p.y; }).join();
      x.test(ys === '40,60', 'Line: sums amount per month, 40 and 60. Got ' + ys);
      x.test(ds.fill && ds.stepped && ds.pointRadius === 0, 'Line: Fill Area, Stepped Line and Show Points off reach the line');
      x.test(chart.yMin === 0 && chart.yMax === 100, 'Line: a custom y scale sets the axis to 0..100. Got ' + chart.yMin + '..' + chart.yMax);
      x.test(chart.xAxisLabel === R.MONTH.label, 'Line: with no X-Axis Label the axis is titled with the field\'s label');
    }
  ]
});
