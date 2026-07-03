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
    'foam.core.reflow.dashboard.ColorMappingMixin',
    'foam.core.reflow.dashboard.TimeSeriesGapFillingMixin',
    'foam.core.reflow.dashboard.ChartDisplayMixin'
  ],

  requires: [
    'foam.core.reflow.dashboard.DashboardBarSink',
    'foam.core.reflow.ReactiveSectionedDetailView'
  ],

  sections: [
    {
      name: 'dataConfig',
      title: 'Data Configuration',
      order: 1,
      collapsable: true,
      properties: ['prop', 'sink', 'topN', 'periodCount', 'includeOthers', 'sortOrder', 'othersLabel']
    },
    {
      name: 'barChart',
      title: 'Bar Chart Settings',
      order: 2,
      collapsable: true,
      properties: ['horizontal', 'barThickness', 'timeUnit', 'showGridLines']
    },
    {
      name: 'axisLabels',
      title: 'Axis Labels',
      order: 3,
      collapsable: true,
      properties: ['xAxisLabel', 'yAxisLabel']
    },
    {
      name: 'display',
      title: 'Display Options',
      order: 4,
      collapsable: true,
      properties: [ 'alignment', 'maintainAspectRatio', 'height', 'showLegend', 'legendPosition', 'showTooltips', 'showTooltipSum', 'animate', 'animationDuration']
    },
    {
      name: 'colors',
      title: 'Color Configuration',
      order: 5,
      collapsable: true,
      properties: ['colors']
    }
  ],

  properties: [
    {
      name: 'sink',
      view: {
        class: 'foam.core.reflow.SinkView',
        choice: 'foam.core.reflow.CountDAOAgent',
        disabledTypes: [ 'structure', 'format', 'chart' ]
      }
    },
    // Inherited from GroupByDAOAgent: prop, sink, groupLimit, sortOrder, includeOthers, othersLabel
    // Inherited from TimeSeriesGapFillingMixin: periodCount (visibility defined below)
    // Override topN visibility to hide when prop is a date (mutually exclusive with periodCount)
    {
      name: 'topN',
      visibility: function(prop) {
        // Hide topN when property is a date/time (use periodCount instead)
        var isDateProp = prop && prop.delegate &&
          (foam.lang.Date.isInstance(prop.delegate) || foam.lang.DateTime.isInstance(prop.delegate));
        return isDateProp ? foam.u2.DisplayMode.HIDDEN : foam.u2.DisplayMode.RW;
      }
    },
    // Define visibility for periodCount (from mixin)
    {
      name: 'periodCount',
      visibility: function(prop) {
        // Only show for date/time properties
        var isDateProp = prop && prop.delegate &&
          (foam.lang.Date.isInstance(prop.delegate) || foam.lang.DateTime.isInstance(prop.delegate));
        return isDateProp ? foam.u2.DisplayMode.RW : foam.u2.DisplayMode.HIDDEN;
      }
    },
    // From mixins: colors, chart display options
    {
      class: 'Enum',
      of: 'foam.core.reflow.dashboard.TimeUnit',
      name: 'timeUnit',
      label: 'Time Unit',
      value: 'DAY',
      section: 'barChart',

      help: 'Time unit for X-axis when using date/time properties',
      visibility: function(prop) {
        /// hidden for now (its not working due to our new propertyexprview returning values as strings instead of dates)
        return foam.u2.DisplayMode.HIDDEN;
        // return prop && (foam.lang.Date.isInstance(prop) || foam.lang.DateTime.isInstance(prop)) ?
        //   foam.u2.DisplayMode.RW :
        //   foam.u2.DisplayMode.HIDDEN;
      }
    },
    {
      class: 'Boolean',
      name: 'horizontal',
      label: 'Horizontal Bars',
      section: 'barChart',
      value: false
    },
    {
      class: 'Float',
      name: 'barThickness',
      label: 'Bar Thickness',
      section: 'barChart',
      help: 'Thickness of bars (0 = auto)'
    },
    {
      class: 'String',
      name: 'xAxisLabel',
      label: 'X-Axis Label',
      section: 'axisLabels'
    },
    {
      class: 'String',
      name: 'yAxisLabel',
      label: 'Y-Axis Label',
      section: 'axisLabels'
    },
    {
      class: 'Boolean',
      name: 'showGridLines',
      label: 'Show Grid Lines',
      section: 'barChart',
      value: true
    }
  ],

  methods: [
    function getDatePropertyForFiltering() {
      // For bar charts, the date property is 'prop'
      return this.prop;
    },

    function createSink() {
      // Apply date range filter if periodCount is enabled
      this.applyDateRangeFilter();

      // Create sink with GroupBy configuration inherited from parent
      // Use the sink from parent GroupByDAOAgent if provided, otherwise COUNT
      var valueSink = this.sink ? this.sink.createSink() : this.COUNT();

      var sink = this.DashboardBarSink.create({
        arg1: this.prop,
        arg2: valueSink,
        groupLimit: this.groupLimit,
        topN: this.topN,
        sortOrder: this.sortOrder,
        includeOthers: this.includeOthers,
        othersLabel: this.othersLabel,
        colors: this.colors,
        timeUnit: this.timeUnit,
        horizontal: this.horizontal,
        barThickness: this.barThickness,
        xAxisLabel: this.xAxisLabel,
        yAxisLabel: this.yAxisLabel,
        showGridLines: this.showGridLines,
        periodCount: this.periodCount,
        maintainAspectRatio: this.maintainAspectRatio,
        height: this.height,
        showLegend: this.showLegend,
        legendPosition: this.legendPosition,
        showTooltips: this.showTooltips,
        showTooltipSum: this.showTooltipSum,
        animate: this.animate,
        animationDuration: this.animationDuration,
        alignment: this.alignment
      });

      return sink;
    },
    
    function addSinkToE(e, s) {
      var self = this;
      // Add the sink once
      e.add(s);

      // Then update its properties reactively
      this.onDetach(this.dynamic(function(colors, horizontal, barThickness, xAxisLabel, yAxisLabel, showGridLines,
                                  periodCount, maintainAspectRatio, height, showLegend, legendPosition,
                                  showTooltips, showTooltipSum, animate, animationDuration, alignment) {
        s.colors = colors;
        s.horizontal = horizontal;
        s.barThickness = barThickness;
        s.xAxisLabel = xAxisLabel;
        s.yAxisLabel = yAxisLabel;
        s.showGridLines = showGridLines;
        s.periodCount = periodCount;
        s.maintainAspectRatio = maintainAspectRatio;
        s.height = height;
        s.showLegend = showLegend;
        s.legendPosition = legendPosition;
        s.showTooltips = showTooltips;
        s.showTooltipSum = showTooltipSum;
        s.animate = animate;
        s.animationDuration = animationDuration;
        s.alignment = alignment;

        // Force chart to update/redraw
        if ( s.updateChart ) s.updateChart();
       }));
    },
    
    function addToE(e) {
      e.startContext({data: this})
        .tag(this.ReactiveSectionedDetailView, {
          data: this,
          showTitle: true
        })
      .endContext();
    },
    
    function clone(subContext) {
      var clone = this.SUPER(subContext);
      clone.alignment$ = this.alignment$;
      clone.colors$ = this.colors$;
      clone.horizontal$ = this.horizontal$;
      clone.barThickness$ = this.barThickness$;
      clone.xAxisLabel$ = this.xAxisLabel$;
      clone.yAxisLabel$ = this.yAxisLabel$;
      clone.showGridLines$ = this.showGridLines$;
      clone.periodCount$ = this.periodCount$;
      clone.maintainAspectRatio$ = this.maintainAspectRatio$;
      clone.height$ = this.height$;
      clone.showLegend$ = this.showLegend$;
      clone.legendPosition$ = this.legendPosition$;
      clone.showTooltips$ = this.showTooltips$;
      clone.showTooltipSum$ = this.showTooltipSum$;
      clone.animate$ = this.animate$;
      clone.animationDuration$ = this.animationDuration$;
      return clone;
    }
  ]
});

