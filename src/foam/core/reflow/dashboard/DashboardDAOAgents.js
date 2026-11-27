/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

/**
 * Dashboard DAOAgents for FLOW Integration
 *
 * These agents adapt FOAM dashboard components to work with FLOW and DAOPrompt2.
 * They bridge the gap between FOAM's widget-based dashboard system and FLOW's
 * command-based interactive document system.
 */

foam.CLASS({
  package: 'foam.core.reflow.dashboard',
  name: 'ColorMappingMixin',

  documentation: 'Mixin providing centralized color management for charts with user control over color mappings',

  properties: [
    {
      class: 'StringArray',
      of: 'Color',
      name: 'colors',
      label: 'Chart Colors',
      view: {
        class: 'foam.u2.view.ArrayView',
        valueView: 'foam.u2.view.ColorEditView',
        defaultNewItem: foam.lang.Color.create()
      }
    }
  ],

  methods: [

    function addColorMappingToE(e) {
      // Helper method to add color controls to UI
      e.start('div').style({marginBottom: '10px'})
        .add('Colors: ', this.COLORS)
      .end();
    }
  ]
});

foam.CLASS({
  package: 'foam.core.reflow.dashboard',
  name: 'TimeSeriesGapFillingMixin',

  documentation: `
    Mixin providing time series period range display functionality for dashboard charts.

    When periodCount > 0 and the grouping property is a date transformation expression:
    1. Filters DAO to only fetch data within the period range (server-side optimization)
    2. Client-side gap filling adds zero values for missing periods

    The date range is calculated as: [today - (periodCount - 1) * period_unit, today]
    Example: periodCount=12 for months → [11 months ago, today] = 12 total months
  `,

  properties: [
    {
      class: 'Int',
      name: 'periodCount',
      label: 'Period Count',
      section: 'dataConfig',
      value: 0,
      help: 'Number of periods to display from today backwards (e.g., 12 for last 12 months). Set to 0 to show only existing data.'
      // Note: visibility function must be defined in each agent that uses this mixin,
      // since different agents have different property names (prop vs prop2 vs xProp)
    }
  ],

  methods: [
    // Each chart agent implements getDatePropertyForFiltering() and returns its
    // form's grouping field: arg1, xFunc or dateProp.

    function getPeriodCalculator_(dateProp) {
      return foam.core.reflow.dashboard.DateKeys.calculatorFor(dateProp);
    },

    function applyDateRangeFilter() {
      // Apply date range filter to DAO before query runs

      // Verify that subclass implements getDatePropertyForFiltering()
      if ( ! this.getDatePropertyForFiltering ) {
        throw new Error('[TimeSeriesGapFillingMixin] ' + this.cls_.id + ' must implement getDatePropertyForFiltering() method to use periodCount feature');
      }

      var dateProp = this.getDatePropertyForFiltering();

      console.log('[applyDateRangeFilter] dateProp:', dateProp, 'periodCount:', this.periodCount, 'class:', this.cls_.id);

      // Apply date range filter if:
      // 1. periodCount > 0 (feature enabled)
      // 2. Property exists and has a date delegate
      if ( this.periodCount > 0 && dateProp && dateProp.delegate &&
           (foam.lang.Date.isInstance(dateProp.delegate) || foam.lang.DateTime.isInstance(dateProp.delegate)) ) {

        // Calculate date range: [minDate, maxDate]
        // We subtract (periodCount - 1) because we want periodCount TOTAL periods including current period
        // Example: periodCount=12 means current month + 11 previous months = 12 total
        var calculator = this.getPeriodCalculator_(dateProp);
        if ( ! calculator ) {
          console.warn('[TimeSeriesGapFillingMixin] No period calculator found for date type:', dateProp.cls_.id);
          return;
        }

        var range = calculator(this.periodCount);
        var minDate = range.minDate;
        var maxDate = range.maxDate;

        // Filter DAO to only fetch records within [minDate, maxDate]
        // This improves performance by reducing data transfer from server
        console.log('[TimeSeriesGapFillingMixin] Applying date range filter:', {
          property: dateProp.delegate.name,
          periodCount: this.periodCount,
          minDate: minDate.toISOString(),
          maxDate: maxDate.toISOString(),
          transformationType: dateProp.cls_.id
        });

        this.dao = this.dao.where(
          this.AND(
            this.GTE(dateProp.delegate, minDate),
            this.LTE(dateProp.delegate, maxDate)
          )
        );
      }
    }
  ]
});

