/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.dashboard.test',
  name: 'DashboardAgentShimTest',
  extends: 'foam.core.test.JSTest',

  requires: [
    'foam.core.reflow.dashboard.DashboardBarChartDAOAgent',
    'foam.core.reflow.dashboard.DashboardPieChartDAOAgent',
    'foam.core.reflow.dashboard.DashboardStackedBarChartDAOAgent',
    'foam.core.reflow.dashboard.DashboardLineChartDAOAgent',
    'foam.core.reflow.dashboard.DashboardCalendarChartDAOAgent'
  ],

  methods: [
    async function runTest(x) {
      await this.testBar(x);
      await this.testPie(x);
      await this.testStackedBar(x);
      await this.testLine(x);
      await this.testCalendar(x);
    },

    async function testBar(x) {
      var a = this.DashboardBarChartDAOAgent.create({
        horizontal: true, barThickness: 15, xAxisLabel: 'X', yAxisLabel: 'Y',
        showGridLines: false, colors: ['$a','$b'], alignment: 'LEFT',
        maintainAspectRatio: true, height: 250, showLegend: false,
        legendPosition: 'BOTTOM', showTooltips: false, showTooltipSum: true,
        animate: false, animationDuration: 200, periodCount: 6
      }, x);
      x.test(a.displaySink != null, 'Bar displaySink auto-created');
      x.test(a.displaySink && a.displaySink.horizontal === true, 'Bar.horizontal forwarded');
      x.test(a.displaySink && a.displaySink.barThickness === 15, 'Bar.barThickness forwarded');
      x.test(a.displaySink && a.displaySink.xAxisLabel === 'X', 'Bar.xAxisLabel forwarded');
      x.test(a.displaySink && a.displaySink.yAxisLabel === 'Y', 'Bar.yAxisLabel forwarded');
      x.test(a.displaySink && a.displaySink.showGridLines === false, 'Bar.showGridLines forwarded');
      x.test(a.displaySink && foam.util.equals(a.displaySink.colors, ['$a','$b']), 'Bar.colors forwarded');
      x.test(a.displaySink && a.displaySink.alignment && a.displaySink.alignment.name === 'LEFT', 'Bar.alignment forwarded');
      x.test(a.displaySink && a.displaySink.maintainAspectRatio === true, 'Bar.maintainAspectRatio forwarded');
      x.test(a.displaySink && a.displaySink.height === 250, 'Bar.height forwarded');
      x.test(a.displaySink && a.displaySink.showLegend === false, 'Bar.showLegend forwarded');
      x.test(a.displaySink && a.displaySink.legendPosition && a.displaySink.legendPosition.name === 'BOTTOM', 'Bar.legendPosition forwarded');
      x.test(a.displaySink && a.displaySink.showTooltips === false, 'Bar.showTooltips forwarded');
      x.test(a.displaySink && a.displaySink.showTooltipSum === true, 'Bar.showTooltipSum forwarded');
      x.test(a.displaySink && a.displaySink.animate === false, 'Bar.animate forwarded');
      x.test(a.displaySink && a.displaySink.animationDuration === 200, 'Bar.animationDuration forwarded');
      x.test(a.displaySink && a.displaySink.periodCount === 6, 'Bar.periodCount forwarded');
    },

    async function testPie(x) {
      var a = this.DashboardPieChartDAOAgent.create({
        showPercentages: true, cutoutPercentage: 40, clockwise: false,
        rotation: 45, disableLegendClick: true, emptyValueMessage: 'none',
        colors: ['$c'], alignment: 'RIGHT', maintainAspectRatio: true,
        height: 200, showLegend: false, legendPosition: 'LEFT',
        showTooltips: true, showTooltipSum: false, animate: true,
        animationDuration: 700
      }, x);
      x.test(a.displaySink != null, 'Pie displaySink auto-created');
      x.test(a.displaySink && a.displaySink.showPercentages === true, 'Pie.showPercentages forwarded');
      x.test(a.displaySink && a.displaySink.cutoutPercentage === 40, 'Pie.cutoutPercentage forwarded');
      x.test(a.displaySink && a.displaySink.clockwise === false, 'Pie.clockwise forwarded');
      x.test(a.displaySink && a.displaySink.rotation === 45, 'Pie.rotation forwarded');
      x.test(a.displaySink && a.displaySink.disableLegendClick === true, 'Pie.disableLegendClick forwarded');
      x.test(a.displaySink && a.displaySink.emptyValueMessage === 'none', 'Pie.emptyValueMessage forwarded');
      x.test(a.displaySink && foam.util.equals(a.displaySink.colors, ['$c']), 'Pie.colors forwarded');
      x.test(a.displaySink && a.displaySink.height === 200, 'Pie.height forwarded');
      x.test(a.displaySink && a.displaySink.legendPosition && a.displaySink.legendPosition.name === 'LEFT', 'Pie.legendPosition forwarded');
    },

    async function testStackedBar(x) {
      var a = this.DashboardStackedBarChartDAOAgent.create({
        horizontal: true, xAxisLabel: 'X', yAxisLabel: 'Y', showGridLines: false,
        onClickScript: 'console.log("x")', colors: ['$s1'], alignment: 'CENTER',
        maintainAspectRatio: false, height: 300, showLegend: true,
        legendPosition: 'TOP', showTooltips: true, showTooltipSum: false,
        animate: true, animationDuration: 1000, periodCount: 12
      }, x);
      x.test(a.displaySink != null, 'StackedBar displaySink auto-created');
      x.test(a.displaySink && a.displaySink.horizontal === true, 'StackedBar.horizontal forwarded');
      x.test(a.displaySink && a.displaySink.xAxisLabel === 'X', 'StackedBar.xAxisLabel forwarded');
      x.test(a.displaySink && a.displaySink.onClickScript === 'console.log("x")', 'StackedBar.onClickScript forwarded');
      x.test(a.displaySink && a.displaySink.height === 300, 'StackedBar.height forwarded');
      x.test(a.displaySink && a.displaySink.periodCount === 12, 'StackedBar.periodCount forwarded');
    },

    async function testLine(x) {
      var a = this.DashboardLineChartDAOAgent.create({
        xAxisLabel: 'X', yAxisLabel: 'Y', fill: true, tension: 0.5,
        stepped: true, showPoints: false, pointRadius: 6, showGridLines: false,
        colors: ['$l'], alignment: 'LEFT', maintainAspectRatio: true,
        height: 280, showLegend: false, legendPosition: 'RIGHT',
        showTooltips: true, showTooltipSum: true, animate: false,
        animationDuration: 300, periodCount: 24
      }, x);
      // Line's displaySink type depends on groupBy; call createSink to populate it.
      a.createSink();
      x.test(a.displaySink != null, 'Line displaySink populated');
      x.test(a.displaySink && a.displaySink.fill === true, 'Line.fill forwarded');
      x.test(a.displaySink && a.displaySink.tension === 0.5, 'Line.tension forwarded');
      x.test(a.displaySink && a.displaySink.stepped === true, 'Line.stepped forwarded');
      x.test(a.displaySink && a.displaySink.showPoints === false, 'Line.showPoints forwarded');
      x.test(a.displaySink && a.displaySink.pointRadius === 6, 'Line.pointRadius forwarded');
      x.test(a.displaySink && a.displaySink.height === 280, 'Line.height forwarded');
      x.test(a.displaySink && a.displaySink.periodCount === 24, 'Line.periodCount forwarded');
    },

    async function testCalendar(x) {
      var a = this.DashboardCalendarChartDAOAgent.create({
        periodCount: 30, colors: ['$cc'], alignment: 'CENTER',
        maintainAspectRatio: false, height: 220, showLegend: true,
        legendPosition: 'BOTTOM', animate: true, animationDuration: 600
      }, x);
      x.test(a.displaySink != null, 'Calendar displaySink auto-created');
      x.test(a.displaySink && a.displaySink.periodCount === 30, 'Calendar.periodCount forwarded');
      x.test(a.displaySink && foam.util.equals(a.displaySink.colors, ['$cc']), 'Calendar.colors forwarded');
      x.test(a.displaySink && a.displaySink.height === 220, 'Calendar.height forwarded');
      x.test(a.displaySink && a.displaySink.animationDuration === 600, 'Calendar.animationDuration forwarded');
    }
  ]
});
