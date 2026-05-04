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
    // Note: Subclasses must implement getDatePropertyForFiltering() to return the appropriate date property
    // Bar charts: return this.prop
    // Stacked bar charts: return this.prop2 (X-axis)
    // Line charts: return this.xProp

    function getPeriodCalculators_() {
      // Configuration map for period calculations by date expression type
      // Note: This was originally a property with factory/value, but both approaches
      // were returning empty strings instead of the array, so using a method instead
      return [
        {
          // Weekly periods
          exprClassNames: ['foam.mlang.expr.DateToWeekExpr'],
          calculate: function(periodCount) {
            var minDate = new Date();
            var maxDate = new Date();
            // Subtract (periodCount - 1) weeks, set to start of week (Monday)
            minDate.setDate(minDate.getDate() - ((periodCount - 1) * 7));
            var dayOfWeek = minDate.getDay();
            var daysToMonday = (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
            minDate.setDate(minDate.getDate() - daysToMonday);
            minDate.setHours(0, 0, 0, 0);
            // maxDate: end of current week (Sunday)
            var currentDayOfWeek = maxDate.getDay();
            var daysToSunday = (currentDayOfWeek === 0 ? 0 : 7 - currentDayOfWeek);
            maxDate.setDate(maxDate.getDate() + daysToSunday);
            maxDate.setHours(23, 59, 59, 999);
            return { minDate: minDate, maxDate: maxDate };
          }
        },
        {
          // Quarterly periods
          exprClassNames: ['foam.mlang.expr.DateToQuarterExpr'],
          calculate: function(periodCount) {
            var minDate = new Date();
            var maxDate = new Date();
            // Subtract (periodCount - 1) quarters, set to start of quarter
            minDate.setMonth(minDate.getMonth() - ((periodCount - 1) * 3));
            var quarter = Math.floor(minDate.getMonth() / 3);
            minDate.setMonth(quarter * 3, 1);
            minDate.setHours(0, 0, 0, 0);
            // maxDate: end of current quarter
            var currentQuarter = Math.floor(maxDate.getMonth() / 3);
            maxDate.setMonth((currentQuarter + 1) * 3, 0);
            maxDate.setHours(23, 59, 59, 999);
            return { minDate: minDate, maxDate: maxDate };
          }
        },
        {
          // Monthly periods
          exprClassNames: ['foam.mlang.expr.DateToYYYYMMExpr'],
          calculate: function(periodCount) {
            var minDate = new Date();
            var maxDate = new Date();
            // Subtract (periodCount - 1) months, set to start of month
            minDate.setMonth(minDate.getMonth() - (periodCount - 1), 1);
            minDate.setHours(0, 0, 0, 0);
            // maxDate: end of current month
            maxDate.setMonth(maxDate.getMonth() + 1, 0);
            maxDate.setHours(23, 59, 59, 999);
            return { minDate: minDate, maxDate: maxDate };
          }
        },
        {
          // Yearly periods
          exprClassNames: ['foam.mlang.expr.DateToYYYYExpr'],
          calculate: function(periodCount) {
            var minDate = new Date();
            var maxDate = new Date();
            // Subtract (periodCount - 1) years, set to start of year
            minDate.setFullYear(minDate.getFullYear() - (periodCount - 1), 0, 1);
            minDate.setHours(0, 0, 0, 0);
            // maxDate: end of current year
            maxDate.setFullYear(maxDate.getFullYear(), 11, 31);
            maxDate.setHours(23, 59, 59, 999);
            return { minDate: minDate, maxDate: maxDate };
          }
        },
        {
          // Daily periods (handles both YYYYMMDD and DayOfYear)
          exprClassNames: ['foam.mlang.expr.DateToYYYYMMDDExpr', 'foam.mlang.expr.DateToDayOfYearExpr'],
          calculate: function(periodCount) {
            var minDate = new Date();
            var maxDate = new Date();
            // Subtract (periodCount - 1) days, set to start of day
            minDate.setDate(minDate.getDate() - (periodCount - 1));
            minDate.setHours(0, 0, 0, 0);
            // maxDate: end of current day
            maxDate.setHours(23, 59, 59, 999);
            return { minDate: minDate, maxDate: maxDate };
          }
        }
      ];
    },

    function getPeriodCalculator_(dateProp) {
      // Find matching calculator from configuration
      var calculators = this.getPeriodCalculators_();
      for ( var i = 0; i < calculators.length; i++ ) {
        var config = calculators[i];

        for ( var j = 0; j < config.exprClassNames.length; j++ ) {
          var exprClass = foam.lookup(config.exprClassNames[j]);
          if ( exprClass && exprClass.isInstance(dateProp) ) {
            return config.calculate;
          }
        }
      }
      return null;
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
    'foam.core.reflow.dashboard.LegendPosition',
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
      of: 'foam.core.reflow.dashboard.LegendPosition',
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
      factory: function() { return this.DashboardBarSink.create({}, this); }
    },
    // Inherited DAO-layer props → forward to displaySink
    { name: 'prop', hidden: true, transient: true,
      postSet: function(o, n) { this.displaySink.arg1 = n; } },
    { name: 'sink', hidden: true, transient: true,
      postSet: function(o, n) {
        if ( n && n.createSink ) this.displaySink.arg2 = n.createSink();
      } },
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
      return this.displaySink;
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
      factory: function() { return this.DashboardStackedBarSink.create({}, this); }
    },
    // Inherited GridByDAOAgent DAO-layer props → hidden forwarders
    { name: 'prop2', hidden: true, transient: true,
      postSet: function(o, n) { this.displaySink.xFunc = n; } },
    { name: 'prop1', hidden: true, transient: true,
      postSet: function(o, n) { this.displaySink.yFunc = n; } },
    { name: 'sink', hidden: true, transient: true,
      postSet: function(o, n) {
        if ( n && n.createSink ) this.displaySink.acc = n.createSink();
      } },
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
      return this.displaySink;
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
      factory: function() { return this.DashboardPieSink.create({}, this); }
    },
    // Inherited DAO-layer props → hidden back-compat forwarders to displaySink
    { name: 'prop', hidden: true, transient: true,
      postSet: function(o, n) { this.displaySink.arg1 = n; } },
    { name: 'sink', hidden: true, transient: true,
      postSet: function(o, n) {
        if ( n && n.createSink ) this.displaySink.arg2 = n.createSink();
      } },
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
    function createSink() { return this.displaySink; },
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
      factory: function() { return this.DashboardLineSink.create({}, this); }
    },
    // Line-specific DAO-layer props → hidden forwarders. Note: groupBy routes through
    // createSink() swap (Line ↔ MultiLine), so keep postSet on local field only.
    { name: 'xProp', hidden: true, transient: true,
      postSet: function(o, n) {
        if ( this.DashboardMultiLineSink.isInstance(this.displaySink) ) {
          this.displaySink.xFunc = n;
        } else {
          this.displaySink.arg1 = n;
        }
      } },
    { name: 'yProp', hidden: true, transient: true },
    { name: 'groupBy', hidden: true, transient: true },
    { name: 'aggregationSink', hidden: true, transient: true,
      postSet: function(o, n) {
        if ( ! n || ! n.createSink ) return;
        var sink = n.createSink();
        if ( this.DashboardMultiLineSink.isInstance(this.displaySink) ) {
          this.displaySink.acc = sink;
        } else {
          this.displaySink.arg2 = sink;
        }
      } },
    // AbstractSinkDAOAgent inherits `sink` — map it to the aggregation slot too
    { name: 'sink', hidden: true, transient: true,
      postSet: function(o, n) {
        if ( ! n || ! n.createSink ) return;
        var sink = n.createSink();
        if ( this.DashboardMultiLineSink.isInstance(this.displaySink) ) {
          this.displaySink.acc = sink;
        } else {
          this.displaySink.arg2 = sink;
        }
      } },
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
      setter: function(v) { this.displaySink.animationDuration = v; } }
  ],

  methods: [
    function getDatePropertyForFiltering() { return this.xProp; },

    function init() {
      this.SUPER();
      var self = this;
      if ( this.periodCount ) self.displaySink.periodCount = this.periodCount;
      this.onDetach(this.periodCount$.sub(function() {
        self.displaySink.periodCount = self.periodCount;
      }));
    },

    function createSink() {
      this.applyDateRangeFilter();
      if ( ! this.xProp ) return this.ArraySink.create();

      var wantMulti = !! this.groupBy;
      var isMulti   = this.DashboardMultiLineSink.isInstance(this.displaySink);

      if ( wantMulti !== isMulti ) {
        var old = this.displaySink;
        var next = wantMulti
          ? this.DashboardMultiLineSink.create({}, this)
          : this.DashboardLineSink.create({}, this);
        [ 'periodCount', 'timeUnit', 'xAxisLabel', 'yAxisLabel', 'fill', 'tension', 'stepped',
          'showPoints', 'pointRadius', 'showGridLines', 'colors', 'alignment', 'maintainAspectRatio',
          'height', 'showLegend', 'legendPosition', 'showTooltips', 'showTooltipSum',
          'animate', 'animationDuration' ].forEach(function(p) {
          if ( old && old[p] !== undefined ) next[p] = old[p];
        });
        this.displaySink = next;
      }

      if ( this.DashboardMultiLineSink.isInstance(this.displaySink) ) {
        this.displaySink.xFunc = this.xProp;
        this.displaySink.yFunc = this.groupBy;
      } else {
        this.displaySink.arg1 = this.xProp;
      }
      return this.displaySink;
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
      factory: function() { return this.DashboardCalendarSink.create({ periodCount: 30 }, this); }
    },
    // Inherited DAO-layer props → hidden forwarders
    { name: 'prop', hidden: true, transient: true,
      postSet: function(o, n) { this.displaySink.dateProp = n; } },
    { name: 'categoryProp', hidden: true, transient: true,
      postSet: function(o, n) { this.displaySink.categoryProp = n; } },
    { name: 'sink', hidden: true, transient: true,
      postSet: function(o, n) {
        if ( n && n.createSink ) this.displaySink.valueSink = n.createSink();
      } },
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
      return this.displaySink;
    },
    function addSinkToE(e, s) { e.add(s); },
    function addToE(e) {
      e.startContext({})
        .tag(this.ReactiveSectionedDetailView, { data$: this.displaySink$, showTitle: true })
      .endContext();
    }
  ]
});
