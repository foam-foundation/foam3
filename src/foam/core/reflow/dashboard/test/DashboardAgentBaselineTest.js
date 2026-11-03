/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Four rows for the re-run tests: two per year, amount 10 each.
foam.CLASS({
  package: 'foam.core.reflow.dashboard.test',
  name: 'DashboardTestRow',
  properties: [
    { class: 'Int', name: 'id' },
    { class: 'Int', name: 'year' },
    { class: 'Int', name: 'month' },
    { class: 'Int', name: 'amount' }
  ]
});

foam.CLASS({
  package: 'foam.core.reflow.dashboard.test',
  name: 'DashboardAgentBaselineTest',
  extends: 'foam.core.test.JSTest',

  requires: [
    'foam.core.reflow.dashboard.DashboardBarChartDAOAgent',
    'foam.core.reflow.dashboard.DashboardPieChartDAOAgent',
    'foam.core.reflow.dashboard.DashboardStackedBarChartDAOAgent',
    'foam.core.reflow.dashboard.DashboardLineChartDAOAgent',
    'foam.core.reflow.dashboard.DashboardMultiLineSink',
    'foam.core.reflow.dashboard.DashboardCalendarChartDAOAgent',
    'foam.core.reflow.dashboard.test.DashboardTestRow',
    'foam.core.reflow.SumDAOAgent',
    'foam.dao.ArrayDAO'
  ],

  methods: [
    async function runTest(x) {
      await this.testBarBaseline(x);
      await this.testPieBaseline(x);
      await this.testStackedBarBaseline(x);
      await this.testLineBaseline(x);
      await this.testLineMultiAggregationPreserved(x);
      await this.testCalendarBaseline(x);
      await this.testMultiLineRowsColsFollowWiring(x);
      await this.testRerunCountsEachRowOnce(x);
    },

    function rowsDAO(x) {
      var R = this.DashboardTestRow;
      return this.ArrayDAO.create({ of: R, array: [
        R.create({ id: 1, year: 2025, month: 1, amount: 10 }),
        R.create({ id: 2, year: 2025, month: 2, amount: 10 }),
        R.create({ id: 3, year: 2026, month: 1, amount: 10 }),
        R.create({ id: 4, year: 2026, month: 2, amount: 10 })
      ] }, x);
    },

    // The line agent sets xFunc, yFunc and acc on the sink after creating it.
    // rows and cols read before that must not stay grouped by nothing, or
    // drawing the chart throws in GroupBy.sortedKeys().
    async function testMultiLineRowsColsFollowWiring(x) {
      var R    = this.DashboardTestRow;
      var sink = this.DashboardMultiLineSink.create({}, x);
      sink.cols; sink.rows;
      sink.xFunc = R.MONTH;
      sink.yFunc = R.YEAR;
      sink.acc   = this.SumDAOAgent.create({ prop: R.AMOUNT }, x).createSink();
      x.test(sink.cols.arg1 === R.MONTH,      'MultiLineSink.cols groups by xFunc set after it was read');
      x.test(sink.rows.arg1 === R.YEAR,       'MultiLineSink.rows groups by yFunc set after it was read');
      x.test(sink.rows.arg2.arg1 === R.MONTH, 'MultiLineSink.rows inner group uses xFunc set after it was read');
      var threw = false;
      try { sink.cols.sortedKeys(); } catch (e) { threw = true; }
      x.test(! threw, 'MultiLineSink.cols.sortedKeys() works once wired');
    },

    // DAOPrompt runs the same agent again when its filter changes, so every
    // run must start from empty counts: 4 rows stay 4, not 8.
    async function testRerunCountsEachRowOnce(x) {
      var R   = this.DashboardTestRow;
      var dao = this.rowsDAO(x);
      function groupTotal(s) {
        return Object.values(s.groups).reduce(function(t, g) { return t + g.value; }, 0);
      }
      function gridTotal(s) {
        var t = 0;
        Object.values(s.rows.groups).forEach(function(g) {
          Object.values(g.groups).forEach(function(v) { t += v.value; });
        });
        return t;
      }
      async function twice(agent, total) {
        var first  = total(await dao.select(agent.createSink()));
        var second = total(await dao.select(agent.createSink()));
        return [ first, second ];
      }

      var bar = await twice(this.DashboardBarChartDAOAgent.create({ prop: R.YEAR }, x), groupTotal);
      x.test(bar[0] === 4 && bar[1] === 4, 'Bar counts each row once per run. Got: ' + bar);

      var pie = await twice(this.DashboardPieChartDAOAgent.create({ prop: R.YEAR }, x), groupTotal);
      x.test(pie[0] === 4 && pie[1] === 4, 'Pie counts each row once per run. Got: ' + pie);

      var stacked = await twice(this.DashboardStackedBarChartDAOAgent.create({ prop1: R.YEAR, prop2: R.MONTH }, x), gridTotal);
      x.test(stacked[0] === 4 && stacked[1] === 4, 'StackedBar counts each row once per run. Got: ' + stacked);

      var line = this.DashboardLineChartDAOAgent.create({
        xProp: R.MONTH, groupBy: R.YEAR,
        aggregationSink: this.SumDAOAgent.create({ prop: R.AMOUNT }, x)
      }, x);
      var lines = await twice(line, gridTotal);
      x.test(lines[0] === 40 && lines[1] === 40, 'Line with groupBy sums each row once per run. Got: ' + lines);
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

    async function testLineMultiAggregationPreserved(x) {
      var xProp = this.DashboardLineChartDAOAgent.HEIGHT;
      var yProp = this.DashboardLineChartDAOAgent.TENSION;
      var sum   = this.SumDAOAgent.create({ prop: xProp }, x);
      var agent = this.DashboardLineChartDAOAgent.create({}, x);
      agent.xProp = xProp;
      agent.groupBy = yProp;
      agent.aggregationSink = sum;
      var sink = agent.createSink();
      x.test(this.DashboardMultiLineSink.isInstance(sink), 'Line+groupBy yields MultiLineSink. Got: ' + (sink && sink.cls_ && sink.cls_.id));
      x.test(sink.xFunc === xProp, 'MultiLineSink.xFunc wired from agent.xProp');
      x.test(sink.yFunc === yProp, 'MultiLineSink.yFunc wired from agent.groupBy');
      x.test(!! sink.acc,          'MultiLineSink.acc wired from agent.aggregationSink across Line→Multi swap');
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
    { name: 'EXPECTED_BAR',      value: '{class:"foam.core.reflow.dashboard.DashboardBarSink",arg2:{class:"foam.mlang.sink.Count"},groupKeys:[],processArrayValuesIndividually:true,horizontal:true,barThickness:20,xAxisLabel:"X",yAxisLabel:"Y",showGridLines:false,showLegend:false,maintainAspectRatio:true,height:400,legendPosition:"2",showTooltipSum:true,animate:false,animationDuration:500,colors:["$barChart1","$barChart2"]}' },
    { name: 'EXPECTED_PIE',      value: '{class:"foam.core.reflow.dashboard.DashboardPieSink",arg2:{class:"foam.mlang.sink.Count"},groupKeys:[],processArrayValuesIndividually:true,showPercentages:true,cutoutPercentage:50,disableLegendClick:true,colors:["$a","$b","$c"]}' },
    { name: 'EXPECTED_STACKED',  value: '{class:"foam.core.reflow.dashboard.DashboardStackedBarSink",xAxisLabel:"X",yAxisLabel:"Y",rows:{class:"foam.mlang.sink.GroupBy",arg2:{class:"foam.mlang.sink.GroupBy",arg2:{class:"foam.mlang.sink.Count"},groupKeys:[],processArrayValuesIndividually:true},groupKeys:[],processArrayValuesIndividually:true},cols:{class:"foam.mlang.sink.GroupBy",arg2:{class:"foam.mlang.sink.Count"},groupKeys:[],processArrayValuesIndividually:true},height:350,colors:["$s1","$s2"]}' },
    { name: 'EXPECTED_LINE',     value: '{class:"foam.dao.ArraySink"}' },
    { name: 'EXPECTED_CALENDAR', value: '{class:"foam.core.reflow.dashboard.DashboardCalendarSink",periodCount:30,map_:{},height:250,animationDuration:800,colors:["$c1"]}' }
  ]
});