foam.CLASS({
  package: 'foam.core.reflow.dashboard',
  name: 'ChartDisplayMixin',

  documentation: 'Mixin for common chart display options',

  requires: [
    'foam.u2.chart.LegendPosition',
    'foam.core.reflow.dashboard.MetricAlignment'
  ],

  properties: [
    {
      class: 'Enum',
      of: 'foam.core.reflow.dashboard.MetricAlignment',
      name: 'alignment',
      label: 'Horizontal Alignment',
      value: 'CENTER'
    },
    {
      class: 'Boolean',
      name: 'maintainAspectRatio',
      label: 'Maintain Aspect Ratio',
    },
    {
      class: 'Int',
      name: 'height',
      label: 'Chart Height (px)',
      supportingLabel: 'Max height the chart will expand to',
      value: 300,
      view: {
        class: 'foam.u2.MultiView',
        horizontal: false,
        views: [
          {
            class: 'foam.u2.RangeView',
            minValue: 100,
            maxValue: 800,
            step: 10,
            onKey: true
          },
          { class: 'foam.u2.view.IntView', onKey: true }
        ]
      }
    },
    {
      class: 'Boolean',
      name: 'showLegend',
      label: 'Show Legend',
      value: true
    },
    {
      class: 'Enum',
      of: 'foam.u2.chart.LegendPosition',
      name: 'legendPosition',
      label: 'Legend Position',
      value: 'TOP',
      visibility: function(showLegend) {
        return showLegend ? foam.u2.DisplayMode.RW : foam.u2.DisplayMode.HIDDEN;
      }
    },
    {
      class: 'Boolean',
      name: 'showTooltips',
      label: 'Show Tooltips',
      value: true
    },
    {
      class: 'Boolean',
      name: 'showTooltipSum',
      label: 'Show Tooltip Sum',
      value: false,
      help: 'Show sum total in tooltip footer when multiple values are displayed'
    },
    {
      class: 'Boolean',
      name: 'animate',
      label: 'Enable Animation',
      value: true
    },
    {
      class: 'Int',
      name: 'animationDuration',
      label: 'Animation Duration (ms)',
      value: 1000,
      view: {
        class: 'foam.u2.RangeView',
        minValue: 100,
        maxValue: 3000,
        step: 100,
        onKey: true
      },
      visibility: function(animate) {
        return animate ? foam.u2.DisplayMode.RW : foam.u2.DisplayMode.HIDDEN;
      }
    }
  ],

  methods: [
    // A DAO that caches selects (TTLSelectCachingDAO) keys them by the sink's
    // toString(). Without this a chart sink keeps its parent's, so a Stacked
    // Bar on the same two fields as a plain GridBy view got the GridBy's
    // cached result back and drew a table. Naming the class keeps them apart.
    function toString() { return this.cls_.id + ':' + this.SUPER(); },

    // Builds this run's total from the form's Sum or Count into the field the
    // sink totals with (TOTAL_SLOT: arg2 by default, acc or valueSink). It is
    // built per run because the form edits the Sum in place: its Property is
    // picked after SUM, so a total built when SUM was chosen would sum nothing.
    // With nothing picked the total is a Count, as the form shows; a Stacked
    // Bar sent to the server with no total failed in GroupBy.put.
    function buildTotal_() {
      var agg = this.aggregation || foam.core.reflow.CountDAOAgent.create({}, this);
      this[this.TOTAL_SLOT || 'arg2'] = agg.createSink();
    },

    function isEmptyKey_(k) {
      // A row with no value in a grouping field is grouped under the key
      // "null", "undefined" or "": a chart leaves it out rather than draw a
      // blank or "null" spoke, row or column.
      return k === '' || k === 'null' || k === 'undefined';
    },

    function addChartDisplayToE(e) {
      var self = this;
      // Add chart display configuration fields to the UI
      e.start('div').style({marginBottom: '10px'})
        .add('Height: ', this.HEIGHT)
      .end()
      .start('div').style({marginBottom: '10px'})
        .add('Legend: ', this.SHOW_LEGEND)
        .add(self.dynamic(function(showLegend) {
          if (showLegend) {
            return this.add(' Position: ', self.LEGEND_POSITION);
          }
        }))
      .end()
      .start('div').style({marginBottom: '10px'})
        .add('Tooltips: ', this.SHOW_TOOLTIPS, ' Sum: ', this.SHOW_TOOLTIP_SUM, ' Animation: ', this.ANIMATE)
        .add(self.dynamic(function(animate) {
          if (animate) {
            return this.add(' Duration: ', self.ANIMATION_DURATION, 'ms');
          }
        }))
      .end()
      .start('div').style({marginBottom: '10px'})
        .add(' Maintain Ratio: ', this.MAINTAIN_ASPECT_RATIO)
      .end();
    }
  ]
});

// DirectChartMixin removed - not used after refactoring to sink-based approach
// CardRenderMixin removed - metrics always render as cards