foam.CLASS({
  package: 'foam.core.reflow.dashboard',
  name: 'DashboardStackedBarChartDAOAgent',
  extends: 'foam.core.reflow.GridByDAOAgent',
  mixins: [
    'foam.core.reflow.dashboard.ColorMappingMixin',
    'foam.core.reflow.dashboard.TimeSeriesGapFillingMixin',
    'foam.core.reflow.dashboard.ChartDisplayMixin'
  ],

  requires: [
    'foam.core.reflow.dashboard.DashboardStackedBarSink',
    'foam.core.reflow.ReactiveSectionedDetailView'
  ],

  sections: [
    {
      name: 'dataConfig',
      title: 'Data Configuration',
      order: 1,
      collapsable: true,
      properties: ['prop2', 'prop1', 'sink', 'periodCount', 'timeUnit']
    },
    {
      name: 'stackedBarChart',
      title: 'Stacked Bar Settings',
      order: 2,
      collapsable: true,
      properties: ['horizontal', 'showGridLines']
    },
    {
      name: 'axisLabels',
      title: 'Axis Labels',
      order: 3,
      collapsable: true,
      properties: ['xAxisLabel', 'yAxisLabel']
    },
    {
      name: 'display',
      title: 'Display Options',
      order: 4,
      collapsable: true,
      properties: [ 'alignment', 'maintainAspectRatio', 'height',  'showLegend', 'legendPosition', 'showTooltips', 'showTooltipSum', 'animate', 'animationDuration']
    },
    {
      name: 'interactivity',
      title: 'Interactivity',
      order: 5,
      collapsable: true,
      properties: ['onClickScript']
    },
    {
      name: 'colors',
      title: 'Color Configuration',
      order: 6,
      collapsable: true,
      properties: ['colors']
    }
  ],

  properties: [
    {
      name: 'prop2',
      label: "X Axis"
    },
    {
      name: 'prop1',
      label: "Stacked By"
    },
    {
      name: 'sink',
      view: {
        class: 'foam.core.reflow.SinkView',
        choice: 'foam.core.reflow.CountDAOAgent',
        disabledTypes: [ 'structure', 'format', 'chart' ]
      }
    },
    // Inherited from GridByDAOAgent: prop1 (yFunc), prop2 (xFunc), sink
    // Inherited from TimeSeriesGapFillingMixin: periodCount
    // Override periodCount visibility to check prop2 (X-axis) instead of prop
    {
      name: 'periodCount',
      visibility: function(prop2) {
        // For stacked charts, check prop2 (X-axis) for date properties
        var isDateProp = prop2 && prop2.delegate &&
          (foam.lang.Date.isInstance(prop2.delegate) || foam.lang.DateTime.isInstance(prop2.delegate));
        return isDateProp ? foam.u2.DisplayMode.RW : foam.u2.DisplayMode.HIDDEN;
      }
    },
    // From mixins: colors, chart display options
    {
      class: 'Enum',
      of: 'foam.core.reflow.dashboard.TimeUnit',
      name: 'timeUnit',
      label: 'Time Unit',
      value: 'DAY',
      help: 'Time unit for X-axis when using date/time properties',
      visibility: function(prop2) {
        /// hidden for now (its not working due to our new propertyexprview returning values as strings instead of dates)
        return foam.u2.DisplayMode.HIDDEN;
        // return prop2 && (foam.lang.Date.isInstance(prop2) || foam.lang.DateTime.isInstance(prop2)) ?
        //   foam.u2.DisplayMode.RW :
        //   foam.u2.DisplayMode.HIDDEN;
      }
    },
    {
      class: 'Boolean',
      name: 'horizontal',
      label: 'Horizontal Stacks',
      value: false
    },
    {
      class: 'String',
      name: 'xAxisLabel',
      label: 'X-Axis Label'
    },
    {
      class: 'String',
      name: 'yAxisLabel',
      label: 'Y-Axis Label'
    },
    {
      class: 'Boolean',
      name: 'showGridLines',
      label: 'Show Grid Lines',
      value: true
    },
    {
      class: 'Code',
      name: 'onClickScript',
      label: 'On Click Script',
      section: 'interactivity',
      help: 'Function expression invoked when a stack segment is clicked. Signature: (yValue, xValue, stackValue, x, y, absX, absY) => void'
    }
  ],

  methods: [
    function getDatePropertyForFiltering() {
      // For stacked bar charts, the date property is 'prop2' (X-axis)
      return this.prop2;
    },

    function createSink() {
      // Apply date range filter if periodCount is enabled
      this.applyDateRangeFilter();

      // Use the sink from parent GridByDAOAgent if provided, otherwise COUNT
      var valueSink = this.sink ? this.sink.createSink() : this.COUNT();

      return this.DashboardStackedBarSink.create({
        yFunc: this.prop1,
        xFunc: this.prop2,
        acc: valueSink,
        colors: this.colors,
        timeUnit: this.timeUnit,
        horizontal: this.horizontal,
        xAxisLabel: this.xAxisLabel,
        yAxisLabel: this.yAxisLabel,
        showGridLines: this.showGridLines,
        onClickScript: this.onClickScript,
        periodCount: this.periodCount,
        maintainAspectRatio: this.maintainAspectRatio,
        height: this.height,
        showLegend: this.showLegend,
        legendPosition: this.legendPosition,
        showTooltips: this.showTooltips,
        showTooltipSum: this.showTooltipSum,
        animate: this.animate,
        animationDuration: this.animationDuration,
        alignment: this.alignment
      });
    },
    
    function addSinkToE(e, s) {
      var self = this;
      // Add the sink once
      e.add(s);
      
      // Then update its properties reactively
      this.onDetach(this.dynamic(function(colors, horizontal, xAxisLabel, yAxisLabel, showGridLines,
                                  periodCount, maintainAspectRatio, height, showLegend, legendPosition,
                                  showTooltips, showTooltipSum, animate, animationDuration, alignment, onClickScript) {
        s.colors = colors;
        s.horizontal = horizontal;
        s.xAxisLabel = xAxisLabel;
        s.yAxisLabel = yAxisLabel;
        s.showGridLines = showGridLines;
        s.periodCount = periodCount;
        s.maintainAspectRatio = maintainAspectRatio;
        s.height = height;
        s.showLegend = showLegend;
        s.legendPosition = legendPosition;
        s.showTooltips = showTooltips;
        s.showTooltipSum = showTooltipSum;
        s.animate = animate;
        s.animationDuration = animationDuration;
        s.alignment = alignment;
        s.onClickScript = onClickScript;

        // Force chart to update/redraw
        if ( s.updateChart ) s.updateChart();
       }));
    },
    
    function addToE(e) {
      e.startContext({data: this})
        .tag(this.ReactiveSectionedDetailView, {
          data: this,
          showTitle: true
        })
      .endContext();
    },
    
    function clone(subContext) {
      var clone = this.SUPER(subContext);
      clone.alignment$ = this.alignment$;
      clone.colors$ = this.colors$;
      clone.horizontal$ = this.horizontal$;
      clone.xAxisLabel$ = this.xAxisLabel$;
      clone.yAxisLabel$ = this.yAxisLabel$;
      clone.showGridLines$ = this.showGridLines$;
      clone.periodCount$ = this.periodCount$;
      clone.maintainAspectRatio$ = this.maintainAspectRatio$;
      clone.height$ = this.height$;
      clone.showLegend$ = this.showLegend$;
      clone.legendPosition$ = this.legendPosition$;
      clone.showTooltips$ = this.showTooltips$;
      clone.showTooltipSum$ = this.showTooltipSum$;
      clone.animate$ = this.animate$;
      clone.animationDuration$ = this.animationDuration$;
      return clone;
    }
  ]
});

