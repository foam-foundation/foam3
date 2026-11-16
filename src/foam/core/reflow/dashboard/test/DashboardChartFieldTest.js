/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Each chart keeps the field it groups by (Pie's Property, Line's X Property)
// in one place: the sink's form. These tests cover the three ways a chart
// gets that field: typed into the form of a new chart, read from a flow saved
// before the form moved to the sink (the field and the total were on the
// agent), and read back from a flow saved by this code.
foam.CLASS({
  package: 'foam.core.reflow.dashboard.test',
  name: 'DashboardChartFieldTest',
  extends: 'foam.core.test.JSTest',

  requires: [
    'foam.core.reflow.dashboard.DashboardBarChartDAOAgent',
    'foam.core.reflow.dashboard.DashboardBarSink',
    'foam.core.reflow.dashboard.DashboardCalendarChartDAOAgent',
    'foam.core.reflow.dashboard.DashboardCalendarSink',
    'foam.core.reflow.dashboard.DashboardLineChartDAOAgent',
    'foam.core.reflow.dashboard.DashboardLineSink',
    'foam.core.reflow.dashboard.DashboardMultiLineSink',
    'foam.core.reflow.dashboard.DashboardPieChartDAOAgent',
    'foam.core.reflow.dashboard.DashboardPieSink',
    'foam.core.reflow.dashboard.DashboardStackedBarChartDAOAgent',
    'foam.core.reflow.dashboard.DashboardStackedBarSink',
    'foam.core.reflow.dashboard.test.DashboardTestRow',
    'foam.core.reflow.GridBy',
    'foam.core.reflow.SumDAOAgent',
    'foam.dao.ArrayDAO',
    'foam.dao.TTLSelectCachingDAO',
    'foam.dao.ArraySink',
    'foam.mlang.sink.Sum'
  ],

  methods: [
    async function runTest(x) {
      // In a flow every agent sits in a block. Saving reads the agent's
      // browseEnabled, whose factory reads block.value.select, so the agents
      // here get a block that holds some other select.
      x = x.createSubContext({ block: { value: {} } });
      await this.testGroupByChart(x, 'Bar', this.DashboardBarChartDAOAgent);
      await this.testGroupByChart(x, 'Pie', this.DashboardPieChartDAOAgent);
      await this.testStackedBar(x);
      await this.testCalendar(x);
      await this.testLineNewChart(x);
      await this.testLineOldFlow(x);
      await this.testEarlierNestedFlows(x);
      await this.testCachedSelectKeepsChartClass(x);
      this.testLabels(x);
    },

    // A select cache keys results by the sink's toString(). A Stacked Bar on
    // the same two fields as a plain GridBy view must not get the GridBy's
    // cached result, which draws as a table.
    async function testCachedSelectKeepsChartClass(x) {
      var R   = this.DashboardTestRow;
      var dao = this.TTLSelectCachingDAO.create({ delegate: this.rowsDAO(x) }, x);
      var sum = this.SumDAOAgent.create({ prop: R.AMOUNT }, x);

      var grid = await dao.select(this.GridBy.create({ xFunc: R.MONTH, yFunc: R.YEAR, acc: sum.createSink() }, x));
      x.test(! this.DashboardStackedBarSink.isInstance(grid), 'Cache: a plain GridBy select returns a plain GridBy');

      var agent = this.DashboardStackedBarChartDAOAgent.create({}, x);
      agent.displaySink.xFunc       = R.MONTH;
      agent.displaySink.yFunc       = R.YEAR;
      agent.displaySink.aggregation = sum;
      var chart = await dao.select(agent.createSink());
      x.test(this.DashboardStackedBarSink.isInstance(chart),
        'Cache: a Stacked Bar on the same fields gets its own result, not the cached GridBy. Got: ' + chart.cls_.id);
    },

    // Flows saved by the version that first moved the settings to the sink:
    // the form's wrapper field (groupByProp, xProp, dateProperty) next to the
    // real one, and a Stacked Bar's rows and cols grouped by nothing.
    async function testEarlierNestedFlows(x) {
      var dao = this.rowsDAO(x);
      var P   = this.propJson.bind(this);
      var D   = 'foam.core.reflow.dashboard.';

      var pie = foam.json.parseString('{"class":"' + D + 'DashboardPieChartDAOAgent","displaySink":{"class":"' + D +
        'DashboardPieSink","groupByProp":' + P('year') + ',"arg1":' + P('year') + ',"aggregation":' + this.sumJson() + '}}', x);
      x.test(this.canRun(pie) && pie.displaySink.arg1.name === 'year', 'Earlier Pie flow: Property shows year and Run is on');
      var sums = this.groupTotals(await dao.select(pie.createSink()));
      x.test(sums === '{"2025":20,"2026":20}', 'Earlier Pie flow: sums per year. Got: ' + sums);

      var noGroup = '{"class":"foam.mlang.sink.GroupBy","arg2":{"class":"foam.mlang.sink.Count"}}';
      var stacked = foam.json.parseString('{"class":"' + D + 'DashboardStackedBarChartDAOAgent","displaySink":{"class":"' + D +
        'DashboardStackedBarSink","xProp":' + P('month') + ',"yProp":' + P('year') + ',"xFunc":' + P('month') + ',"yFunc":' + P('year') +
        ',"rows":{"class":"foam.mlang.sink.GroupBy","arg2":' + noGroup + '},"cols":' + noGroup + '}}', x);
      x.test(this.canRun(stacked), 'Earlier Stacked Bar flow: Run is on');
      var sink = await dao.select(stacked.createSink());
      x.test(sink.cols.arg1 && sink.cols.arg1.name === 'month', 'Earlier Stacked Bar flow: columns group by X Axis, not by nothing');
      var total = 0;
      Object.values(sink.rows.groups).forEach(function(g) {
        Object.values(g.groups).forEach(function(v) { total += v.value; });
      });
      x.test(total === 4, 'Earlier Stacked Bar flow: counts all four rows. Got: ' + total);

      var line = foam.json.parseString('{"class":"' + D + 'DashboardLineChartDAOAgent","displaySink":{"class":"' + D +
        'DashboardLineSink","groupByProp":' + P('month') + ',"arg1":' + P('month') + '}}', x);
      x.test(this.canRun(line), 'Earlier Line flow: Run is on');
      x.test(this.DashboardLineSink.isInstance(line.createSink()), 'Earlier Line flow: draws a line, not an ArraySink');

      var cal = foam.json.parseString('{"class":"' + D + 'DashboardCalendarChartDAOAgent","displaySink":{"class":"' + D +
        'DashboardCalendarSink","dateProperty":' + P('month') + ',"dateProp":' + P('month') + '}}', x);
      x.test(this.canRun(cal) && cal.displaySink.dateProp.name === 'month', 'Earlier Calendar flow: Date Property shows month and Run is on');
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

    // A property of DashboardTestRow as a saved flow writes it.
    function propJson(name) {
      return '{"class":"__Property__","forClass_":"foam.core.reflow.dashboard.test.DashboardTestRow","name":"' + name + '"}';
    },

    function sumJson() {
      return '{"class":"foam.core.reflow.SumDAOAgent","prop":' + this.propJson('amount') + '}';
    },

    // Writes the agent the way the flow editor saves a block
    // (Console.generateScriptString) and reads it back.
    function saveAndLoad(agent, x) {
      var json = foam.json.Outputter.create({
        pretty: false,
        strict: true,
        formatDatesAsNumbers: false,
        outputDefaultValues: false,
        useShortNames: false,
        propertyPredicate: function(_, p) { return ! p.externalTransient && ! p.networkTransient; }
      }).stringify(agent);
      return foam.json.parseString(json, x);
    },

    // The Run button is enabled when the agent has no errors
    // (DAOPrompt.run isEnabled: ! select$errors_).
    function canRun(agent) { return ! agent.errors_; },

    function groupTotals(sink) {
      var totals = {};
      Object.keys(sink.groups).forEach(function(k) { totals[k] = sink.groups[k].value; });
      return JSON.stringify(totals);
    },

    // The labels the form showed before the settings moved to the sink.
    function testLabels(x) {
      [
        [ this.DashboardBarSink,        'arg1',         'Property' ],
        [ this.DashboardPieSink,        'arg1',         'Property' ],
        [ this.DashboardLineSink,       'arg1',         'X Property' ],
        [ this.DashboardLineSink,       'yFunc',        'Group By (Multiple Lines)' ],
        [ this.DashboardMultiLineSink,  'xFunc',        'X Property' ],
        [ this.DashboardMultiLineSink,  'yFunc',        'Group By (Multiple Lines)' ],
        [ this.DashboardStackedBarSink, 'xFunc',        'X Axis' ],
        [ this.DashboardStackedBarSink, 'yFunc',        'Stacked By' ],
        [ this.DashboardCalendarSink,   'dateProp',     'Date Property' ],
        [ this.DashboardCalendarSink,   'categoryProp', 'Category Property' ]
      ].forEach(function(row) {
        var label = row[0].getAxiomByName(row[1]).label;
        x.test(label === row[2], row[0].name + '.' + row[1] + ' is labelled "' + row[2] + '". Got: ' + label);
      });
    },

    async function testGroupByChart(x, name, Agent) {
      var R   = this.DashboardTestRow;
      var dao = this.rowsDAO(x);

      var agent = Agent.create({}, x);
      x.test(! this.canRun(agent), name + ': a new chart cannot run before Property is picked');
      agent.displaySink.arg1 = null;
      x.test(! this.canRun(agent), name + ': an emptied Property (Constant(null)) still blocks Run');
      agent.displaySink.arg1 = R.YEAR;
      x.test(this.canRun(agent), name + ': picking Property in the form enables Run');
      var counts = this.groupTotals(await dao.select(agent.createSink()));
      x.test(counts === '{"2025":2,"2026":2}', name + ': new chart counts rows per year. Got: ' + counts);
      agent.displaySink.aggregation = this.SumDAOAgent.create({}, x);
      x.test(! this.canRun(agent), name + ': a Sum with no Property turns Run off');
      agent.displaySink.aggregation.prop = R.AMOUNT;
      x.test(this.canRun(agent), name + ': picking the Sum\'s Property turns Run back on');
      var picked = this.groupTotals(await dao.select(agent.createSink()));
      x.test(picked === '{"2025":20,"2026":20}', name + ': a Sum whose Property was picked after SUM sums amounts. Got: ' + picked);

      var old = foam.json.parseString(
        '{"class":"' + Agent.id + '","prop":' + this.propJson('year') + ',"sink":' + this.sumJson() + '}', x);
      x.test(old.displaySink.arg1 && old.displaySink.arg1.name === 'year',
        name + ': an old flow shows its property in the form');
      x.test(this.SumDAOAgent.isInstance(old.displaySink.aggregation),
        name + ': an old flow shows its Sum in the form, not the default Count');
      x.test(this.canRun(old), name + ': an old flow can run');
      var sums = this.groupTotals(await dao.select(old.createSink()));
      x.test(sums === '{"2025":20,"2026":20}', name + ': an old flow sums amount per year. Got: ' + sums);

      var reloaded = this.saveAndLoad(old, x);
      x.test(reloaded.displaySink.arg1 && reloaded.displaySink.arg1.name === 'year',
        name + ': the property survives a save and reload');
      x.test(this.SumDAOAgent.isInstance(reloaded.displaySink.aggregation),
        name + ': the Sum survives a save and reload');
      x.test(this.canRun(reloaded), name + ': a reloaded chart can run');
      sums = this.groupTotals(await dao.select(reloaded.createSink()));
      x.test(sums === '{"2025":20,"2026":20}', name + ': a reloaded chart still sums per year. Got: ' + sums);

      // Loading a flow parses each chart in a throwaway context, then the
      // block copies it into its own (DAOPrompt's select preSet). The Sum
      // must move too, or its form cannot reach the block's data.
      var blockX = x.createSubContext({});
      var moved  = reloaded.clone(blockX);
      x.test(moved.displaySink.aggregation.__context__ === blockX,
        name + ': copying a loaded chart into its block also moves its Sum there');
    },

    async function testStackedBar(x) {
      var R   = this.DashboardTestRow;
      var dao = this.rowsDAO(x);

      var agent = this.DashboardStackedBarChartDAOAgent.create({}, x);
      x.test(! this.canRun(agent), 'StackedBar: a new chart cannot run');
      // The form reads the sink before the fields are picked.
      agent.displaySink.rows; agent.displaySink.cols;
      agent.displaySink.xFunc = R.MONTH;
      x.test(! this.canRun(agent), 'StackedBar: X Axis alone is not enough to run');
      agent.displaySink.yFunc = R.YEAR;
      x.test(this.canRun(agent), 'StackedBar: X Axis and Stacked By enable Run');
      var fresh = await dao.select(agent.createSink());
      x.test(fresh.cols.arg1 && fresh.cols.arg1.name === 'month',
        'StackedBar: a new chart groups columns by the X Axis picked after the form opened');
      var freshTotal = 0;
      Object.values(fresh.rows.groups).forEach(function(g) {
        Object.values(g.groups).forEach(function(v) { freshTotal += v.value; });
      });
      x.test(freshTotal === 4, 'StackedBar: a new chart counts all four rows. Got: ' + freshTotal);

      var old = foam.json.parseString(
        '{"class":"foam.core.reflow.dashboard.DashboardStackedBarChartDAOAgent","prop2":' + this.propJson('month') +
        ',"prop1":' + this.propJson('year') + ',"sink":' + this.sumJson() + '}', x);
      x.test(old.displaySink.xFunc.name === 'month' && old.displaySink.yFunc.name === 'year',
        'StackedBar: an old flow shows X Axis month and Stacked By year');
      x.test(this.SumDAOAgent.isInstance(old.displaySink.aggregation), 'StackedBar: an old flow shows its Sum');

      var reloaded = this.saveAndLoad(old, x);
      x.test(this.canRun(reloaded), 'StackedBar: a reloaded chart can run');
      var sink = await dao.select(reloaded.createSink());
      var total = 0;
      Object.values(sink.rows.groups).forEach(function(g) {
        Object.values(g.groups).forEach(function(v) { total += v.value; });
      });
      x.test(total === 40, 'StackedBar: a reloaded chart sums all four rows. Got: ' + total);
    },

    async function testCalendar(x) {
      var R = this.DashboardTestRow;

      var agent = this.DashboardCalendarChartDAOAgent.create({}, x);
      x.test(! this.canRun(agent), 'Calendar: a new chart cannot run before Date Property is picked');
      agent.displaySink.dateProp = R.MONTH;
      x.test(this.canRun(agent), 'Calendar: picking Date Property enables Run');

      // A Category picked and then cleared holds Constant(null); the calendar
      // must count rows under 'default', not skip them all.
      var cal = this.DashboardCalendarSink.create({}, x);
      cal.dateProp = foam.mlang.Constant.create({ value: new Date(Date.UTC(2026, 0, 15)) });
      cal.categoryProp = R.YEAR;
      cal.categoryProp = null;
      cal.put(R.create({ id: 1, year: 2026, month: 1, amount: 10 }));
      var cells = JSON.stringify(cal.map_);
      x.test(cells === '{"2026-01-15":{"default":1}}', 'Calendar: a cleared Category still counts the row. Got: ' + cells);

      var old = foam.json.parseString(
        '{"class":"foam.core.reflow.dashboard.DashboardCalendarChartDAOAgent","prop":' + this.propJson('month') +
        ',"categoryProp":' + this.propJson('year') + ',"sink":' + this.sumJson() + '}', x);
      x.test(old.displaySink.dateProp.name === 'month', 'Calendar: an old flow shows its Date Property');
      x.test(old.displaySink.categoryProp.name === 'year', 'Calendar: an old flow shows its Category Property');
      x.test(this.SumDAOAgent.isInstance(old.displaySink.aggregation), 'Calendar: an old flow shows its Sum');

      var reloaded = this.saveAndLoad(old, x);
      x.test(reloaded.displaySink.dateProp && reloaded.displaySink.dateProp.name === 'month',
        'Calendar: the Date Property survives a save and reload');
      x.test(this.canRun(reloaded), 'Calendar: a reloaded chart can run');
    },

    async function testLineNewChart(x) {
      var R   = this.DashboardTestRow;
      var dao = this.rowsDAO(x);

      var agent = this.DashboardLineChartDAOAgent.create({}, x);
      x.test(! this.canRun(agent), 'Line: a new chart cannot run before X Property is picked');
      agent.displaySink.arg1 = R.MONTH;
      x.test(this.canRun(agent), 'Line: picking X Property enables Run');
      x.test(agent.getDatePropertyForFiltering() === R.MONTH, 'Line: the period filter reads X Property from the form');

      var sink = agent.createSink();
      x.test(this.DashboardLineSink.isInstance(sink), 'Line: a new chart draws a line, not an ArraySink. Got: ' + sink.cls_.id);
      var counts = this.groupTotals(await dao.select(sink));
      x.test(counts === '{"1":2,"2":2}', 'Line: a new chart counts rows per month. Got: ' + counts);

      agent.displaySink.aggregation = this.SumDAOAgent.create({ prop: R.AMOUNT }, x);
      agent.displaySink.borderColors = [ '$l1' ];
      agent.displaySink.othersLabel = 'Rest';
      agent.displaySink.yFunc = R.YEAR;
      sink = agent.createSink();
      x.test(this.DashboardMultiLineSink.isInstance(agent.displaySink), 'Line: Group By (Multiple Lines) switches to the multi-line sink');
      x.test(agent.displaySink.xFunc === R.MONTH, 'Line: X Property carries over to the multi-line sink');
      x.test(agent.displaySink.yFunc === R.YEAR, 'Line: Group By carries over to the multi-line sink');
      x.test(this.SumDAOAgent.isInstance(agent.displaySink.aggregation), 'Line: the Sum carries over to the multi-line sink');
      x.test(foam.util.equals(agent.displaySink.borderColors, [ '$l1' ]), 'Line: Border Colors carry over to the multi-line sink');
      x.test(this.Sum.isInstance(sink.acc), 'Line: the multi-line run adds up with Sum');
      x.test(agent.getDatePropertyForFiltering() === R.MONTH, 'Line: the period filter reads X Property from the multi-line form');

      agent.displaySink.yFunc = null;
      sink = agent.createSink();
      x.test(this.DashboardLineSink.isInstance(agent.displaySink), 'Line: clearing Group By goes back to one line');
      x.test(agent.displaySink.arg1 === R.MONTH, 'Line: X Property carries back to the single-line sink');
      x.test(agent.displaySink.othersLabel === 'Rest', 'Line: the single-line Top N settings come back with one line');
      var sums = this.groupTotals(await dao.select(sink));
      x.test(sums === '{"1":20,"2":20}', 'Line: back on one line, the Sum still applies per month. Got: ' + sums);

      var reloaded = this.saveAndLoad(agent, x);
      x.test(this.canRun(reloaded), 'Line: a reloaded chart can run');
      sink = reloaded.createSink();
      x.test(! this.ArraySink.isInstance(sink), 'Line: a reloaded chart still draws a line. Got: ' + sink.cls_.id);
      x.test(reloaded.displaySink.arg1 && reloaded.displaySink.arg1.name === 'month', 'Line: X Property survives a save and reload');
    },

    async function testLineOldFlow(x) {
      var dao = this.rowsDAO(x);

      var old = foam.json.parseString(
        '{"class":"foam.core.reflow.dashboard.DashboardLineChartDAOAgent","xProp":' + this.propJson('month') +
        ',"groupBy":' + this.propJson('year') + ',"aggregationSink":' + this.sumJson() + '}', x);
      x.test(old.displaySink.arg1 && old.displaySink.arg1.name === 'month', 'Line: an old flow shows its X Property');
      x.test(old.displaySink.yFunc && old.displaySink.yFunc.name === 'year', 'Line: an old flow shows its Group By');
      x.test(this.SumDAOAgent.isInstance(old.displaySink.aggregation), 'Line: an old flow shows its Sum');
      x.test(old.displaySink.aggregation.__context__ === old.__subContext__,
        'Line: an old flow\'s Sum is made in the chart\'s context, so its Property picker finds the chart\'s fields');

      var reloaded = this.saveAndLoad(old, x);
      x.test(this.canRun(reloaded), 'Line: a re-saved old flow can run');
      var sink = reloaded.createSink();
      x.test(this.DashboardMultiLineSink.isInstance(sink), 'Line: a re-saved old flow still draws one line per year. Got: ' + sink.cls_.id);
      var total = 0;
      Object.values((await dao.select(sink)).rows.groups).forEach(function(g) {
        Object.values(g.groups).forEach(function(v) { total += v.value; });
      });
      x.test(total === 40, 'Line: a re-saved old flow sums all four rows. Got: ' + total);
    }
  ]
});