foam.CLASS({
  package: 'foam.core.reflow.dashboard',
  name: 'DashboardBarChartDAOAgent',
  extends: 'foam.core.reflow.GroupByDAOAgent',
  mixins: [
    'foam.core.reflow.dashboard.TimeSeriesGapFillingMixin'
  ],

  requires: [
    'foam.core.reflow.dashboard.DashboardBarSink',
    'foam.core.reflow.ReactiveSectionedDetailView'
  ],

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.core.reflow.dashboard.DashboardBarSink',
      name: 'displaySink',
      hidden: true,
      // An empty field in the chart's form turns Run off.
      autoValidate: true,
      factory: function() { return this.DashboardBarSink.create({}, this); }
    },
    // Flows saved before the form moved to the sink keep these on the agent
    // ({ prop2: month, prop1: status, sink: Sum }); they only forward into the form.
    // validateObj: null drops the inherited Required; the form checks the field.
    { name: 'prop', hidden: true, transient: true, validateObj: null,
      setter: function(v) { this.displaySink.arg1 = v; } },
    { name: 'sink', hidden: true, transient: true,
      setter: function(v) { if ( v && v.createSink ) this.displaySink.aggregation = v; } },
    { name: 'topN', hidden: true, transient: true,
      postSet: function(o, n) { this.displaySink.topN = n; } },
    { name: 'sortOrder', hidden: true, transient: true,
      postSet: function(o, n) { this.displaySink.sortOrder = n; } },
    { name: 'includeOthers', hidden: true, transient: true,
      postSet: function(o, n) { this.displaySink.includeOthers = n; } },
    { name: 'othersLabel', hidden: true, transient: true,
      postSet: function(o, n) { this.displaySink.othersLabel = n; } },
    { name: 'groupLimit', hidden: true, transient: true,
      postSet: function(o, n) { this.displaySink.groupLimit = n; } },
    // Legacy flat-format shims (hidden, setter-only) — forward to displaySink
    { name: 'timeUnit', hidden: true, transient: true,
      setter: function(v) { this.displaySink.timeUnit = v; } },
    { name: 'horizontal', hidden: true, transient: true,
      setter: function(v) { this.displaySink.horizontal = v; } },
    { name: 'barThickness', hidden: true, transient: true,
      setter: function(v) { this.displaySink.barThickness = v; } },
    { name: 'datasetLabel', hidden: true, transient: true,
      setter: function(v) { this.displaySink.datasetLabel = v; } },
    { name: 'xAxisLabel', hidden: true, transient: true,
      setter: function(v) { this.displaySink.xAxisLabel = v; } },
    { name: 'yAxisLabel', hidden: true, transient: true,
      setter: function(v) { this.displaySink.yAxisLabel = v; } },
    { name: 'showGridLines', hidden: true, transient: true,
      setter: function(v) { this.displaySink.showGridLines = v; } },
    { name: 'colors', hidden: true, transient: true,
      setter: function(v) { this.displaySink.colors = v; } },
    { name: 'alignment', hidden: true, transient: true,
      setter: function(v) { this.displaySink.alignment = v; } },
    { name: 'maintainAspectRatio', hidden: true, transient: true,
      setter: function(v) { this.displaySink.maintainAspectRatio = v; } },
    { name: 'height', hidden: true, transient: true,
      setter: function(v) { this.displaySink.height = v; } },
    { name: 'showLegend', hidden: true, transient: true,
      setter: function(v) { this.displaySink.showLegend = v; } },
    { name: 'legendPosition', hidden: true, transient: true,
      setter: function(v) { this.displaySink.legendPosition = v; } },
    { name: 'showTooltips', hidden: true, transient: true,
      setter: function(v) { this.displaySink.showTooltips = v; } },
    { name: 'showTooltipSum', hidden: true, transient: true,
      setter: function(v) { this.displaySink.showTooltipSum = v; } },
    { name: 'animate', hidden: true, transient: true,
      setter: function(v) { this.displaySink.animate = v; } },
    { name: 'animationDuration', hidden: true, transient: true,
      setter: function(v) { this.displaySink.animationDuration = v; } }
  ],

  methods: [
    function init() {
      this.SUPER();
      var self = this;
      // periodCount comes from TimeSeriesGapFillingMixin; forward to sink.
      if ( this.periodCount ) self.displaySink.periodCount = self.periodCount;
      this.onDetach(this.periodCount$.sub(function() {
        self.displaySink.periodCount = self.periodCount;
      }));
    },

    function getDatePropertyForFiltering() {
      return this.displaySink.arg1;
    },

    function createSink() {
      this.applyDateRangeFilter();
      // A fresh copy for every run. DAOPrompt runs the same agent again when
      // its filter changes, and the same sink would add the new rows to the
      // old counts (4 rows counted as 8 on the second run). displaySink only
      // holds the chart settings. The other chart agents below do the same.
      var sink = this.displaySink.clone(this);
      sink.buildTotal_();
      return sink;
    },

    function addSinkToE(e, s) { e.add(s); },

    function addToE(e) {
      e.startContext({})
        .tag(this.ReactiveSectionedDetailView, { data$: this.displaySink$, showTitle: true })
      .endContext();
    }
  ]
});