foam.CLASS({
  package: 'foam.core.reflow.dashboard',
  name: 'DashboardPieChartDAOAgent',
  extends: 'foam.core.reflow.GroupByDAOAgent',
  mixins: [
    'foam.core.reflow.dashboard.ColorMappingMixin',
    'foam.core.reflow.dashboard.ChartDisplayMixin'
  ],

  requires: [
    'foam.core.reflow.dashboard.DashboardPieSink',
    'foam.core.reflow.ReactiveSectionedDetailView'
  ],

  sections: [
    {
      name: 'dataConfig',
      title: 'Data Configuration',
      order: 1,
      collapsable: true,
      properties: ['prop', 'sink', 'topN', 'includeOthers', 'sortOrder', 'othersLabel']
    },
    {
      name: 'pieChart',
      title: 'Pie Chart Settings',
      order: 2,
      collapsable: true,
      properties: ['showPercentages', 'cutoutPercentage', 'clockwise', 'rotation', 'disableLegendClick']
    },
    {
      name: 'display',
      title: 'Display Options',
      order: 3,
      collapsable: true,
      properties: [ 'alignment', 'maintainAspectRatio', 'height',  'showLegend', 'legendPosition', 'legendMinWidthPercent', 'legendMaxWidthPercent', 'showTooltips', 'showTooltipSum', 'animate', 'animationDuration', 'emptyValueMessage']
    },
    {
      name: 'colors',
      title: 'Color Configuration',
      order: 4,
      collapsable: true,
      properties: ['colors']
    }
  ],

  properties: [
    {
      name: 'sink',
      view: {
        class: 'foam.core.reflow.SinkView',
        choice: 'foam.core.reflow.CountDAOAgent',
        disabledTypes: [ 'structure', 'format', 'chart' ]
      }
    },
    // Inherited from GroupByDAOAgent: prop, sink, groupLimit, sortOrder, includeOthers, othersLabel
    // From mixins: colors, chart display options
    {
      class: 'Boolean',
      name: 'showPercentages',
      label: 'Show Percentages',
      value: false
    },
    {
      class: 'Float',
      name: 'cutoutPercentage',
      label: 'Cutout %',
      value: 0,
      view: {
        class: 'foam.u2.RangeView',
        minValue: 0,
        maxValue: 100,
        step: 1,
        onKey: true
      },
      help: 'For donut effect (0-100)'
    },
    {
      class: 'Boolean',
      name: 'clockwise',
      label: 'Clockwise',
      value: true
    },
    {
      class: 'Float',
      name: 'rotation',
      label: 'Rotation Angle',
      value: -90,
      view: {
        class: 'foam.u2.RangeView',
        minValue: -180,
        maxValue: 180,
        step: 1,
        onKey: true
      },
      help: 'Starting angle in degrees (-180 to 180)'
    },
    {
      class: 'String',
      name: 'emptyValueMessage',
      help: 'Message to display when there is no data',
      value: 'No data available'
    },
    {
      class: 'Boolean',
      name: 'disableLegendClick',
      label: 'Disable Legend Click',
      help: 'Prevent clicking legend items from toggling slice visibility'
    },
    {
      class: 'Int',
      name: 'legendMinWidthPercent',
      label: 'Legend Min Width (%)',
      help: 'Forces the legend to be at least this percentage (0-100) of container width by padding the widest label with trailing non-breaking spaces. Short legends grow; unboundedly long labels also wrap at this width.'
    },
    {
      class: 'Int',
      name: 'legendMaxWidthPercent',
      label: 'Legend Max Width (%)',
      help: 'Caps the legend at this percentage (0-100) of container width and word-wraps long labels at the cap. Set min = max for an exact fixed-width legend.'
    },
  ],

  methods: [
    
    function createSink() {
      // Create sink with GroupBy configuration inherited from parent
      // Use the sink from parent GroupByDAOAgent if provided, otherwise COUNT
      var valueSink = this.sink ? this.sink.createSink() : this.COUNT();
      
      // Default to DESC sort order for pie charts to show highest values first
      var sink = this.DashboardPieSink.create({
        arg1: this.prop,
        arg2: valueSink,
        groupLimit: this.groupLimit,
        topN: this.topN,
        sortOrder: this.sortOrder,
        includeOthers: this.includeOthers,
        othersLabel: this.othersLabel,
        colors: this.colors,
        showPercentages: this.showPercentages,
        cutoutPercentage: this.cutoutPercentage,
        clockwise: this.clockwise,
        rotation: this.rotation,
        maintainAspectRatio: this.maintainAspectRatio,
        height: this.height,
        
        showLegend: this.showLegend,
        legendPosition: this.legendPosition,
        showTooltips: this.showTooltips,
        showTooltipSum: this.showTooltipSum,
        animate: this.animate,
        animationDuration: this.animationDuration,
        alignment: this.alignment,
        legendMinWidthPercent: this.legendMinWidthPercent,
        legendMaxWidthPercent: this.legendMaxWidthPercent,
        emptyValueMessage: this.emptyValueMessage,
        disableLegendClick: this.disableLegendClick
      });

      return sink;
    },
    function addSinkToE(e, s) {
      var self = this;
      // Add the sink once
      e.add(s);
      
      // Then update its properties reactively
      this.onDetach(this.dynamic(function(cutoutPercentage, rotation, colors, showPercentages, clockwise,
                                  maintainAspectRatio, height, showLegend, legendPosition,
                                  showTooltips, showTooltipSum, animate, animationDuration, alignment, legendMinWidthPercent, legendMaxWidthPercent, disableLegendClick) {
        s.cutoutPercentage = cutoutPercentage;
        s.rotation = rotation;
        s.colors = colors;
        s.showPercentages = showPercentages;
        s.clockwise = clockwise;
        s.maintainAspectRatio = maintainAspectRatio;
        s.height = height;
        s.showLegend = showLegend;
        s.legendPosition = legendPosition;
        s.showTooltips = showTooltips;
        s.showTooltipSum = showTooltipSum;
        s.animate = animate;
        s.animationDuration = animationDuration;
        s.alignment = alignment;
        s.legendMinWidthPercent = legendMinWidthPercent;
        s.legendMaxWidthPercent = legendMaxWidthPercent;
        s.disableLegendClick = disableLegendClick;

        // Force chart to update/redraw
        if ( s.updateChart ) s.updateChart();
       }));
    },
    function addToE(e) {
      e.startContext({data: this})
        .tag(this.ReactiveSectionedDetailView, {
          data: this,
          showTitle: true
        })
      .endContext();
    },
    function clone(subContext) {
      var clone = this.SUPER(subContext);
      clone.alignment$ = this.alignment$;
      clone.cutoutPercentage$ = this.cutoutPercentage$;
      clone.rotation$ = this.rotation$;
      clone.colors$ = this.colors$;
      clone.showPercentages$ = this.showPercentages$;
      clone.clockwise$ = this.clockwise$;
      clone.maintainAspectRatio$ = this.maintainAspectRatio$;
      clone.height$ = this.height$;

      clone.showLegend$ = this.showLegend$;
      clone.legendPosition$ = this.legendPosition$;
      clone.showTooltips$ = this.showTooltips$;
      clone.showTooltipSum$ = this.showTooltipSum$;
      clone.animate$ = this.animate$;
      clone.animationDuration$ = this.animationDuration$;
      clone.disableLegendClick$ = this.disableLegendClick$;
      clone.legendMinWidthPercent$ = this.legendMinWidthPercent$;
      clone.legendMaxWidthPercent$ = this.legendMaxWidthPercent$;
      return clone;
    }
  ]
});


