/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.dashboard.test',
  name: 'DashboardAgentBaselineTest',
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
      await this.testBarBaseline(x);
      await this.testPieBaseline(x);
      await this.testStackedBarBaseline(x);
      await this.testLineBaseline(x);
      await this.testCalendarBaseline(x);
    },

    function snapshotSink(sink) {
      return foam.json.Compact.stringify(sink);
    },

    async function testBarBaseline(x) {
      var agent = this.DashboardBarChartDAOAgent.create({
        horizontal: true,
        barThickness: 20,
        height: 400,
        showLegend: false,
        legendPosition: 'BOTTOM',
        showTooltips: true,
        showTooltipSum: true,
        animate: false,
        animationDuration: 500,
        colors: ['$barChart1', '$barChart2'],
        maintainAspectRatio: true,
        xAxisLabel: 'X',
        yAxisLabel: 'Y',
        showGridLines: false
      }, x);
      var sink = agent.createSink();
      var snapshot = this.snapshotSink(sink);
      x.test(
        snapshot === this.EXPECTED_BAR,
        'Bar baseline matches. Got: ' + snapshot
      );
    },

    async function testPieBaseline(x) {
      var agent = this.DashboardPieChartDAOAgent.create({
        showPercentages: true,
        cutoutPercentage: 50,
        clockwise: true,
        rotation: -90,
        disableLegendClick: true,
        height: 300,
        showLegend: true,
        legendPosition: 'TOP',
        colors: ['$a', '$b', '$c']
      }, x);
      var sink = agent.createSink();
      var snapshot = this.snapshotSink(sink);
      x.test(snapshot === this.EXPECTED_PIE, 'Pie baseline matches. Got: ' + snapshot);
    },

    async function testStackedBarBaseline(x) {
      var agent = this.DashboardStackedBarChartDAOAgent.create({
        horizontal: false,
        xAxisLabel: 'X',
        yAxisLabel: 'Y',
        showGridLines: true,
        height: 350,
        colors: ['$s1', '$s2']
      }, x);
      var sink = agent.createSink();
      var snapshot = this.snapshotSink(sink);
      x.test(snapshot === this.EXPECTED_STACKED, 'StackedBar baseline matches. Got: ' + snapshot);
    },

    async function testLineBaseline(x) {
      var agent = this.DashboardLineChartDAOAgent.create({
        fill: true,
        tension: 0.4,
        stepped: false,
        showPoints: true,
        pointRadius: 4,
        showGridLines: true,
        xAxisLabel: 'X',
        yAxisLabel: 'Y',
        height: 320,
        colors: ['$l1']
      }, x);
      var sink = agent.createSink();
      var snapshot = this.snapshotSink(sink);
      x.test(snapshot === this.EXPECTED_LINE, 'Line baseline matches. Got: ' + snapshot);
    },

    async function testCalendarBaseline(x) {
      var agent = this.DashboardCalendarChartDAOAgent.create({
        periodCount: 30,
        height: 250,
        showLegend: true,
        legendPosition: 'TOP',
        maintainAspectRatio: false,
        animate: true,
        animationDuration: 800,
        colors: ['$c1']
      }, x);
      var sink = agent.createSink();
      var snapshot = this.snapshotSink(sink);
      x.test(snapshot === this.EXPECTED_CALENDAR, 'Calendar baseline matches. Got: ' + snapshot);
    }
  ],

  constants: [
    { name: 'EXPECTED_BAR',      value: '{class:"foam.core.reflow.dashboard.DashboardBarSink",arg2:{class:"foam.mlang.sink.Count"},groupKeys:[],processArrayValuesIndividually:true,horizontal:true,barThickness:20,xAxisLabel:"X",yAxisLabel:"Y",showGridLines:false,showLegend:false,maintainAspectRatio:true,height:400,legendPosition:2,showTooltipSum:true,animate:false,animationDuration:500,colors:["$barChart1","$barChart2"]}' },
    { name: 'EXPECTED_PIE',      value: '{class:"foam.core.reflow.dashboard.DashboardPieSink",arg2:{class:"foam.mlang.sink.Count"},groupKeys:[],processArrayValuesIndividually:true,showPercentages:true,cutoutPercentage:50,disableLegendClick:true,colors:["$a","$b","$c"]}' },
    { name: 'EXPECTED_STACKED',  value: '{class:"foam.core.reflow.dashboard.DashboardStackedBarSink",xAxisLabel:"X",yAxisLabel:"Y",rows:{class:"foam.mlang.sink.GroupBy",arg2:{class:"foam.mlang.sink.GroupBy",arg2:{class:"foam.mlang.sink.Count"},groupKeys:[],processArrayValuesIndividually:true},groupKeys:[],processArrayValuesIndividually:true},cols:{class:"foam.mlang.sink.GroupBy",arg2:{class:"foam.mlang.sink.Count"},groupKeys:[],processArrayValuesIndividually:true},height:350,colors:["$s1","$s2"]}' },
    { name: 'EXPECTED_LINE',     value: '{class:"foam.dao.ArraySink"}' },
    { name: 'EXPECTED_CALENDAR', value: '{class:"foam.core.reflow.dashboard.DashboardCalendarSink",periodCount:30,map_:{},height:250,animationDuration:800,colors:["$c1"]}' }
  ]
});