foam.CLASS({
  package: 'foam.core.reflow.dashboard',
  name: 'DashboardStackedBarChartDAOAgent',
  extends: 'foam.core.reflow.GridByDAOAgent',
  mixins: [
    'foam.core.reflow.dashboard.TimeSeriesGapFillingMixin'
  ],

  requires: [
    'foam.core.reflow.dashboard.DashboardStackedBarSink',
    'foam.core.reflow.ReactiveSectionedDetailView'
  ],

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.core.reflow.dashboard.DashboardStackedBarSink',
      name: 'displaySink',
      hidden: true,
      // An empty field in the chart's form turns Run off.
      autoValidate: true,
      factory: function() { return this.DashboardStackedBarSink.create({}, this); }
    },
    // Flows saved before the form moved to the sink keep these on the agent
    // ({ xProp: date, groupBy: currency, aggregationSink: Sum }); they only forward into the form.
    // validateObj: null drops the inherited Required; the form checks the field.
    { name: 'prop2', hidden: true, transient: true, validateObj: null,
      setter: function(v) { this.displaySink.xFunc = v; } },
    { name: 'prop1', hidden: true, transient: true, validateObj: null,
      setter: function(v) { this.displaySink.yFunc = v; } },
    { name: 'sink', hidden: true, transient: true,
      setter: function(v) { if ( v && v.createSink ) this.displaySink.aggregation = v; } },
    // Legacy flat-format shims — setter-only, forward to displaySink
    { name: 'timeUnit', hidden: true, transient: true,
      setter: function(v) { this.displaySink.timeUnit = v; } },
    { name: 'horizontal', hidden: true, transient: true,
      setter: function(v) { this.displaySink.horizontal = v; } },
    { name: 'xAxisLabel', hidden: true, transient: true,
      setter: function(v) { this.displaySink.xAxisLabel = v; } },
    { name: 'yAxisLabel', hidden: true, transient: true,
      setter: function(v) { this.displaySink.yAxisLabel = v; } },
    { name: 'showGridLines', hidden: true, transient: true,
      setter: function(v) { this.displaySink.showGridLines = v; } },
    { name: 'onClickScript', hidden: true, transient: true,
      setter: function(v) { this.displaySink.onClickScript = v; } },
    { name: 'colors', hidden: true, transient: true,
      setter: function(v) { this.displaySink.colors = v; } },
    { name: 'alignment', hidden: true, transient: true,
      setter: function(v) { this.displaySink.alignment = v; } },
    { name: 'maintainAspectRatio', hidden: true, transient: true,
      setter: function(v) { this.displaySink.maintainAspectRatio = v; } },
    { name: 'height', hidden: true, transient: true,
      setter: function(v) { this.displaySink.height = v; } },
    { name: 'showLegend', hidden: true, transient: true,
      setter: function(v) { this.displaySink.showLegend = v; } },
    { name: 'legendPosition', hidden: true, transient: true,
      setter: function(v) { this.displaySink.legendPosition = v; } },
    { name: 'showTooltips', hidden: true, transient: true,
      setter: function(v) { this.displaySink.showTooltips = v; } },
    { name: 'showTooltipSum', hidden: true, transient: true,
      setter: function(v) { this.displaySink.showTooltipSum = v; } },
    { name: 'animate', hidden: true, transient: true,
      setter: function(v) { this.displaySink.animate = v; } },
    { name: 'animationDuration', hidden: true, transient: true,
      setter: function(v) { this.displaySink.animationDuration = v; } }
  ],

  methods: [
    function init() {
      this.SUPER();
      var self = this;
      if ( this.periodCount ) self.displaySink.periodCount = self.periodCount;
      this.onDetach(this.periodCount$.sub(function() {
        self.displaySink.periodCount = self.periodCount;
      }));
    },

    function getDatePropertyForFiltering() { return this.displaySink.xFunc; },

    function createSink() {
      this.applyDateRangeFilter();
      // A chart saved by an earlier version stored rows and cols grouped by
      // nothing, because they were built before X Axis and Stacked By were
      // picked. A stored value hides the sink's rows/cols expressions, so the
      // run copy drops them and rebuilds both from the two fields.
      var sink = this.displaySink.clone(this);
      sink.clearProperty('rows');
      sink.clearProperty('cols');
      sink.buildTotal_();
      return sink;
    },

    function addSinkToE(e, s) { e.add(s); },

    function addToE(e) {
      e.startContext({})
        .tag(this.ReactiveSectionedDetailView, { data$: this.displaySink$, showTitle: true })
      .endContext();
    }
  ]
});