// DashboardDonutChartDAOAgent removed - use DashboardPieChartDAOAgent with cutoutPercentage instead

foam.CLASS({
  package: 'foam.core.reflow.dashboard',
  name: 'DashboardLineChartDAOAgent',
  extends: 'foam.core.reflow.AbstractSinkDAOAgent',
  mixins: [
    'foam.core.reflow.dashboard.ColorMappingMixin',
    'foam.core.reflow.dashboard.ChartDisplayMixin',
    'foam.core.reflow.dashboard.TimeSeriesGapFillingMixin'
  ],

  requires: [
    'foam.core.reflow.dashboard.DashboardLineSink',
    'foam.core.reflow.dashboard.DashboardMultiLineSink',
    'foam.core.reflow.dashboard.TimeUnit',
    'foam.core.reflow.ReactiveSectionedDetailView'
  ],

  sections: [
    {
      name: 'dataConfig',
      title: 'Data Configuration',
      order: 1,
      collapsable: true,
      properties: ['xProp', 'yProp', 'groupBy', 'aggregationSink', 'timeUnit']
    },
    {
      name: 'lineChart',
      title: 'Line Chart Settings',
      order: 2,
      collapsable: true,
      properties: ['fill', 'tension', 'stepped', 'showPoints', 'pointRadius', 'showGridLines', 'periodCount']
    },
    {
      name: 'axisLabels',
      title: 'Axis Labels',
      order: 3,
      collapsable: true,
      properties: ['xAxisLabel', 'yAxisLabel']
    },
    {
      name: 'display',
      title: 'Display Options',
      order: 4,
      collapsable: true,
      properties: [ 'alignment', 'maintainAspectRatio', 'height',  'showLegend', 'legendPosition', 'showTooltips', 'showTooltipSum', 'animate', 'animationDuration']
    },
    {
      name: 'colors',
      title: 'Color Configuration',
      order: 5,
      collapsable: true,
      properties: ['colors']
    }
  ],

  properties: [
    {
      name: 'xProp',
      label: 'X Property',
      view: function(_, X) {
        return { 
          class: 'foam.core.reflow.PropertyExprView', 
          forCls: X.data.dao.of
        };
      }
    },
    {
      name: 'yProp', 
      label: 'Y Property',
      view: function(_, X) {
        return { 
          class: 'foam.core.reflow.PropertyChoiceView', 
          forCls: X.data.dao.of
        };
      }
    },
    {
      name: 'groupBy',
      label: 'Group By (Multiple Lines)',
      help: 'Optional: Group data by this property to create multiple lines',
      view: function(_, X) {
        return { 
          class: 'foam.core.reflow.PropertyChoiceView', 
          forCls: X.data.dao.of
        };
      }
    },
    {
      name: 'aggregationSink',
      label: 'Aggregation',
      view: { class: 'foam.core.reflow.SinkView', choice:  'foam.core.reflow.CountDAOAgent' },
      help: 'How to aggregate values when multiple records have the same X-value',

    },
    // Inherited from TimeSeriesGapFillingMixin: periodCount (visibility defined below)
    // Define visibility for periodCount (from mixin)
    {
      name: 'periodCount',
      visibility: function(xProp) {
        // Only show for date/time properties on X-axis
        var isDateProp = xProp && xProp.delegate &&
          (foam.lang.Date.isInstance(xProp.delegate) || foam.lang.DateTime.isInstance(xProp.delegate));
        return isDateProp ? foam.u2.DisplayMode.RW : foam.u2.DisplayMode.HIDDEN;
      }
    },
    {
      class: 'Enum',
      of: 'foam.core.reflow.dashboard.TimeUnit',
      name: 'timeUnit',
      label: 'Time Unit',
      value: 'DAY',
      help: 'Time unit for X-axis when using date/time properties',
      visibility: function(xProp) {
        // hidden for now (its not working due to our new propertyexprview returning values as strings instead of dates)
        return foam.u2.DisplayMode.HIDDEN;
        // return prop2 && (foam.lang.Date.isInstance(prop2) || foam.lang.DateTime.isInstance(prop2)) ? 
        //   foam.u2.DisplayMode.RW : 
        //   foam.u2.DisplayMode.HIDDEN;
      }
    },
    {
      class: 'String',
      name: 'xAxisLabel',
      label: 'X-Axis Label'
    },
    {
      class: 'String',
      name: 'yAxisLabel',
      label: 'Y-Axis Label'
    },
    {
      class: 'Boolean',
      name: 'fill',
      label: 'Fill Area',
      value: false
    },
    {
      class: 'Float',
      name: 'tension',
      label: 'Line Tension',
      value: 0.1,
      help: 'Bezier curve tension (0 = straight lines)'
    },
    {
      class: 'Boolean',
      name: 'stepped',
      label: 'Stepped Line',
      value: false
    },
    {
      class: 'Boolean',
      name: 'showPoints',
      label: 'Show Points',
      value: true
    },
    {
      class: 'Float',
      name: 'pointRadius',
      label: 'Point Radius',
      value: 3,
      visibility: function(showPoints) {
        return showPoints ? foam.u2.DisplayMode.RW : foam.u2.DisplayMode.HIDDEN;
      }
    },
    {
      class: 'Boolean',
      name: 'showGridLines',
      label: 'Show Grid Lines',
      value: true
    }
  ],

  methods: [
    function getDatePropertyForFiltering() {
      // For line charts, the date property is 'xProp'
      return this.xProp;
    },

    function createSink() {
      // Apply date range filter if periodCount is enabled
      this.applyDateRangeFilter();

      if ( ! this.xProp ) {
        return this.ArraySink.create();
      }

      // Use the aggregationSink if provided, otherwise COUNT (like StackedBar does)
      var valueSink = this.aggregationSink ? this.aggregationSink.createSink() : this.COUNT();
      
      // Choose sink based on whether groupBy is set
      if ( this.groupBy ) {
        // Multi-line chart: Use GridBy-based sink
        return this.DashboardMultiLineSink.create({
          xFunc: this.xProp,        // x-axis grouping
          yFunc: this.groupBy,      // line grouping
          acc: valueSink,          // aggregation sink (defaulted to COUNT)
          timeUnit: this.timeUnit,
          colors: this.colors,
          xAxisLabel: this.xAxisLabel,
          yAxisLabel: this.yAxisLabel,
          fill: this.fill,
          tension: this.tension,
          stepped: this.stepped,
          showPoints: this.showPoints,
          pointRadius: this.pointRadius,
          showGridLines: this.showGridLines,
          maintainAspectRatio: this.maintainAspectRatio,
          height: this.height,
          showLegend: this.showLegend,
          legendPosition: this.legendPosition,
          showTooltips: this.showTooltips,
          showTooltipSum: this.showTooltipSum,
          animate: this.animate,
          animationDuration: this.animationDuration,
          alignment: this.alignment,
          periodCount: this.periodCount
        });
      } else {
        // Single-line chart: Use GroupBy-based sink
        return this.DashboardLineSink.create({
          arg1: this.xProp,         // x-axis grouping
          arg2: valueSink,         // aggregation sink (defaulted to COUNT)
          timeUnit: this.timeUnit,
          colors: this.colors,
          xAxisLabel: this.xAxisLabel,
          yAxisLabel: this.yAxisLabel,
          fill: this.fill,
          tension: this.tension,
          stepped: this.stepped,
          showPoints: this.showPoints,
          pointRadius: this.pointRadius,
          showGridLines: this.showGridLines,
          maintainAspectRatio: this.maintainAspectRatio,
          height: this.height,
          showLegend: this.showLegend,
          legendPosition: this.legendPosition,
          showTooltips: this.showTooltips,
          showTooltipSum: this.showTooltipSum,
          animate: this.animate,
          animationDuration: this.animationDuration,
          alignment: this.alignment,
          periodCount: this.periodCount
        });
      }
    },

    function value(s) {
      return s;
    },
    
    function addSinkToE(e, s) {
      var self = this;
      // Add the sink once
      e.add(s);
      
      // Then update its properties reactively
      this.onDetach(this.dynamic(function(colors, xAxisLabel, yAxisLabel, fill, tension, stepped, showPoints, pointRadius, showGridLines,
                                  maintainAspectRatio, height, showLegend, legendPosition,
                                  showTooltips, showTooltipSum, animate, animationDuration, alignment,
                                  periodCount) {
        s.colors = colors;
        s.xAxisLabel = xAxisLabel;
        s.yAxisLabel = yAxisLabel;
        s.fill = fill;
        s.tension = tension;
        s.stepped = stepped;
        s.showPoints = showPoints;
        s.pointRadius = pointRadius;
        s.showGridLines = showGridLines;
        s.maintainAspectRatio = maintainAspectRatio;
        s.height = height;
        s.showLegend = showLegend;
        s.legendPosition = legendPosition;
        s.showTooltips = showTooltips;
        s.showTooltipSum = showTooltipSum;
        s.animate = animate;
        s.animationDuration = animationDuration;
        s.alignment = alignment;
        s.periodCount = periodCount;
        
        // Force chart to update/redraw
        if ( s.updateChart ) s.updateChart();
       }));
    },
    
    function addToE(e) {
      e.startContext({data: this})
        .start('div')
          .style({
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: this.alignment$.map(function(a) { return a.alignmentStyle; }),
            textAlign: this.alignment$.map(function(a) { return a.textAlign; })
          })
          .tag(this.ReactiveSectionedDetailView, {
            data: this,
            showTitle: true
          })
        .end()
      .endContext();
    },
    
    function clone(subContext) {
      var clone = this.SUPER(subContext);
      clone.alignment$ = this.alignment$;
      clone.colors$ = this.colors$;
      clone.xAxisLabel$ = this.xAxisLabel$;
      clone.yAxisLabel$ = this.yAxisLabel$;
      clone.fill$ = this.fill$;
      clone.tension$ = this.tension$;
      clone.stepped$ = this.stepped$;
      clone.showPoints$ = this.showPoints$;
      clone.pointRadius$ = this.pointRadius$;
      clone.showGridLines$ = this.showGridLines$;
      clone.periodCount$ = this.periodCount$;
      clone.maintainAspectRatio$ = this.maintainAspectRatio$;
      clone.height$ = this.height$;
      clone.showLegend$ = this.showLegend$;
      clone.legendPosition$ = this.legendPosition$;
      clone.showTooltips$ = this.showTooltips$;
      clone.showTooltipSum$ = this.showTooltipSum$;
      clone.animate$ = this.animate$;
      clone.animationDuration$ = this.animationDuration$;
      return clone;
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
    'foam.core.reflow.dashboard.ColorMappingMixin',
    'foam.core.reflow.dashboard.TimeSeriesGapFillingMixin',
    'foam.core.reflow.dashboard.ChartDisplayMixin'
  ],

  requires: [
    'foam.core.reflow.dashboard.DashboardCalendarSink',
    'foam.core.reflow.ReactiveSectionedDetailView'
  ],

  sections: [
    {
      name: 'dataConfig',
      title: 'Data Configuration',
      order: 1,
      collapsable: true,
      properties: ['prop', 'categoryProp', 'sink', 'showAllData', 'periodCount']
    },
    {
      name: 'display',
      title: 'Display Options',
      order: 2,
      collapsable: true,
      properties: [ 'alignment', 'maintainAspectRatio', 'height', 'showLegend', 'legendPosition', 'colors']
    }
  ],

  properties: [
    {
      name: 'prop',
      label: 'Date Property',
      view: function(_, X) {
        return {
          class: 'foam.core.reflow.PropertyExprView',
          forCls: X.data.dao.of
        };
      }
    },
    {
      name: 'categoryProp',
      label: 'Category Property',
      view: function(_, X) {
        return {
          class: 'foam.core.reflow.PropertyChoiceView',
          forCls: X.data.dao.of
        };
      }
    },
    {
      name: 'sink',
      view: {
        class: 'foam.core.reflow.SinkView',
        choice: 'foam.core.reflow.CountDAOAgent',
        disabledTypes: [ 'structure', 'format', 'chart' ]
      }
    },
    {
      class: 'Boolean',
      name: 'showAllData',
      label: 'Show All Data',
      help: 'When enabled, the calendar includes every record regardless of date. Disable to limit to the last N days configured by Periods.'
    },
    {
      name: 'periodCount',
      label: 'Periods',
      value: 30,
      help: 'How many days to show from today. Ignored when Show All Data is enabled.',
      visibility: function(showAllData) {
        return showAllData ? foam.u2.DisplayMode.HIDDEN : foam.u2.DisplayMode.RW;
      }
    }
  ],

  methods: [
    function getDatePropertyForFiltering() {
      return this.prop;
    },
    function createSink() {
      // Skip the date-range filter when showAllData is set so the
      // calendar renders every record in the DAO regardless of date.
      if ( ! this.showAllData ) {
        this.applyDateRangeFilter && this.applyDateRangeFilter();
      }
      var valueSink = this.sink ? this.sink.createSink() : this.COUNT();
      return this.DashboardCalendarSink.create({
        dateProp: this.prop,
        categoryProp: this.categoryProp,
        valueSink: valueSink,
        colors: this.colors,
        showLegend: this.showLegend,
        legendPosition: this.legendPosition,
        maintainAspectRatio: this.maintainAspectRatio,
        height: this.height,
        alignment: this.alignment,
        animate: this.animate,
        animationDuration: this.animationDuration,
        periodCount: this.periodCount
      });
    },
    function addSinkToE(e, s) {
      var self = this;
      e.add(s);
      // Live binding like other charts
      this.onDetach(this.dynamic(function(colors, showLegend, legendPosition, maintainAspectRatio, height, alignment, animate, animationDuration) {
        s.colors = colors;
        s.showLegend = showLegend;
        s.legendPosition = legendPosition;
        s.maintainAspectRatio = maintainAspectRatio;
        s.height = height;
        s.alignment = alignment;
        s.animate = animate;
        s.animationDuration = animationDuration;
        if ( s.updateChart ) s.updateChart();
      }));
    },
    function addToE(e) {
      e.startContext({data: this})
        .tag(this.ReactiveSectionedDetailView, {
          data: this,
          showTitle: true
        })
      .endContext();
    }
  ]
});