foam.CLASS({
  package: 'foam.core.reflow.dashboard',
  name: 'DashboardPieChartDAOAgent',
  extends: 'foam.core.reflow.GroupByDAOAgent',

  requires: [
    'foam.core.reflow.dashboard.DashboardPieSink',
    'foam.core.reflow.ReactiveSectionedDetailView'
  ],

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.core.reflow.dashboard.DashboardPieSink',
      name: 'displaySink',
      hidden: true,
      // An empty field in the chart's form turns Run off.
      autoValidate: true,
      factory: function() { return this.DashboardPieSink.create({}, this); }
    },
    // Flows saved before the form moved to the sink keep these on the agent
    // ({ prop: createdAt, categoryProp: status, sink: Sum }); they only forward into the form.
    // validateObj: null drops the inherited Required; the form checks the field.
    { name: 'prop', hidden: true, transient: true, validateObj: null,
      setter: function(v) { this.displaySink.arg1 = v; } },
    { name: 'sink', hidden: true, transient: true,
      setter: function(v) { if ( v && v.createSink ) this.displaySink.aggregation = v; } },
    { name: 'topN', hidden: true, transient: true,
      postSet: function(o, n) { this.displaySink.topN = n; } },
    { name: 'sortOrder', hidden: true, transient: true,
      postSet: function(o, n) { this.displaySink.sortOrder = n; } },
    { name: 'includeOthers', hidden: true, transient: true,
      postSet: function(o, n) { this.displaySink.includeOthers = n; } },
    { name: 'othersLabel', hidden: true, transient: true,
      postSet: function(o, n) { this.displaySink.othersLabel = n; } },
    { name: 'groupLimit', hidden: true, transient: true,
      postSet: function(o, n) { this.displaySink.groupLimit = n; } },
    // Legacy flat-format shims — setter-only, forward to displaySink
    { name: 'showPercentages', hidden: true, transient: true,
      setter: function(v) { this.displaySink.showPercentages = v; } },
    { name: 'cutoutPercentage', hidden: true, transient: true,
      setter: function(v) { this.displaySink.cutoutPercentage = v; } },
    { name: 'clockwise', hidden: true, transient: true,
      setter: function(v) { this.displaySink.clockwise = v; } },
    { name: 'rotation', hidden: true, transient: true,
      setter: function(v) { this.displaySink.rotation = v; } },
    { name: 'disableLegendClick', hidden: true, transient: true,
      setter: function(v) { this.displaySink.disableLegendClick = v; } },
    { name: 'legendMinWidthPercent', hidden: true, transient: true,
      setter: function(v) { this.displaySink.legendMinWidthPercent = v; } },
    { name: 'legendMaxWidthPercent', hidden: true, transient: true,
      setter: function(v) { this.displaySink.legendMaxWidthPercent = v; } },
    { name: 'emptyValueMessage', hidden: true, transient: true,
      setter: function(v) { this.displaySink.emptyValueMessage = v; } },
    { name: 'colors', hidden: true, transient: true,
      setter: function(v) { this.displaySink.colors = v; } },
    { name: 'alignment', hidden: true, transient: true,
      setter: function(v) { this.displaySink.alignment = v; } },
    { name: 'maintainAspectRatio', hidden: true, transient: true,
      setter: function(v) { this.displaySink.maintainAspectRatio = v; } },
    { name: 'height', hidden: true, transient: true,
      setter: function(v) { this.displaySink.height = v; } },
    { name: 'showLegend', hidden: true, transient: true,
      setter: function(v) { this.displaySink.showLegend = v; } },
    { name: 'legendPosition', hidden: true, transient: true,
      setter: function(v) { this.displaySink.legendPosition = v; } },
    { name: 'showTooltips', hidden: true, transient: true,
      setter: function(v) { this.displaySink.showTooltips = v; } },
    { name: 'showTooltipSum', hidden: true, transient: true,
      setter: function(v) { this.displaySink.showTooltipSum = v; } },
    { name: 'animate', hidden: true, transient: true,
      setter: function(v) { this.displaySink.animate = v; } },
    { name: 'animationDuration', hidden: true, transient: true,
      setter: function(v) { this.displaySink.animationDuration = v; } }
  ],

  methods: [
    function createSink() {
      var sink = this.displaySink.clone(this);
      sink.buildTotal_();
      return sink;
    },
    function addSinkToE(e, s) { e.add(s); },
    function addToE(e) {
      e.startContext({})
        .tag(this.ReactiveSectionedDetailView, { data$: this.displaySink$, showTitle: true })
      .endContext();
    }
  ]
});


// DashboardDonutChartDAOAgent removed - use DashboardPieChartDAOAgent with cutoutPercentage instead

foam.CLASS({
  package: 'foam.core.reflow.dashboard',
  name: 'DashboardLineChartDAOAgent',
  extends: 'foam.core.reflow.AbstractSinkDAOAgent',
  mixins: [
    'foam.core.reflow.dashboard.TimeSeriesGapFillingMixin'
  ],

  requires: [
    'foam.core.reflow.dashboard.DashboardLineSink',
    'foam.core.reflow.dashboard.DashboardMultiLineSink',
    'foam.core.reflow.ReactiveSectionedDetailView',
    'foam.dao.ArraySink'
  ],

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.dao.Sink',
      name: 'displaySink',
      hidden: true,
      // An empty field in the chart's form turns Run off.
      autoValidate: true,
      factory: function() { return this.DashboardLineSink.create({}, this); }
    },
    // Flows saved before the form moved to the sink keep these on the agent
    // ({ prop: severity, sink: Sum }); they only forward into the form.
    { name: 'xProp', hidden: true, transient: true,
      setter: function(v) { this.displaySink.arg1 = v; } },
    { name: 'groupBy', hidden: true, transient: true,
      setter: function(v) { this.displaySink.yFunc = v; } },
    { name: 'singleLineSink_', hidden: true, transient: true },
    // Saved Network Fees flows follow aggregationSink with an empty
    // "sink": {}, so both only take an object that can build a total.
    { name: 'aggregationSink', hidden: true, transient: true,
      setter: function(v) { if ( v && v.createSink ) this.displaySink.aggregation = v; } },
    { name: 'sink', hidden: true, transient: true,
      setter: function(v) { if ( v && v.createSink ) this.displaySink.aggregation = v; } },
    // Legacy flat-format shims — setter-only, forward to displaySink
    { name: 'timeUnit', hidden: true, transient: true,
      setter: function(v) { this.displaySink.timeUnit = v; } },
    { name: 'xAxisLabel', hidden: true, transient: true,
      setter: function(v) { this.displaySink.xAxisLabel = v; } },
    { name: 'yAxisLabel', hidden: true, transient: true,
      setter: function(v) { this.displaySink.yAxisLabel = v; } },
    { name: 'fill', hidden: true, transient: true,
      setter: function(v) { this.displaySink.fill = v; } },
    { name: 'tension', hidden: true, transient: true,
      setter: function(v) { this.displaySink.tension = v; } },
    { name: 'stepped', hidden: true, transient: true,
      setter: function(v) { this.displaySink.stepped = v; } },
    { name: 'showPoints', hidden: true, transient: true,
      setter: function(v) { this.displaySink.showPoints = v; } },
    { name: 'pointRadius', hidden: true, transient: true,
      setter: function(v) { this.displaySink.pointRadius = v; } },
    { name: 'showGridLines', hidden: true, transient: true,
      setter: function(v) { this.displaySink.showGridLines = v; } },
    { name: 'colors', hidden: true, transient: true,
      setter: function(v) { this.displaySink.colors = v; } },
    { name: 'alignment', hidden: true, transient: true,
      setter: function(v) { this.displaySink.alignment = v; } },
    { name: 'maintainAspectRatio', hidden: true, transient: true,
      setter: function(v) { this.displaySink.maintainAspectRatio = v; } },
    { name: 'height', hidden: true, transient: true,
      setter: function(v) { this.displaySink.height = v; } },
    { name: 'showLegend', hidden: true, transient: true,
      setter: function(v) { this.displaySink.showLegend = v; } },
    { name: 'legendPosition', hidden: true, transient: true,
      setter: function(v) { this.displaySink.legendPosition = v; } },
    { name: 'showTooltips', hidden: true, transient: true,
      setter: function(v) { this.displaySink.showTooltips = v; } },
    { name: 'showTooltipSum', hidden: true, transient: true,
      setter: function(v) { this.displaySink.showTooltipSum = v; } },
    { name: 'animate', hidden: true, transient: true,
      setter: function(v) { this.displaySink.animate = v; } },
    { name: 'animationDuration', hidden: true, transient: true,
      setter: function(v) { this.displaySink.animationDuration = v; } },
    { name: 'toggleCustomXScale', hidden: true, transient: true,
      setter: function(v) { this.displaySink.toggleCustomXScale = v; } },
    { name: 'xAxisMinScale', hidden: true, transient: true,
      setter: function(v) { this.displaySink.xAxisMinScale = v; } },
    { name: 'xAxisMaxScale', hidden: true, transient: true,
      setter: function(v) { this.displaySink.xAxisMaxScale = v; } },
    { name: 'xDateAxisMinScale', hidden: true, transient: true,
      setter: function(v) { this.displaySink.xDateAxisMinScale = v; } },
    { name: 'xDateAxisMaxScale', hidden: true, transient: true,
      setter: function(v) { this.displaySink.xDateAxisMaxScale = v; } },
    { name: 'toggleCustomYScale', hidden: true, transient: true,
      setter: function(v) { this.displaySink.toggleCustomYScale = v; } },
    { name: 'yAxisMinScale', hidden: true, transient: true,
      setter: function(v) { this.displaySink.yAxisMinScale = v; } },
    { name: 'yAxisMaxScale', hidden: true, transient: true,
      setter: function(v) { this.displaySink.yAxisMaxScale = v; } },
    { name: 'autoSkip', hidden: true, transient: true,
      setter: function(v) { this.displaySink.autoSkip = v; } }
  ],

  methods: [
    function getDatePropertyForFiltering() { return this.displaySink[this.xName_(this.displaySink)]; },

    // The X field is arg1 on the single-line sink and xFunc on the
    // multi-line one.
    function xName_(sink) {
      return this.DashboardMultiLineSink.isInstance(sink) ? 'xFunc' : 'arg1';
    },

    function init() {
      this.SUPER();
      var self = this;
      if ( this.periodCount ) self.displaySink.periodCount = this.periodCount;
      this.onDetach(this.periodCount$.sub(function() {
        self.displaySink.periodCount = self.periodCount;
      }));
    },

    function createSink() {
      // Filling in "Group By (Multiple Lines)" turns the chart into one line
      // per group (one line per currency), which the multi-line sink draws.
      // Clearing it goes back to the single-line sink. The form shows that
      // field on both sinks as yFunc, so the choice survives the switch.
      var wantMulti = ! this.displaySink.hasDefaultValue('yFunc');
      var isMulti   = this.DashboardMultiLineSink.isInstance(this.displaySink);

      if ( wantMulti !== isMulti ) {
        var old = this.displaySink;
        // Going back to one line reuses the single-line form it left, so its
        // Top N settings (the multi-line form has none) come back with it.
        var next = wantMulti
          ? this.DashboardMultiLineSink.create({}, this)
          : this.singleLineSink_ || this.DashboardLineSink.create({}, this);
        if ( wantMulti ) this.singleLineSink_ = old;
        [ 'periodCount', 'timeUnit', 'xAxisLabel', 'yAxisLabel', 'fill', 'tension', 'stepped',
          'showPoints', 'pointRadius', 'showGridLines', 'colors', 'alignment', 'maintainAspectRatio',
          'height', 'showLegend', 'legendPosition', 'showTooltips', 'showTooltipSum',
          'animate', 'animationDuration', 'toggleCustomXScale', 'xAxisMinScale', 'xAxisMaxScale',
          'xDateAxisMinScale', 'xDateAxisMaxScale', 'toggleCustomYScale', 'yAxisMinScale',
          'yAxisMaxScale', 'autoSkip', 'aggregation', 'yFunc', 'borderColors' ].forEach(function(p) {
          // hasOwnProperty, so an unset scale bound stays unset on the new sink
          if ( old.hasOwnProperty(p) ) next[p] = old[p];
        });
        if ( old.hasOwnProperty(this.xName_(old)) ) next[this.xName_(next)] = old[this.xName_(old)];
        if ( ! wantMulti ) next.clearProperty('yFunc');
        this.displaySink = next;
      }

      if ( this.displaySink.hasDefaultValue(this.xName_(this.displaySink)) ) return this.ArraySink.create();
      this.applyDateRangeFilter();
      var sink = this.displaySink.clone(this);
      sink.buildTotal_();
      return sink;
    },

    function value(s) { return s; },

    function addSinkToE(e, s) { e.add(s); },

    function addToE(e) {
      e.startContext({})
        .tag(this.ReactiveSectionedDetailView, { data$: this.displaySink$, showTitle: true })
      .endContext();
    }
  ]
});

foam.CLASS({
  package: 'foam.core.reflow.dashboard',
  name: 'DashboardMetricDAOAgent',
  extends: 'foam.core.reflow.AbstractSinkDAOAgent',

  exports: ['of'],

  requires: [
    'foam.core.reflow.dashboard.DashboardMetricSink',
    'foam.core.reflow.dashboard.MetricOperation',
    'foam.core.reflow.ReactiveSectionedDetailView'
  ],
  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.core.reflow.dashboard.DashboardMetricSink',
      name:'sink',
      hidden: true
    }
  ],

  methods: [
    function createSink() {
      if ( this.sink ) {
        this.sink.reset();
        return this.sink;
      }
      // Create new sink based on current configuration
      return this.sink = this.DashboardMetricSink.create({});
    },
    function addSinkToE(e, s) {
      this.sink = this.sink.copyFrom(s);
      e.add(this.sink);
    },
    function addToE(e) {
      if ( ! this.sink ) this.createSink();
      e.startContext({data: this.sink$})
        .tag(this.ReactiveSectionedDetailView, {
          data$: this.sink$,
          showTitle: true
        })
      .endContext();
    }
  ]
});

foam.CLASS({
  package: 'foam.core.reflow.dashboard',
  name: 'DashboardCalendarChartDAOAgent',
  extends: 'foam.core.reflow.GroupByDAOAgent',
  mixins: [
    'foam.core.reflow.dashboard.TimeSeriesGapFillingMixin'
  ],

  requires: [
    'foam.core.reflow.dashboard.DashboardCalendarSink',
    'foam.core.reflow.ReactiveSectionedDetailView'
  ],

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.core.reflow.dashboard.DashboardCalendarSink',
      name: 'displaySink',
      hidden: true,
      // An empty field in the chart's form turns Run off.
      autoValidate: true,
      factory: function() { return this.DashboardCalendarSink.create({ periodCount: 30 }, this); }
    },
    // Flows saved before the form moved to the sink keep these on the agent
    // ({ prop: severity, sink: Sum }); they only forward into the form.
    // validateObj: null drops the inherited Required; the form checks the field.
    { name: 'prop', hidden: true, transient: true, validateObj: null,
      setter: function(v) { this.displaySink.dateProp = v; } },
    { name: 'categoryProp', hidden: true, transient: true,
      setter: function(v) { this.displaySink.categoryProp = v; } },
    { name: 'sink', hidden: true, transient: true,
      setter: function(v) { if ( v && v.createSink ) this.displaySink.aggregation = v; } },
    { name: 'showAllData', hidden: true, transient: true,
      setter: function(v) { this.displaySink.showAllData = v; } },
    // Legacy flat-format shims — setter-only
    { name: 'colors', hidden: true, transient: true,
      setter: function(v) { this.displaySink.colors = v; } },
    { name: 'alignment', hidden: true, transient: true,
      setter: function(v) { this.displaySink.alignment = v; } },
    { name: 'maintainAspectRatio', hidden: true, transient: true,
      setter: function(v) { this.displaySink.maintainAspectRatio = v; } },
    { name: 'height', hidden: true, transient: true,
      setter: function(v) { this.displaySink.height = v; } },
    { name: 'showLegend', hidden: true, transient: true,
      setter: function(v) { this.displaySink.showLegend = v; } },
    { name: 'legendPosition', hidden: true, transient: true,
      setter: function(v) { this.displaySink.legendPosition = v; } },
    { name: 'animate', hidden: true, transient: true,
      setter: function(v) { this.displaySink.animate = v; } },
    { name: 'animationDuration', hidden: true, transient: true,
      setter: function(v) { this.displaySink.animationDuration = v; } }
  ],

  methods: [
    function getDatePropertyForFiltering() { return this.displaySink.dateProp; },
    function init() {
      this.SUPER();
      var self = this;
      // Calendar's sink has periodCount default 30 (from factory). Agent's
      // TimeSeriesGapFillingMixin periodCount default is 0 — only forward
      // explicit non-zero values so the factory default stays intact.
      if ( this.periodCount !== undefined && this.periodCount !== 0 ) {
        self.displaySink.periodCount = this.periodCount;
      }
      this.onDetach(this.periodCount$.sub(function() {
        if ( self.periodCount !== undefined ) self.displaySink.periodCount = self.periodCount;
      }));
    },
    function createSink() {
      // Skip the date-range filter when showAllData is set on the sink so
      // the calendar renders every record in the DAO regardless of date.
      if ( ! this.displaySink.showAllData ) {
        this.applyDateRangeFilter && this.applyDateRangeFilter();
      }
      var sink = this.displaySink.clone(this);
      sink.buildTotal_();
      return sink;
    },
    function addSinkToE(e, s) { e.add(s); },
    function addToE(e) {
      e.startContext({})
        .tag(this.ReactiveSectionedDetailView, { data$: this.displaySink$, showTitle: true })
      .endContext();
    }
  ]
});

foam.CLASS({
  package: 'foam.core.reflow.dashboard',
  name: 'DashboardScatterChartDAOAgent',
  extends: 'foam.core.reflow.AbstractSinkDAOAgent',

  requires: [
    'foam.core.reflow.dashboard.DashboardScatterSink',
    'foam.core.reflow.ReactiveSectionedDetailView'
  ],

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.core.reflow.dashboard.DashboardScatterSink',
      name: 'displaySink',
      hidden: true,
      // An empty field in the chart's form turns Run off.
      autoValidate: true,
      factory: function() { return this.DashboardScatterSink.create({}, this); }
    }
  ],

  methods: [
    function createSink() {
      // A new copy on every run: the flow runs this agent again when the
      // query or the data changes, and a reused sink would hold the old points too.
      return this.displaySink.clone(this);
    },
    function addSinkToE(e, s) { e.add(s); },
    function addToE(e) {
      e.startContext({})
        .tag(this.ReactiveSectionedDetailView, { data$: this.displaySink$, showTitle: true })
      .endContext();
    }
  ]
});

foam.CLASS({
  package: 'foam.core.reflow.dashboard',
  name: 'DashboardBubbleChartDAOAgent',
  extends: 'foam.core.reflow.dashboard.DashboardScatterChartDAOAgent',

  documentation: 'The scatter\'s agent with the bubble sink as its form.',

  requires: [
    'foam.core.reflow.dashboard.DashboardBubbleSink'
  ],

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.core.reflow.dashboard.DashboardBubbleSink',
      name: 'displaySink',
      hidden: true,
      // An empty field in the chart's form turns Run off.
      autoValidate: true,
      factory: function() { return this.DashboardBubbleSink.create({}, this); }
    }
  ]
});

foam.CLASS({
  package: 'foam.core.reflow.dashboard',
  name: 'DashboardRadarChartDAOAgent',
  extends: 'foam.core.reflow.AbstractSinkDAOAgent',

  requires: [
    'foam.core.reflow.dashboard.DashboardRadarSink',
    'foam.core.reflow.ReactiveSectionedDetailView',
    'foam.mlang.Constant'
  ],

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.core.reflow.dashboard.DashboardRadarSink',
      name: 'displaySink',
      hidden: true,
      // An empty field in the chart's form turns Run off.
      autoValidate: true,
      factory: function() { return this.DashboardRadarSink.create({}, this); }
    }
  ],

  methods: [
    function createSink() {
      // A new copy on every run: the flow runs this agent again when the
      // query or the data changes, and a reused sink would count twice.
      var sink = this.displaySink.clone(this);
      // With no Series Property every row goes into one polygon, grouped by
      // a constant, so the grouping below needs no second code path.
      if ( sink.hasDefaultValue('yFunc') ) sink.yFunc = this.Constant.create({ value: sink.DEFAULT_SERIES });
      // The form can read rows and cols before the fields are picked and
      // save them grouped by nothing; the run copy rebuilds both.
      sink.clearProperty('rows');
      sink.clearProperty('cols');
      sink.buildTotal_();
      return sink;
    },
    function addSinkToE(e, s) { e.add(s); },
    function addToE(e) {
      e.startContext({})
        .tag(this.ReactiveSectionedDetailView, { data$: this.displaySink$, showTitle: true })
      .endContext();
    }
  ]
});

foam.CLASS({
  package: 'foam.core.reflow.dashboard',
  name: 'DashboardHeatmapChartDAOAgent',
  extends: 'foam.core.reflow.AbstractSinkDAOAgent',

  requires: [
    'foam.core.reflow.dashboard.DashboardHeatmapSink',
    'foam.core.reflow.ReactiveSectionedDetailView'
  ],

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.core.reflow.dashboard.DashboardHeatmapSink',
      name: 'displaySink',
      hidden: true,
      // An empty field in the chart's form turns Run off.
      autoValidate: true,
      factory: function() { return this.DashboardHeatmapSink.create({}, this); }
    }
  ],

  methods: [
    function createSink() {
      // A new copy on every run: the flow runs this agent again when the
      // query or the data changes, and a reused sink would count twice.
      // rows and cols are built when first read, which a form can do before
      // the two fields are picked, so the copy drops them and rebuilds both.
      var sink = this.displaySink.clone(this);
      sink.clearProperty('rows');
      sink.clearProperty('cols');
      sink.buildTotal_();
      return sink;
    },
    function addSinkToE(e, s) { e.add(s); },
    function addToE(e) {
      e.startContext({})
        .tag(this.ReactiveSectionedDetailView, { data$: this.displaySink$, showTitle: true })
      .endContext();
    }
  ]
});
