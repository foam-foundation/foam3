/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

/**
 * Dashboard Sink Classes for FLOW Integration
 *
 * These sinks follow the same pattern as foam.u2.mlang.Pie - they extend
 * GroupBy/GridBy and render charts using expression properties and toE/addToE methods.
 */

foam.CLASS({
  package: 'foam.core.reflow.dashboard',
  name: 'TimeSeriesGapFillingSinkMixin',

  documentation: 'Mixin for sinks that provides time series period range display functionality',

  properties: [
    {
      class: 'Int',
      name: 'periodCount',
      value: 0,
      help: 'Number of periods to display from today backwards (e.g., 12 for last 12 months). Set to 0 to show only existing data.'
    }
  ],

  methods: [
    function fillTimeGapKeys(existingKeys, groups, periods, prop) {
      var dk    = foam.core.reflow.dashboard.DateKeys;
      var entry = dk.entryFor(prop);

      // Not a date grouping we know how to step through.
      if ( ! entry || ! prop.delegate ) return existingKeys;

      var range = entry.calculate(periods);
      var end   = range.maxDate.getTime();
      var d     = entry.periodStart(range.minDate);

      // Render each period's key with the expression itself, so the
      // synthesized keys are guaranteed to match the real ones.
      var stub = {};
      var name = prop.delegate.name;
      var keys = [], seen = {};

      for ( var guard = 0; guard < 5000 && d.getTime() <= end; guard++ ) {
        stub[name] = d;
        var k = prop.f(stub);
        if ( k !== '' && ! seen[k] ) { seen[k] = true; keys.push(k); }

        var nextD = entry.next(d);
        if ( nextD.getTime() <= d.getTime() ) break;   // never spin
        d = nextD;
      }

      // Keep real data that falls outside the computed window.
      existingKeys.forEach(function(k) { if ( ! seen[k] ) keys.push(k); });

      return keys.sort();
    }
  ]
});

foam.CLASS({
  package: 'foam.core.reflow.dashboard',
  name: 'DashboardBarSink',
  extends: 'foam.mlang.sink.TopNGroupBy',
  mixins: [
    'foam.core.reflow.dashboard.TimeSeriesGapFillingSinkMixin',
    'foam.core.reflow.dashboard.ChartDisplayMixin',
    'foam.core.reflow.dashboard.ColorMappingMixin'
  ],

  requires: [
    'foam.u2.chart.BarChart',
    'foam.u2.chart.TimeScale'
  ],

  sections: [
    { name: 'dataConfig', title: 'Data Configuration', order: 0, collapsable: true,
      properties: ['arg1', 'aggregation', 'topN', 'includeOthers', 'sortOrder', 'othersLabel', 'periodCount'] },
    { name: 'chartSettings', title: 'Bar Chart Settings', order: 1, collapsable: true,
      properties: ['horizontal', 'barThickness', 'timeUnit', 'showGridLines', 'datasetLabel'] },
    { name: 'axisLabels', title: 'Axis Labels', order: 2, collapsable: true,
      properties: ['xAxisLabel', 'yAxisLabel'] },
    { name: 'displayOptions', title: 'Display', order: 3, collapsable: true,
      properties: ['alignment', 'height', 'showLegend', 'legendPosition', 'showTooltips', 'showTooltipSum', 'animate', 'animationDuration'] },
    { name: 'colorConfig', title: 'Colors', order: 4, collapsable: true,
      properties: ['colors'] }
  ],

  properties: [
    { class: 'foam.core.reflow.dashboard.ChartFieldProperty', name: 'arg1', label: 'Property', required: true },
    {
      // An FObjectProperty, so copying the sink into a flow's context also
      // moves the Sum or Count agent there. As a plain property it stayed in
      // the context the flow was parsed in, which has no data, and after a
      // reload the Sum's Property picker threw on a null DAO. autoValidate
      // lets a Sum with no Property turn Run off. JS only: the DAO agents it
      // holds do not exist in Java.
      class: 'FObjectProperty', generateJava: false, autoValidate: true,
      name: 'aggregation', label: 'Aggregation',
      view: { class: 'foam.core.reflow.SinkView',
              choice: 'foam.core.reflow.CountDAOAgent',
              disabledTypes: [ 'structure', 'format', 'chart' ] }
    },
    // TopNGroupBy user-configurable properties
    { class: 'Int', name: 'topN', label: 'Top N', value: 0,
      help: 'Keep top N groups by value (0 = disabled). Remaining groups can be merged into "Others".' },
    { class: 'Boolean', name: 'includeOthers', label: 'Include Others', value: false,
      help: 'Include "Others" group for remaining items when using Top N',
      visibility: function(topN) {
        return topN > 0 ? foam.u2.DisplayMode.RW : foam.u2.DisplayMode.HIDDEN;
      } },
    { class: 'Enum', of: 'foam.mlang.sink.GroupBySortOrder', name: 'sortOrder', label: 'Sort Order', value: 'DESC',
      help: 'Sort order for value-based limiting',
      visibility: function(topN) {
        return topN > 0 ? foam.u2.DisplayMode.RW : foam.u2.DisplayMode.HIDDEN;
      } },
    { class: 'String', name: 'othersLabel', label: 'Others Label', value: 'Others',
      help: 'Label for the aggregated "Others" category',
      visibility: function(topN) {
        return topN > 0 ? foam.u2.DisplayMode.RW : foam.u2.DisplayMode.HIDDEN;
      } },
    // Hide parent-class internals wired programmatically by createSink()
    { name: 'arg2', hidden: true },
    { name: 'groupKeys', hidden: true },
    { name: 'processArrayValuesIndividually', hidden: true },
    { name: 'groupLimit', hidden: true },
    // Bar-specific properties (display properties come from ChartDisplayMixin)
    { class: 'Enum', of: 'foam.u2.chart.TimeUnit', name: 'timeUnit',
      label: 'Time Unit', help: 'Time unit for X-axis when using date/time properties' },
    { class: 'Boolean', name: 'horizontal', label: 'Horizontal Bars', value: false },
    { class: 'Int', name: 'barThickness', label: 'Bar Thickness', help: 'Thickness of bars (0 = auto)' },
    { class: 'String', name: 'datasetLabel', value: '', help: 'Label for the dataset (shown in legend if enabled)' },
    { class: 'String', name: 'xAxisLabel', label: 'X-Axis Label' },
    { class: 'String', name: 'yAxisLabel', label: 'Y-Axis Label' },
    { class: 'Boolean', name: 'showGridLines', label: 'Show Grid Lines', value: true },
    // Override ChartDisplayMixin's showLegend default (true) — bar charts default to no legend
    { class: 'Boolean', name: 'showLegend', label: 'Show Legend', value: false },
    {
      name: 'chart_',
      hidden: true,
      transient: true,
      expression: function(groups, colors, timeUnit, horizontal, barThickness, datasetLabel, xAxisLabel, yAxisLabel,
                          showGridLines, showLegend, legendPosition, showTooltips, showTooltipSum,
                          animate, animationDuration, periodCount) {

        var labels = [];
        var data = [];
        var backgroundColors = [];

        // Check if we're dealing with dates - either the arg1 itself is a date property,
        // or it's a date transformation expression with a date delegate
        var isDateAxis = false;
        if ( this.arg1 ) {
          // Check if arg1 is directly a Date/DateTime property
          if ( foam.lang.Date.isInstance(this.arg1) || foam.lang.DateTime.isInstance(this.arg1) ) {
            isDateAxis = true;
          }
          // Check if arg1 is a date transformation expression (has a date delegate)
          else if ( this.arg1.delegate && (foam.lang.Date.isInstance(this.arg1.delegate) || foam.lang.DateTime.isInstance(this.arg1.delegate)) ) {
            isDateAxis = true;
          }
        }

        // If topN > 0, use groupKeys to preserve backend order (JavaScript reorders numeric keys)
        // Otherwise, use sortedKeys() for proper sorting
        var sortedKeys = this.topN > 0 ? (this.groupKeys || Object.keys(groups)) :
                        (this.sortedKeys ? this.sortedKeys() : Object.keys(groups));

        // Apply period range if enabled (periodCount > 0) and this is a date/time axis
        if ( periodCount > 0 && isDateAxis ) {
          sortedKeys = this.fillTimeGapKeys(sortedKeys, groups, periodCount, this.arg1);
        }

        // A raw Date or DateTime field labels each bar in the chosen time
        // unit ("Mar 2024" for MONTH); anything else asks the field itself.
        // A Date is midnight UTC and reads in UTC; a DateTime reads in local time.
        var timeScale = foam.lang.Date.isInstance(this.arg1) ?
          this.TimeScale.create({ unit: timeUnit, utc: ! foam.lang.DateTime.isInstance(this.arg1) }) : null;

        var index = 0;
        for ( var i = 0; i < sortedKeys.length; i++ ) {
          var key = sortedKeys[i];
          var label = timeScale ? timeScale.format(key) :
                      this.arg1 && this.arg1.chartFormatter ? this.arg1.chartFormatter(key) : key;
          labels.push(label);

          // Use value from groups if exists, otherwise use 0 for filled gaps
          var value = groups[key] ? groups[key].value : 0;
          data.push(value);

          // Only handle colors if they are defined
          if ( colors && colors.length > 0 ) {
            var color = colors[index % colors.length];
            if ( color !== undefined && color !== null ) {
              color = foam.CSS.returnTokenValue(color, this.cls_, this.__context__);
              backgroundColors.push(color);
            }
          }
          index++;
        }


        return this.BarChart.create({
          labels: labels,
          datasets: [{
            label: datasetLabel || 'Values',
            data: data,
            backgroundColor: backgroundColors.length > 0 ? backgroundColors : undefined
          }],
          horizontal:        horizontal,
          barThickness:      barThickness,
          xAxisLabel:        xAxisLabel,
          yAxisLabel:        yAxisLabel,
          showGridLines:     showGridLines,
          showLegend:        showLegend,
          legendPosition:    legendPosition,
          showTooltips:      showTooltips,
          showTooltipSum:    showTooltipSum,
          animate:           animate,
          animationDuration: animationDuration
        });
      }
    }
  ],

  methods: [
    function toE(_, x) {
      return x.E().add(this.chart_$);
    },
    function addToE(e) {
      e
        .style({
          width: '100%',
          display: 'flex',
          justifyContent: this.alignment$.map(function(a) { return a.alignmentStyle; }),
          textAlign: this.alignment$.map(function(a) { return a.textAlign; })
        })
        .start('div')
          .style({ width: '100%', 'min-height': this.height$, height: this.height$ })
          .add(this.chart_$)
        .end();
    }
  ]
});

foam.CLASS({
  package: 'foam.core.reflow.dashboard',
  name: 'DashboardPieSink',
  extends: 'foam.mlang.sink.TopNGroupBy',
  mixins: [
    'foam.core.reflow.dashboard.ChartDisplayMixin',
    'foam.core.reflow.dashboard.ColorMappingMixin'
  ],

  requires: [
    'foam.u2.chart.PieChart'
  ],

  sections: [
    { name: 'dataConfig', title: 'Data Configuration', order: 0, collapsable: true,
      properties: ['arg1', 'aggregation', 'topN', 'includeOthers', 'sortOrder', 'othersLabel'] },
    { name: 'chartSettings', title: 'Pie Chart Settings', order: 1, collapsable: true,
      properties: ['showPercentages', 'cutoutPercentage', 'clockwise', 'rotation', 'disableLegendClick', 'emptyValueMessage'] },
    { name: 'displayOptions', title: 'Display', order: 2, collapsable: true,
      properties: ['alignment', 'height', 'showLegend', 'legendPosition', 'legendMinWidthPercent', 'legendMaxWidthPercent', 'showTooltips', 'showTooltipSum', 'animate', 'animationDuration'] },
    { name: 'colorConfig', title: 'Colors', order: 3, collapsable: true,
      properties: ['colors'] }
  ],

  css: `
    <<graph-container {
      width: 100%;
    }

    <<empty-value-message {
      width: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      font-size: 14px;
      color: $textTertiary;
      height: 100%;
      background-color: $grey200;
      border-radius: 5px;
    }
  `,

  properties: [
    { class: 'foam.core.reflow.dashboard.ChartFieldProperty', name: 'arg1', label: 'Property', required: true },
    {
      class: 'FObjectProperty', generateJava: false, autoValidate: true,
      name: 'aggregation', label: 'Aggregation',
      view: { class: 'foam.core.reflow.SinkView',
              choice: 'foam.core.reflow.CountDAOAgent',
              disabledTypes: [ 'structure', 'format', 'chart' ] }
    },
    // TopNGroupBy user-configurable properties
    { class: 'Int', name: 'topN', label: 'Top N', value: 0,
      help: 'Keep top N groups by value (0 = disabled). Remaining groups can be merged into "Others".' },
    { class: 'Boolean', name: 'includeOthers', label: 'Include Others', value: true,
      help: 'Include "Others" group for remaining items when using Top N',
      visibility: function(topN) {
        return topN > 0 ? foam.u2.DisplayMode.RW : foam.u2.DisplayMode.HIDDEN;
      } },
    { class: 'Enum', of: 'foam.mlang.sink.GroupBySortOrder', name: 'sortOrder', label: 'Sort Order', value: 'DESC',
      help: 'Sort order for value-based limiting',
      visibility: function(topN) {
        return topN > 0 ? foam.u2.DisplayMode.RW : foam.u2.DisplayMode.HIDDEN;
      } },
    { class: 'String', name: 'othersLabel', label: 'Others Label', value: 'Others',
      help: 'Label for the aggregated "Others" category',
      visibility: function(topN) {
        return topN > 0 ? foam.u2.DisplayMode.RW : foam.u2.DisplayMode.HIDDEN;
      } },
    // Hide parent-class internals wired programmatically by createSink()
    { name: 'arg2', hidden: true },
    { name: 'groupKeys', hidden: true },
    { name: 'processArrayValuesIndividually', hidden: true },
    { name: 'groupLimit', hidden: true },
    // Pie-specific properties (display properties come from ChartDisplayMixin)
    { class: 'Boolean', name: 'showPercentages', label: 'Show Percentages', value: false },
    { class: 'Int', name: 'cutoutPercentage', label: 'Cutout %', value: 0,
      view: { class: 'foam.u2.RangeView', minValue: 0, maxValue: 100, step: 1, onKey: true },
      help: 'For donut effect (0-100)' },
    { class: 'Boolean', name: 'clockwise', label: 'Clockwise', value: true },
    { class: 'Int', name: 'rotation', label: 'Rotation Angle', value: -90,
      view: { class: 'foam.u2.RangeView', minValue: -180, maxValue: 180, step: 1, onKey: true },
      help: 'Starting angle in degrees (-180 to 180)' },
    { class: 'Boolean', name: 'disableLegendClick', label: 'Disable Legend Click',
      help: 'Prevent clicking legend items from toggling slice visibility' },
    { class: 'Int', name: 'legendMinWidthPercent', label: 'Legend Min Width (%)',
      help: 'Keeps a left or right legend at least this percentage (0-100) of the chart\'s width, so short legends take the same room as long ones and pies stacked in a column line up. 0 = no floor.' },
    { class: 'Int', name: 'legendMaxWidthPercent', label: 'Legend Max Width (%)',
      help: 'Caps the legend at this percentage (0-100) of container width; labels wider than the cap are truncated with an ellipsis (full text available in the hover tooltip). 0 = no cap. Setting min = max gives an exact fixed-width legend — arcs line up perfectly across stacked pies.' },
    { class: 'String', name: 'emptyValueMessage', section: "displayOptions", value: 'No data available',
      help: 'Message to display when there is no data' },
    { class: 'Boolean', name: 'hasData', section: "displayOptions", value: false, hidden: true },
    {
      name: 'chart_',
      hidden: true,
      transient: true,
      expression: function(groups, groupKeys, colors, showPercentages, cutoutPercentage, clockwise, rotation,
                          showLegend, legendPosition, showTooltips, showTooltipSum, animate, animationDuration,
                          disableLegendClick, legendMinWidthPercent, legendMaxWidthPercent) {

        var labels = [];
        var data = [];
        var backgroundColors = [];

        // If topN > 0, use groupKeys to preserve backend order (JavaScript reorders numeric keys)
        // Otherwise, use sortedKeys() for proper sorting
        var sortedKeys = this.topN > 0 ? (this.groupKeys || Object.keys(groups)) :
                        (this.sortedKeys ? this.sortedKeys() : Object.keys(groups));

        // Index into `colors` by the key's original position so a slice
        // keeps its colour when a legend click hides another slice.
        for ( var i = 0; i < sortedKeys.length; i++ ) {
          var key = sortedKeys[i];
          labels.push(key.toString());
          data.push(groups[key].value);

          if ( colors && colors.length > 0 ) {
            var color = colors[i % colors.length];
            if ( color !== undefined && color !== null ) {
              color = foam.CSS.returnTokenValue(color, this.cls_, this.__context__);
              backgroundColors.push(color);
            }
          }
        }

        this.hasData = data.length > 0;

        return this.PieChart.create({
          labels: labels,
          datasets: [{
            data: data,
            backgroundColor: backgroundColors.length > 0 ? backgroundColors : undefined
          }],
          cutout:                cutoutPercentage,
          rotation:              rotation,
          clockwise:             clockwise,
          showPercentages:       showPercentages,
          disableLegendClick:    disableLegendClick,
          legendMinWidthPercent: legendMinWidthPercent,
          legendMaxWidthPercent: legendMaxWidthPercent,
          showLegend:            showLegend,
          legendPosition:        legendPosition,
          showTooltips:          showTooltips,
          showTooltipSum:        showTooltipSum,
          animate:               animate,
          animationDuration:     animationDuration
        });
      }
    }
  ],

  methods: [
    function toE(_, x) {
      return x.E().add(this.chart_$);
    },
    function getMyClass(className = null) {
      // this.myClass() does not work here because it is not a view so I made an equivalent helper function
      const baseClass = this.cls_.package.replaceAll('.', '-') + '-' + this.cls_.name;
      return className && className.length > 0 ? baseClass + '-' + className : baseClass;
    },
    function addToE(e) {
      var self = this;

      e
        .addClass(self.getMyClass())
        .style({
          width: '100%',
          display: 'flex',
          justifyContent: this.alignment$.map(function(a) { return a.alignmentStyle; }),
          textAlign: this.alignment$.map(function(a) { return a.textAlign; })
        })
        .start('div')
          .addClass(self.getMyClass('graph-container'))
          .style({ 'min-height': this.height$, height: this.height$ })
          .add(self.dynamic(function(hasData, chart_, emptyValueMessage) {
            if ( hasData ) {
              this.add(chart_);
            }
            else {
              this
              .start('div')
                .addClass(self.getMyClass('empty-value-message'))
                .start('p')
                  .add(emptyValueMessage)
                .end()
              .end();
            }
          }))
        .end();
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow.dashboard',
  name: 'DashboardStackedBarSink',
  extends: 'foam.core.reflow.GridBy',

  mixins: [
    'foam.core.reflow.dashboard.TimeSeriesGapFillingSinkMixin',
    'foam.core.reflow.dashboard.ChartDisplayMixin',
    'foam.core.reflow.dashboard.ColorMappingMixin'
  ],

  requires: [
    'foam.u2.chart.BarChart',
    'foam.u2.chart.TimeScale'
  ],

  sections: [
    { name: 'dataConfig', title: 'Data Configuration', order: 0, collapsable: true,
      properties: ['xFunc', 'yFunc', 'aggregation', 'periodCount'] },
    { name: 'chartSettings', title: 'Stacked Bar Settings', order: 1, collapsable: true,
      properties: ['horizontal', 'timeUnit', 'showGridLines', 'onClickScript'] },
    { name: 'axisLabels', title: 'Axis Labels', order: 2, collapsable: true,
      properties: ['xAxisLabel', 'yAxisLabel'] },
    { name: 'displayOptions', title: 'Display', order: 3, collapsable: true,
      properties: ['alignment', 'height', 'showLegend', 'legendPosition', 'showTooltips', 'showTooltipSum', 'animate', 'animationDuration'] },
    { name: 'colorConfig', title: 'Colors', order: 4, collapsable: true,
      properties: ['colors'] }
  ],

  constants: [
    { name: 'TOTAL_SLOT', value: 'acc' }
  ],

  properties: [
    { class: 'foam.core.reflow.dashboard.ChartFieldProperty', name: 'xFunc', label: 'X Axis', required: true },
    { class: 'foam.core.reflow.dashboard.ChartFieldProperty', name: 'yFunc', label: 'Stacked By', required: true },
    {
      class: 'FObjectProperty', generateJava: false, autoValidate: true,
      name: 'aggregation', label: 'Aggregation',
      view: { class: 'foam.core.reflow.SinkView',
              choice: 'foam.core.reflow.CountDAOAgent',
              disabledTypes: [ 'structure', 'format', 'chart' ] }
    },
    // Stacked-bar-specific properties (display & colors come from mixins)
    {
      class: 'Code',
      name: 'onClickScript',
      label: 'On Click Script',
      help: 'Function expression invoked when a stack segment is clicked. Signature: (yValue, xValue, stackValue, x, y, absX, absY) => void'
    },
    { class: 'Enum', of: 'foam.u2.chart.TimeUnit', name: 'timeUnit',
      label: 'Time Unit', help: 'Time unit for X-axis when using date/time properties' },
    { class: 'Boolean', name: 'horizontal', label: 'Horizontal Stacks', value: false },
    { class: 'String', name: 'xAxisLabel', label: 'X-Axis Label' },
    { class: 'String', name: 'yAxisLabel', label: 'Y-Axis Label' },
    { class: 'Boolean', name: 'showGridLines', label: 'Show Grid Lines', value: true },
    // Hide GridBy parent-class internals wired programmatically by createSink()
    { name: 'acc', hidden: true },
    { name: 'rows', hidden: true },
    { name: 'cols', hidden: true },
    { name: 'x', hidden: true },
    { name: 'y', hidden: true },
    { name: 'query', hidden: true },
    { name: 'selection', hidden: true },
    {
      name: 'chart_',
      hidden: true,
      transient: true,
      expression: function(cols, rows, colors, timeUnit, horizontal, xAxisLabel, yAxisLabel,
                          showGridLines, showLegend, legendPosition, showTooltips, showTooltipSum,
                          animate, animationDuration, periodCount, onClickScript) {

        var colGroups = cols && cols.groups ? cols.groups : {};
        var rowGroups = rows && rows.groups ? rows.groups : {};

        var labels = [];
        var datasets = [];

        // The GridBy creates a 2D structure:
        // cols.groups = x-axis categories
        // rows.groups = stack groups (y-axis grouping)
        // Each intersection contains the aggregated value

        // Get the actual groups from the GroupBy objects
        var colGroups = cols && cols.groups ? cols.groups : {};
        var rowGroups = rows && rows.groups ? rows.groups : {};

        // Check if we're dealing with dates on x-axis - either xFunc is a date property,
        // or it's a date transformation expression with a date delegate
        var isDateAxis = false;
        if ( this.xFunc ) {
          if ( foam.lang.Date.isInstance(this.xFunc) || foam.lang.DateTime.isInstance(this.xFunc) ) {
            isDateAxis = true;
          } else if ( this.xFunc.delegate && (foam.lang.Date.isInstance(this.xFunc.delegate) || foam.lang.DateTime.isInstance(this.xFunc.delegate)) ) {
            isDateAxis = true;
          }
        }

        // Get sorted column keys using FOAM's sorting
        var sortedColKeys = [];
        if ( cols && cols.sortedKeys ) {
          sortedColKeys = cols.sortedKeys();
        } else {
          sortedColKeys = Object.keys(colGroups);
        }

        // Apply period range if enabled (periodCount > 0) and x-axis is a date
        if ( periodCount > 0 && isDateAxis ) {
          sortedColKeys = this.fillTimeGapKeys(sortedColKeys, colGroups, periodCount, this.xFunc);
        }

        // Extract labels from sorted columns (x-axis categories)
        // A raw Date or DateTime field labels each stack in the chosen time
        // unit ("Mar 2024" for MONTH); anything else asks the field itself.
        var timeScale = foam.lang.Date.isInstance(this.xFunc) ?
          this.TimeScale.create({ unit: timeUnit, utc: ! foam.lang.DateTime.isInstance(this.xFunc) }) : null;
        for ( var i = 0; i < sortedColKeys.length; i++ ) {
          var col = sortedColKeys[i];
          var label = timeScale ? timeScale.format(col) :
                      this.xFunc && this.xFunc.chartFormatter ? this.xFunc.chartFormatter(col) : col;
          labels.push(label);
        }

        // Get sorted row keys
        var sortedRowKeys = [];
        if ( rows && rows.sortedKeys ) {
          sortedRowKeys = rows.sortedKeys();
        } else {
          sortedRowKeys = Object.keys(rowGroups);
        }

        // Build datasets - one for each row (stack group) using sorted keys
        var colorIndex = 0;
        for ( var j = 0; j < sortedRowKeys.length; j++ ) {
          var rowKey = sortedRowKeys[j];
          if ( rowGroups.hasOwnProperty(rowKey) ) {
            var data = [];
            var rowGroup = rowGroups[rowKey];

            // For each sorted column, get the value for this row
            for ( var k = 0; k < sortedColKeys.length; k++ ) {
              var colKey = sortedColKeys[k];
              // Access the value at [row][col] intersection
              var value = 0;
              // The row group should have its own groups property with column keys
              if ( rowGroup && rowGroup.groups && rowGroup.groups[colKey] ) {
                // The value is stored in the accumulator's value property
                value = rowGroup.groups[colKey].value || 0;
              }
              data.push(value);
            }

            // Generate color for this dataset
            var datasetConfig = {
              label: rowKey.toString(),
              data: data
            };

            // Only handle colors if they are defined
            if ( colors && colors.length > 0 ) {
              var color = colors[colorIndex % colors.length];
              if ( color !== undefined && color !== null ) {
                color = foam.CSS.returnTokenValue(color, this.cls_, this.__context__);
                datasetConfig.backgroundColor = color;
              }
            }


            datasets.push(datasetConfig);

            colorIndex++;
          }
        }


        // The form's On Click Script is a function expression, called with
        // (yValue, xValue, stackValue, x, y, pageX, pageY) for the clicked
        // segment: its value, its x label, its stack label, the point inside
        // the chart and the point on the page.
        var clickHandler = null;
        if ( this.onClickScript ) {
          try {
            clickHandler = eval(this.onClickScript);
          } catch (e) {
            console.warn('Invalid onClickScript for DashboardStackedBarSink:', e);
          }
        }

        return this.BarChart.create({
          labels:            labels,
          datasets:          datasets,
          stacked:           true,
          horizontal:        horizontal,
          xAxisLabel:        xAxisLabel,
          yAxisLabel:        yAxisLabel,
          showGridLines:     showGridLines,
          showLegend:        showLegend,
          legendPosition:    legendPosition,
          showTooltips:      showTooltips,
          showTooltipSum:    showTooltipSum,
          animate:           animate,
          animationDuration: animationDuration,
          onBarClick: typeof clickHandler !== 'function' ? null : function(di, i, evt) {
            try {
              var box = evt.target.ownerSVGElement.getBoundingClientRect();
              clickHandler(datasets[di].data[i], labels[i], datasets[di].label,
                evt.clientX - box.left, evt.clientY - box.top, evt.pageX, evt.pageY);
            } catch (e) {
              console.warn('Error executing onClickScript:', e);
            }
          }
        });
      }
    }
  ],

  methods: [
    function toE(_, x) {
      return x.E().add(this.chart_$);
    },
    function addToE(e) {
      e
        .style({
          width: '100%',
          display: 'flex',
          justifyContent: this.alignment$.map(function(a) { return a.alignmentStyle; }),
          textAlign: this.alignment$.map(function(a) { return a.textAlign; })
        })
        .start('div')
          .style({ width: '100%', 'min-height': this.height$, height: this.height$ })
          .add(this.chart_$)
        .end();
    }
  ]
});

foam.CLASS({
  package: 'foam.core.reflow.dashboard',
  name: 'LineChartMixin',

  mixins: [
    'foam.core.reflow.dashboard.ChartDisplayMixin',
    'foam.core.reflow.dashboard.ColorMappingMixin'
  ],

  requires: [
    'foam.u2.chart.LineChart'
  ],

  messages: [
    { name: 'MIN_EQ_MAX', message: 'Min and max values cannot be equal' },
    { name: 'MIN_GT_MAX', message: 'Min cannot be greater than max' },
    { name: 'INVALID_DATE', message: 'Invalid date' }
  ],

  properties: [
    // Line-specific rendering properties (display & colors come from mixins)
    { class: 'Enum', of: 'foam.u2.chart.TimeUnit', name: 'timeUnit',
      label: 'Time Unit', help: 'Time unit for X-axis when using date/time properties' },
    { class: 'StringArray', name: 'borderColors', label: 'Border Colors',
      help: 'Border colors for line elements. If not specified, colors will be used.' },
    { class: 'String', name: 'xAxisLabel', label: 'X-Axis Label' },
    { class: 'String', name: 'yAxisLabel', label: 'Y-Axis Label' },
    { class: 'Boolean', name: 'fill', label: 'Fill Area', value: false },
    { class: 'Double', name: 'tension', label: 'Line Tension', value: 0.1,
      help: 'Bezier curve tension (0 = straight lines)' },
    { class: 'Boolean', name: 'stepped', label: 'Stepped Line', value: false },
    { class: 'Boolean', name: 'showPoints', label: 'Show Points', value: true },
    { class: 'Int', name: 'pointRadius', label: 'Point Radius', value: 3,
      visibility: function(showPoints) {
        return showPoints ? foam.u2.DisplayMode.RW : foam.u2.DisplayMode.HIDDEN;
      } },
    { class: 'Boolean', name: 'showGridLines', label: 'Show Grid Lines', value: true },
    // Custom axis scaling. Each sink defines isTimeScale from its x-axis property.
    { class: 'Boolean', name: 'isTimeScale', hidden: true, transient: true },
    { class: 'Boolean', name: 'toggleCustomXScale', label: 'Custom X Scale',
      help: 'Toggles custom scale for the X axis' },
    {
      class: 'Double', name: 'xAxisMinScale', label: 'X Axis Min',
      visibility: function(toggleCustomXScale, isTimeScale) {
        return ( ! isTimeScale && toggleCustomXScale ) ? foam.u2.DisplayMode.RW : foam.u2.DisplayMode.HIDDEN;
      },
      validateObj: function(toggleCustomXScale, xAxisMinScale, xAxisMaxScale, isTimeScale) {
        if ( toggleCustomXScale && ! isTimeScale && this.hasOwnProperty('xAxisMinScale') ) {
          if ( xAxisMinScale == xAxisMaxScale ) return this.MIN_EQ_MAX;
          if ( xAxisMinScale > xAxisMaxScale ) return this.MIN_GT_MAX;
        }
      }
    },
    {
      class: 'Double', name: 'xAxisMaxScale', label: 'X Axis Max',
      visibility: function(toggleCustomXScale, isTimeScale) {
        return ( ! isTimeScale && toggleCustomXScale ) ? foam.u2.DisplayMode.RW : foam.u2.DisplayMode.HIDDEN;
      },
      validateObj: function(toggleCustomXScale, xAxisMinScale, xAxisMaxScale, isTimeScale) {
        if ( toggleCustomXScale && ! isTimeScale && this.hasOwnProperty('xAxisMaxScale') ) {
          if ( xAxisMinScale == xAxisMaxScale ) return this.MIN_EQ_MAX;
          if ( xAxisMinScale > xAxisMaxScale ) return this.MIN_GT_MAX;
        }
      }
    },
    {
      class: 'DateTime', name: 'xDateAxisMinScale', label: 'X Axis Min',
      visibility: function(toggleCustomXScale, isTimeScale) {
        return ( isTimeScale && toggleCustomXScale ) ? foam.u2.DisplayMode.RW : foam.u2.DisplayMode.HIDDEN;
      },
      validateObj: function(toggleCustomXScale, isTimeScale, xDateAxisMinScale, xDateAxisMaxScale) {
        return this.validateDateRange_(toggleCustomXScale && isTimeScale, xDateAxisMinScale, xDateAxisMaxScale);
      }
    },
    {
      class: 'DateTime', name: 'xDateAxisMaxScale', label: 'X Axis Max',
      visibility: function(toggleCustomXScale, isTimeScale) {
        return ( isTimeScale && toggleCustomXScale ) ? foam.u2.DisplayMode.RW : foam.u2.DisplayMode.HIDDEN;
      },
      validateObj: function(toggleCustomXScale, isTimeScale, xDateAxisMinScale, xDateAxisMaxScale) {
        return this.validateDateRange_(toggleCustomXScale && isTimeScale, xDateAxisMinScale, xDateAxisMaxScale);
      }
    },
    { class: 'Boolean', name: 'toggleCustomYScale', label: 'Custom Y Scale',
      help: 'Toggles custom scale for the Y axis' },
    {
      class: 'Double', name: 'yAxisMinScale', label: 'Y Axis Min',
      visibility: function(toggleCustomYScale) {
        return toggleCustomYScale ? foam.u2.DisplayMode.RW : foam.u2.DisplayMode.HIDDEN;
      },
      validateObj: function(toggleCustomYScale, yAxisMinScale, yAxisMaxScale) {
        if ( toggleCustomYScale && this.hasOwnProperty('yAxisMinScale') ) {
          if ( yAxisMinScale == yAxisMaxScale ) return this.MIN_EQ_MAX;
          if ( yAxisMinScale > yAxisMaxScale ) return this.MIN_GT_MAX;
        }
      }
    },
    {
      class: 'Double', name: 'yAxisMaxScale', label: 'Y Axis Max',
      visibility: function(toggleCustomYScale) {
        return toggleCustomYScale ? foam.u2.DisplayMode.RW : foam.u2.DisplayMode.HIDDEN;
      },
      validateObj: function(toggleCustomYScale, yAxisMinScale, yAxisMaxScale) {
        if ( toggleCustomYScale && this.hasOwnProperty('yAxisMaxScale') ) {
          if ( yAxisMinScale == yAxisMaxScale ) return this.MIN_EQ_MAX;
          if ( yAxisMinScale > yAxisMaxScale ) return this.MIN_GT_MAX;
        }
      }
    },
    { class: 'Boolean', name: 'autoSkip', label: 'Hide Overlapping Labels', value: true },
    // Data range of the last render; seeds unset scale bounds and the reset actions
    { class: 'DateTime', name: 'dataXMin_', hidden: true, transient: true },
    { class: 'DateTime', name: 'dataXMax_', hidden: true, transient: true },
    { name: 'xScaleType_', hidden: true, transient: true },
    { name: 'dataXNumMin_', hidden: true, transient: true },
    { name: 'dataXNumMax_', hidden: true, transient: true },
    { name: 'dataYNumMin_', hidden: true, transient: true },
    { name: 'dataYNumMax_', hidden: true, transient: true }
  ],

  methods: [
    function createChart(datasets, isTimeScale, xAxisLabel, yAxisLabel, showGridLines,
                         showLegend, legendPosition, showTooltips, showTooltipSum, animate,
                         animationDuration, timeUnit, xPropForLabels, yPropForLabels,
                         toggleCustomXScale, toggleCustomYScale, xAxisMinScale, xAxisMaxScale,
                         yAxisMinScale, yAxisMaxScale, autoSkip, xDateAxisMinScale, xDateAxisMaxScale,
                         labels) {
      // A custom bound counts only once the user typed it: hasOwnProperty is
      // false while the field still shows its default.
      var custom = function(on, name, value) { return on && this.hasOwnProperty(name) ? value : undefined; }.bind(this);
      var xType  = isTimeScale ? 'time' : ( this.xScaleType_ || 'category' );
      return this.LineChart.create({
        labels:            labels || [],
        datasets:          datasets,
        xType:             xType,
        timeUnit:          timeUnit,
        // Only a raw Date field is stored as midnight UTC, so only it reads
        // in UTC. A DateTime is a moment, and a key such as '2026-W06' from a
        // date expression is parsed to local midnight by DateKeys.parse: both
        // read in local time.
        utc:               foam.lang.Date.isInstance(xPropForLabels) && ! foam.lang.DateTime.isInstance(xPropForLabels),
        xMin:              isTimeScale ? ( toggleCustomXScale ? xDateAxisMinScale : undefined ) : custom(toggleCustomXScale, 'xAxisMinScale', xAxisMinScale),
        xMax:              isTimeScale ? ( toggleCustomXScale ? xDateAxisMaxScale : undefined ) : custom(toggleCustomXScale, 'xAxisMaxScale', xAxisMaxScale),
        yMin:              custom(toggleCustomYScale, 'yAxisMinScale', yAxisMinScale),
        yMax:              custom(toggleCustomYScale, 'yAxisMaxScale', yAxisMaxScale),
        autoSkip:          autoSkip,
        xAxisLabel:        xAxisLabel || ( xPropForLabels ? xPropForLabels.label : '' ),
        yAxisLabel:        yAxisLabel || ( yPropForLabels ? yPropForLabels.label : '' ),
        showGridLines:     showGridLines,
        showLegend:        showLegend,
        legendPosition:    legendPosition,
        showTooltips:      showTooltips,
        showTooltipSum:    showTooltipSum,
        animate:           animate,
        animationDuration: animationDuration
      });
    },

    function parseXValue(prop, xValue, isTimeScale) {
      if ( ! isTimeScale ) {
        return ( prop && prop.chartFormatter ) ? prop.chartFormatter(xValue) : xValue;
      }
      if ( xValue instanceof Date ) return xValue;

      // Grouped keys ('2026-W06', '2026/07', '2026-059') aren't parseable
      // by Date, so read them with the expression's own parser first.
      var parsed = foam.core.reflow.dashboard.DateKeys.parse(prop, xValue);
      if ( parsed ) return parsed;

      var d = ( typeof xValue === 'number' ) ? new Date(xValue) : new Date(String(xValue));
      return isNaN(d.getTime()) ? null : d;
    },

    function validateDateRange_(enabled, minDate, maxDate) {
      if ( ! enabled ) return;
      // Either end unset means the range isn't fully specified yet — nothing to compare.
      if ( ! minDate || ! maxDate ) return;

      var min = minDate.getTime ? minDate.getTime() : new Date(minDate).getTime();
      var max = maxDate.getTime ? maxDate.getTime() : new Date(maxDate).getTime();

      if ( isNaN(min) || isNaN(max) ) return this.INVALID_DATE;
      if ( min === max ) return this.MIN_EQ_MAX;
      if ( min > max )   return this.MIN_GT_MAX;
    },

    function seedScaleFromData_() {
      // Fill each unset scale bound with the data range of the last render
      var self = this;
      [ [ 'xDateAxisMinScale', 'dataXMin_' ],    [ 'xDateAxisMaxScale', 'dataXMax_' ],
        [ 'xAxisMinScale',     'dataXNumMin_' ], [ 'xAxisMaxScale',     'dataXNumMax_' ],
        [ 'yAxisMinScale',     'dataYNumMin_' ], [ 'yAxisMaxScale',     'dataYNumMax_' ] ].forEach(function(p) {
        if ( self[p[1]] != null && ! self.hasOwnProperty(p[0]) ) self[p[0]] = self[p[1]];
      });
    },

    function addToE(e) {
      e
        .style({
          width: '100%',
          display: 'flex',
          justifyContent: this.alignment$.map(function(a) { return a.alignmentStyle; }),
          textAlign: this.alignment$.map(function(a) { return a.textAlign; })
        })
        .start('div')
          .style({ width: '100%', 'min-height': this.height$, height: this.height$ })
          .add(this.chart_$)
        .end();
    }
  ],

  listeners: [
    {
      name: 'onDataRangeChange',
      isFramed: true,
      on: [
        'this.propertyChange.dataXMin_',    'this.propertyChange.dataXMax_',
        'this.propertyChange.dataXNumMin_', 'this.propertyChange.dataXNumMax_',
        'this.propertyChange.dataYNumMin_', 'this.propertyChange.dataYNumMax_'
      ],
      code: function() { this.seedScaleFromData_(); }
    }
  ],

  actions: [
    {
      name: 'resetXScale',
      label: 'Reset X Scale',
      isAvailable: function(toggleCustomXScale) { return toggleCustomXScale; },
      code: function() {
        this.clearProperty('xDateAxisMinScale');
        this.clearProperty('xDateAxisMaxScale');
        this.clearProperty('xAxisMinScale');
        this.clearProperty('xAxisMaxScale');
        this.seedScaleFromData_();
      }
    },
    {
      name: 'resetYScale',
      label: 'Reset Y Scale',
      isAvailable: function(toggleCustomYScale) { return toggleCustomYScale; },
      code: function() {
        this.clearProperty('yAxisMinScale');
        this.clearProperty('yAxisMaxScale');
        this.seedScaleFromData_();
      }
    }
  ]
});

foam.CLASS({
  package: 'foam.core.reflow.dashboard',
  name: 'DashboardLineSink',
  extends: 'foam.mlang.sink.GroupBy',
  mixins: [
    'foam.core.reflow.dashboard.LineChartMixin',
    'foam.core.reflow.dashboard.TimeSeriesGapFillingSinkMixin'
  ],

  sections: [
    { name: 'dataConfig', title: 'Data Configuration', order: 0, collapsable: true,
      properties: ['arg1', 'yFunc', 'aggregation', 'topN', 'includeOthers', 'sortOrder', 'othersLabel', 'periodCount'] },
    { name: 'chartSettings', title: 'Line Chart Settings', order: 1, collapsable: true,
      properties: ['fill', 'tension', 'stepped', 'showPoints', 'pointRadius', 'showGridLines', 'timeUnit'] },
    { name: 'axisLabels', title: 'Axis Labels', order: 2, collapsable: true,
      properties: ['xAxisLabel', 'yAxisLabel'] },
    { name: 'displayOptions', title: 'Display', order: 3, collapsable: true,
      properties: ['alignment', 'height', 'showLegend', 'legendPosition', 'showTooltips', 'showTooltipSum', 'animate', 'animationDuration',
                   'toggleCustomXScale', 'xAxisMinScale', 'xAxisMaxScale', 'xDateAxisMinScale', 'xDateAxisMaxScale',
                   'toggleCustomYScale', 'yAxisMinScale', 'yAxisMaxScale', 'autoSkip'],
      actions: ['resetXScale', 'resetYScale'] },
    { name: 'colorConfig', title: 'Colors', order: 4, collapsable: true,
      properties: ['colors', 'borderColors'] }
  ],

  properties: [
    { class: 'foam.core.reflow.dashboard.ChartFieldProperty', name: 'arg1', label: 'X Property', help: 'Property to group by (x-axis values)', required: true },
    // Filling this in draws one line per group (one per currency). This sink
    // draws a single line, so the line agent swaps in DashboardMultiLineSink,
    // which has the same field, on the next run.
    {
      class: 'foam.core.reflow.dashboard.ChartChoiceFieldProperty', generateJava: false,
      name: 'yFunc', label: 'Group By (Multiple Lines)',
      help: 'Optional: Group data by this property to create multiple lines'
    },
    {
      class: 'FObjectProperty', generateJava: false, autoValidate: true,
      name: 'aggregation', label: 'Aggregation',
      view: { class: 'foam.core.reflow.SinkView',
              choice: 'foam.core.reflow.CountDAOAgent',
              disabledTypes: [ 'structure', 'format', 'chart' ] }
    },
    // GroupBy parent-class internals — wired programmatically by createSink()
    { name: 'arg2', hidden: true, label: 'Aggregation Sink', help: 'Sink to aggregate y-values for each x-value' },
    { name: 'groupKeys', hidden: true },
    { name: 'processArrayValuesIndividually', hidden: true },
    { name: 'groupLimit', hidden: true },
    // TopN user-configurable properties
    { class: 'Int', name: 'topN', label: 'Top N', value: 0,
      help: 'Keep top N groups by value (0 = disabled). Remaining groups can be merged into "Others".' },
    { class: 'Boolean', name: 'includeOthers', label: 'Include Others', value: true,
      help: 'Include "Others" group for remaining items when using Top N',
      visibility: function(topN) {
        return topN > 0 ? foam.u2.DisplayMode.RW : foam.u2.DisplayMode.HIDDEN;
      } },
    { class: 'Enum', of: 'foam.mlang.sink.GroupBySortOrder', name: 'sortOrder', label: 'Sort Order', value: 'DESC',
      help: 'Sort order for value-based limiting',
      visibility: function(topN) {
        return topN > 0 ? foam.u2.DisplayMode.RW : foam.u2.DisplayMode.HIDDEN;
      } },
    { class: 'String', name: 'othersLabel', label: 'Others Label', value: 'Others',
      help: 'Label for the aggregated "Others" category',
      visibility: function(topN) {
        return topN > 0 ? foam.u2.DisplayMode.RW : foam.u2.DisplayMode.HIDDEN;
      } },
    {
      name: 'isTimeScale',
      expression: function(arg1) {
        return foam.lang.Date.isInstance(arg1) ||
          foam.core.reflow.dashboard.DateKeys.isTemporal(arg1);
      }
    },
    {
    name: 'chart_',
    hidden: true,
    transient: true,
    expression: function(groups, arg1, arg2, timeUnit, colors, borderColors, xAxisLabel, yAxisLabel,
                        fill, tension, stepped, showPoints, pointRadius, showGridLines,
                        showLegend, legendPosition,
                        showTooltips, showTooltipSum, animate, animationDuration,
                        periodCount, toggleCustomXScale, toggleCustomYScale,
                        xAxisMinScale, xAxisMaxScale, yAxisMinScale, yAxisMaxScale, autoSkip,
                        xDateAxisMinScale, xDateAxisMaxScale, isTimeScale) {

      if ( !arg1 || !arg2 ) return null;


      var data = [];
      var labels = [];
      var minX = null, maxX = null;
      var minY = null, maxY = null;
      var minXNum = null, maxXNum = null, allNumeric = true;
      var sortedKeys = this.sortedKeys ? this.sortedKeys() : Object.keys(groups);

      // Apply period range if enabled (periodCount > 0) and x-axis is a date
      if ( periodCount > 0 && isTimeScale ) {
        sortedKeys = this.fillTimeGapKeys(sortedKeys, groups, periodCount, arg1);
      }

      // One { x, y } point per group, in x order
      for ( var i = 0; i < sortedKeys.length; i++ ) {
        var xValue = sortedKeys[i];
        var aggregatedSink = groups[xValue];
        var yValue = aggregatedSink ? aggregatedSink.value : 0;

        // Taken from Claude -----------------------------------------
        var xVal = this.parseXValue(arg1, xValue, isTimeScale);
        if ( xVal === null ) continue;

        if ( isTimeScale ) {
          if ( ! minX || xVal.getTime() < minX.getTime() ) minX = xVal;
          if ( ! maxX || xVal.getTime() > maxX.getTime() ) maxX = xVal;
        } else {
          var n = Number(xVal);
          if ( xVal === '' || xVal == null || isNaN(n) ) {
            allNumeric = false;
          } else {
            if ( minXNum === null || n < minXNum ) minXNum = n;
            if ( maxXNum === null || n > maxXNum ) maxXNum = n;
          }
        }
        // ------------------------------------------------------------

        labels.push(xVal);
        data.push({ x: xVal, y: yValue });
        var yn = Number(yValue);
        if ( ! isNaN(yn) ) {
          if ( minY === null || yn < minY ) minY = yn;
          if ( maxY === null || yn > maxY ) maxY = yn;
        }
      }

      // Pre-set the date range
      if ( isTimeScale ) {
        this.xScaleType_ = 'time';
        this.dataXMin_ = minX;
        this.dataXMax_ = maxX;
      } else if ( allNumeric && data.length ) {
        this.xScaleType_ = 'linear';
        this.dataXNumMin_ = minXNum;
        this.dataXNumMax_ = maxXNum;
      } else {
        this.xScaleType_ = 'category';
        this.dataXNumMin_ = 0;
        this.dataXNumMax_ = Math.max(0, labels.length - 1);
      }

      this.dataYNumMin_ = minY;
      this.dataYNumMax_ = maxY;

      // Create single dataset
      var datasetConfig = {
        label: (arg2 && arg2.label) || 'Values',
        data: data,
        borderWidth: 2,
        fill: fill,
        tension: tension,
        stepped: stepped,
        pointRadius: showPoints ? pointRadius : 0,
        pointHoverRadius: showPoints ? pointRadius + 2 : 0
      };

      // Apply colors
      if ( colors && colors.length > 0 ) {
        var color = colors[0];
        if ( color !== undefined && color !== null ) {
          color = foam.CSS.returnTokenValue(color, this.cls_, this.__context__);
          datasetConfig.backgroundColor = fill ? color : 'transparent';
          datasetConfig.borderColor = borderColors && borderColors[0] ?
            foam.CSS.returnTokenValue(borderColors[0], this.cls_, this.__context__) :
            color;
        }
      }

      var datasets = [datasetConfig];

      // Use the mixin method instead of duplicating chart options
      return this.createChart(datasets, isTimeScale, xAxisLabel, yAxisLabel, showGridLines,
                              showLegend, legendPosition, showTooltips, showTooltipSum, animate,
                              animationDuration, timeUnit, arg1, arg2,
                              toggleCustomXScale, toggleCustomYScale, xAxisMinScale, xAxisMaxScale,
                              yAxisMinScale, yAxisMaxScale, autoSkip, xDateAxisMinScale, xDateAxisMaxScale,
                              isTimeScale ? null : labels);
    }

  }
  ],

  methods: [
    function toE(_, x) {
      return x.E().add(this.chart_$);
    },
    function addToE(e) {
      e
        .style({
          width: '100%',
          display: 'flex',
          justifyContent: this.alignment$.map(function(a) { return a.alignmentStyle; }),
          textAlign: this.alignment$.map(function(a) { return a.textAlign; })
        })
        .start('div')
          .style({ width: '100%', 'min-height': this.height$, height: this.height$ })
          .add(this.chart_$)
        .end();
    }
  ]
});

foam.CLASS({
  package: 'foam.core.reflow.dashboard',
  name: 'DashboardMultiLineSink',
  extends: 'foam.core.reflow.GridBy',
  mixins: [
    'foam.core.reflow.dashboard.LineChartMixin',
    'foam.core.reflow.dashboard.TimeSeriesGapFillingSinkMixin'
  ],

  sections: [
    { name: 'dataConfig', title: 'Data Configuration', order: 0, collapsable: true,
      properties: ['xFunc', 'yFunc', 'aggregation', 'periodCount'] },
    { name: 'chartSettings', title: 'Line Chart Settings', order: 1, collapsable: true,
      properties: ['fill', 'tension', 'stepped', 'showPoints', 'pointRadius', 'showGridLines', 'timeUnit'] },
    { name: 'axisLabels', title: 'Axis Labels', order: 2, collapsable: true,
      properties: ['xAxisLabel', 'yAxisLabel'] },
    { name: 'displayOptions', title: 'Display', order: 3, collapsable: true,
      properties: ['alignment', 'height', 'showLegend', 'legendPosition', 'showTooltips', 'showTooltipSum', 'animate', 'animationDuration',
                   'toggleCustomXScale', 'xAxisMinScale', 'xAxisMaxScale', 'xDateAxisMinScale', 'xDateAxisMaxScale',
                   'toggleCustomYScale', 'yAxisMinScale', 'yAxisMaxScale', 'autoSkip'],
      actions: ['resetXScale', 'resetYScale'] },
    { name: 'colorConfig', title: 'Colors', order: 4, collapsable: true,
      properties: ['colors', 'borderColors'] }
  ],

  constants: [
    { name: 'TOTAL_SLOT', value: 'acc' }
  ],

  properties: [
    { class: 'foam.core.reflow.dashboard.ChartFieldProperty', name: 'xFunc', label: 'X Property', help: 'Property to group by (x-axis values)', required: true },
    // One line per group (one per currency). Clearing it makes the line agent
    // swap back to the single-line DashboardLineSink on the next run.
    {
      class: 'foam.core.reflow.dashboard.ChartChoiceFieldProperty',
      name: 'yFunc', label: 'Group By (Multiple Lines)',
      help: 'Optional: Group data by this property to create multiple lines'
    },
    {
      class: 'FObjectProperty', generateJava: false, autoValidate: true,
      name: 'aggregation', label: 'Aggregation',
      view: { class: 'foam.core.reflow.SinkView',
              choice: 'foam.core.reflow.CountDAOAgent',
              disabledTypes: [ 'structure', 'format', 'chart' ] }
    },
    // GridBy parent-class internals — wired programmatically by createSink()
    { name: 'acc', hidden: true, label: 'Aggregation Sink', help: 'Sink to aggregate y-values for each x-value/line combination' },
    { name: 'rows', hidden: true },
    { name: 'cols', hidden: true },
    { name: 'x', hidden: true },
    { name: 'y', hidden: true },
    { name: 'query', hidden: true },
    { name: 'selection', hidden: true },
    {
      name: 'isTimeScale',
      expression: function(xFunc) {
        return foam.lang.Date.isInstance(xFunc) ||
          foam.core.reflow.dashboard.DateKeys.isTemporal(xFunc);
      }
    },
    {
    name: 'chart_',
    hidden: true,
    transient: true,
    expression: function(cols, rows, xFunc, yFunc, acc, timeUnit, colors, borderColors, xAxisLabel, yAxisLabel,
                        fill, tension, stepped, showPoints, pointRadius, showGridLines,
                        showLegend, legendPosition,
                        showTooltips, showTooltipSum, animate, animationDuration,
                        periodCount, toggleCustomXScale, toggleCustomYScale,
                        xAxisMinScale, xAxisMaxScale, yAxisMinScale, yAxisMaxScale, autoSkip,
                        xDateAxisMinScale, xDateAxisMaxScale, isTimeScale) {

      if ( !xFunc || !yFunc || !acc ) return null;


      var datasets = [];
      var colorIndex = 0;

      var colGroups = cols && cols.groups ? cols.groups : {};
      var rowGroups = rows && rows.groups ? rows.groups : {};

      var sortedColKeys = cols && cols.sortedKeys ? cols.sortedKeys() : Object.keys(colGroups);
      var sortedRowKeys = rows && rows.sortedKeys ? rows.sortedKeys() : Object.keys(rowGroups);

      // Apply period range if enabled (periodCount > 0) and x-axis is a date
      if ( periodCount > 0 && isTimeScale ) {
        sortedColKeys = this.fillTimeGapKeys(sortedColKeys, colGroups, periodCount, xFunc);
      }

      // Parse the column keys once — they're shared by every line
      var xVals = [], colKeys = [], labels = [];
      var minX = null, maxX = null;
      var minY = null, maxY = null;
      var minXNum = null, maxXNum = null, allNumeric = true;

      for ( var i = 0; i < sortedColKeys.length; i++ ) {
        var xValue = sortedColKeys[i];
        var xVal = this.parseXValue(xFunc, xValue, isTimeScale);
        if ( xVal === null ) continue;

        if ( isTimeScale ) {
          if ( ! minX || xVal.getTime() < minX.getTime() ) minX = xVal;
          if ( ! maxX || xVal.getTime() > maxX.getTime() ) maxX = xVal;
        } else {
          var n = Number(xVal);
          if ( xVal === '' || xVal == null || isNaN(n) ) {
            allNumeric = false;
          } else {
            if ( minXNum === null || n < minXNum ) minXNum = n;
            if ( maxXNum === null || n > maxXNum ) maxXNum = n;
          }
        }

        colKeys.push(xValue);   // original group key, for lookups
        xVals.push(xVal);       // parsed value, for the chart
        labels.push(xVal);
      }

      if ( isTimeScale ) {
        this.xScaleType_ = 'time';
        this.dataXMin_ = minX;
        this.dataXMax_ = maxX;
      } else if ( allNumeric && xVals.length ) {
        this.xScaleType_ = 'linear';
        this.dataXNumMin_ = minXNum;
        this.dataXNumMax_ = maxXNum;
      } else {
        this.xScaleType_ = 'category';
        this.dataXNumMin_ = 0;
        this.dataXNumMax_ = Math.max(0, labels.length - 1);
      }

      // Create a dataset for each line (row group)
      for ( var j = 0; j < sortedRowKeys.length; j++ ) {
        var lineKey = sortedRowKeys[j];
        var rowGroup = rowGroups[lineKey];
        var data = [];

        for ( var i = 0; i < xVals.length; i++ ) {
          var yValue = 0;
          if ( rowGroup && rowGroup.groups && rowGroup.groups[colKeys[i]] ) {
            yValue = rowGroup.groups[colKeys[i]].value || 0;
          }
          data.push({ x: xVals[i], y: yValue });

          var yn = Number(yValue);
          if ( ! isNaN(yn) ) {
            if ( minY === null || yn < minY ) minY = yn;
            if ( maxY === null || yn > maxY ) maxY = yn;
          }
        }

        var datasetConfig = {
          label: lineKey.toString(),
          data: data,
          borderWidth: 2,
          fill: fill,
          tension: tension,
          stepped: stepped,
          pointRadius: showPoints ? pointRadius : 0,
          pointHoverRadius: showPoints ? pointRadius + 2 : 0
        };

        // Apply colors
        if ( colors && colors.length > 0 ) {
          var color = colors[colorIndex % colors.length];
          if ( color !== undefined && color !== null ) {
            color = foam.CSS.returnTokenValue(color, this.cls_, this.__context__);
            datasetConfig.backgroundColor = fill ? color : 'transparent';
            datasetConfig.borderColor = borderColors && borderColors[colorIndex % borderColors.length] ?
              foam.CSS.returnTokenValue(borderColors[colorIndex % borderColors.length], this.cls_, this.__context__) :
              color;
          }
        }

        datasets.push(datasetConfig);
        colorIndex++;
      }

      this.dataYNumMin_ = minY;
      this.dataYNumMax_ = maxY;

      // Use the mixin method instead of duplicating chart options
      return this.createChart(datasets, isTimeScale, xAxisLabel, yAxisLabel, showGridLines,
                              showLegend, legendPosition, showTooltips, showTooltipSum, animate,
                              animationDuration, timeUnit, xFunc, yFunc,
                              toggleCustomXScale, toggleCustomYScale, xAxisMinScale, xAxisMaxScale,
                              yAxisMinScale, yAxisMaxScale, autoSkip, xDateAxisMinScale, xDateAxisMaxScale,
                              isTimeScale ? null : labels);
      }
    }

  ],

  methods: [
    function toE(_, x) {
      return x.E().add(this.chart_$);
    },
    function addToE(e) {
      e
        .style({
          width: '100%',
          display: 'flex',
          justifyContent: this.alignment$.map(function(a) { return a.alignmentStyle; }),
          textAlign: this.alignment$.map(function(a) { return a.textAlign; })
        })
        .start('div')
          .style({ width: '100%', 'min-height': this.height$, height: this.height$ })
          .add(this.chart_$)
        .end();
    }
  ]
});

foam.CLASS({
  package: 'foam.core.reflow.dashboard',
  name: 'DashboardMetricSink',
  extends: 'foam.dao.AbstractSink',
  implements: ['foam.lang.Serializable'],

  requires: ['foam.u2.tag.Image'],

  imports: [
    'theme',
    'scope?'
  ],

  exports: ['lastEncounteredObj_ as objData'],

  sections: [
    {
      name: 'metricConfig',
      title: 'Metric Configuration',
      order: 0,
      collapsable: true,
      properties: ['operation', 'prop', 'label', 'prefix', 'postfix', 'decimalPlaces', 'convertToLocalString']
    },
    {
      name: 'countConfig',
      title: 'Count Configuration',
      order: 1,
      collapsable: true,
      properties: ['showCount', 'countOnClick', 'countSuffix', 'countColor', 'countFontSize', 'countFontWeight']
    },
    {
      name: 'display',
      title: 'Display Options',
      order: 2,
      collapsable: true,
      properties: ['icon', 'iconColor', 'iconSize', 'alignment', 'valueColor', 'valueFontSize']
    },
    {
      name: 'labelFont',
      title: 'Label Font Options',
      order: 3,
      collapsable: true,
      properties: ['labelFontSize', 'labelFontWeight', 'labelColor']
    }
  ],

  properties: [
    {
      class: 'Enum',
      of: 'foam.core.reflow.dashboard.MetricOperation',
      name: 'operation',
      value: 'COUNT'
    },
    {
      class: 'FObjectProperty',
      of: 'foam.lang.Property',
      generateJava: false,
      name: 'prop',
      label: 'Property',
      view: function(_, X) {
        return {
          class: 'foam.core.reflow.PropertyChoiceView',
          forCls: X.dao ? X.dao.of : X.of
        };
      },
      visibility: function(operation) {
        // FOAM makes this reactive automatically when operation changes
        return operation && operation.name !== 'COUNT' ?
          foam.u2.DisplayMode.RW :
          foam.u2.DisplayMode.HIDDEN;
      }
    },
    {
      class: 'foam.mlang.SinkProperty',
      name: 'sink',
      externalTransient: true,
      hidden: true,
      factory: function() { return this.operation.createSink(this.prop); },
      javaFactory: 'return foam.mlang.MLang.COUNT();'
    },
    {
      class: 'foam.mlang.SinkProperty',
      name: 'countSink',
      externalTransient: true,
      hidden: true,
      javaFactory: 'return foam.mlang.MLang.COUNT();',
      factory: function() { return foam.mlang.sink.Count.create(); }
    },
    {
      class: 'String',
      name: 'label',
      label: 'Display Label',
      expression: function(sink) {
        return this.sink?.label ?? 'Metric';
      }
    },
    {
      class: 'String',
      name: 'icon',
      help: 'Theme icon name to display above the metric value (e.g., "chart", "users", "dollar")'
    },
    {
      class: 'String',
      name: 'iconColor',
      help: 'Color for the icon (CSS color or token)',
      view: 'foam.u2.view.ColorEditView',
      value: '$primary500'
    },
    {
      class: 'Enum',
      name: 'alignment',
      of: 'foam.core.reflow.dashboard.MetricAlignment',
      value: 'CENTER'
    },
    { class: 'Boolean', name: 'showCount', value: true },
    {
      class: 'String',
      name: 'countSuffix',
      value: 'records',
      help: 'Text to display after the count number',
      visibility: function(showCount) {
        return showCount ? foam.u2.DisplayMode.RW : foam.u2.DisplayMode.HIDDEN;
      }
    },
    {
      class: 'String',
      name: 'valueColor',
      help: 'Color for the metric value',
      view: 'foam.u2.view.ColorEditView',
      value: '$primary500'
    },
    {
      class: 'String',
      name: 'valueFontSize',
      help: 'Font size for the metric value (e.g., "3rem", "24px")',
      value: '3rem'
    },
    {
      class: 'String',
      name: 'prefix',
      help: 'Text to display before value (e.g., $, €, #)'
    },
    {
      class: 'String',
      name: 'postfix',
      help: 'Text to display after value (e.g., %, ms, USD)'
    },
    {
      class: 'String',
      name: 'iconSize',
      help: 'Size of the icon (CSS size value like "2rem", "24px")',
      value: '2rem'
    },
    { class:'Int', name: 'decimalPlaces', min: 0 },
    { class: 'Boolean',
      name: 'convertToLocalString',
      value: true,
      visibility: function(decimalPlaces) {
        return decimalPlaces === 0 ? 'RW' : 'HIDDEN';
      }
    },
    // Label font controls
    {
      class: 'String',
      name: 'labelFontSize',
      help: 'Font size for the display label (e.g., "1rem", "14px")',
      value: '0.875rem'
    },
    {
      class: 'String',
      name: 'labelFontWeight',
      help: 'Font weight for the display label (e.g., "normal", "bold", "500")',
      value: 'medium'
    },
    {
      class: 'String',
      name: 'labelColor',
      help: 'Color for the display label (CSS color or token)',
      view: 'foam.u2.view.ColorEditView',
      value: '$textSecondary'
    },
    // Count font controls
    {
      class: 'String',
      name: 'countFontSize',
      help: 'Font size for the count text (e.g., "0.75rem", "12px")',
      value: '0.75rem'
    },
    {
      class: 'String',
      name: 'countFontWeight',
      help: 'Font weight for the count text (e.g., "normal", "bold")',
      value: 'normal'
    },
    {
      class: 'String',
      name: 'countOnClick',
      label: 'OnClick Script',
      reactive: true,
      visibility: function(showCount) {
        return showCount ? foam.u2.DisplayMode.RW : foam.u2.DisplayMode.HIDDEN;
      },
      help: 'Script to execute when the count is clicked'
    },
    {
      class: 'String',
      name: 'countColor',
      help: 'Color for the count text (CSS color or token)',
      view: 'foam.u2.view.ColorEditView',
      value: '$textSecondary'
    },
    {
      name: 'metric_',
      hidden: true,
      transient: true,
      expression: function(sink, countSink, showCount, countOnClick, decimalPlaces, convertToLocalString, postfix, prefix) {
        var value = this.getComputedValue();
        var count = countSink ? countSink.value : null;

        // Format value with decimal places
        if ( typeof value === 'number' ) {
          value = value.toFixed(decimalPlaces);
          if ( decimalPlaces !== 0 ) {
            value = parseFloat(value).toLocaleString(undefined, {
              minimumFractionDigits: decimalPlaces,
              maximumFractionDigits: decimalPlaces
            });
          } else if ( convertToLocalString ) {
            value = parseInt(value).toLocaleString();
          }
        }

        // Add prefix and postfix if specified
        if ( prefix ) {
          value = prefix.startsWith(' ') || prefix.endsWith(' ') ?
                  prefix + value : prefix + ' ' + value;
        }
        if ( postfix ) {
          value = postfix.startsWith(' ') || postfix.endsWith(' ') ?
                  value + postfix : value + ' ' + postfix;
        }

        return {
          value: value,
          count: count
        };
      }
    },
    {
      name: 'lastEncounteredObj_',
      transient: true,
      hidden: true
    }
  ],

  methods: [
    {
      name: 'put',
      code: function put(obj, sub) {
        this.sink.put(obj, sub);
        this.countSink.put(obj, sub);
        this.lastEncounteredObj_ = obj;
      },
      javaCode: `
        getSink().put(obj, sub);
        getCountSink().put(obj, sub);
      `
    },

    function getColorFromToken(token) {
      return foam.CSS.returnTokenValue(token, this.cls_, this.__context__);
    },

    function getComputedValue() {
      return this.sink && this.sink.value !== undefined ? this.sink.value : 0;
    },

    function toE(_, x) {
      var self = this;
      let e = x.E();
      this.addToE(e);
      return e;
    },

    function addToE(e) {
      var self = this;
      /// force re-evaluation of metric_ on render
      this.propertyChange.pub('sink', this.sink$)

      e.style({
        display: 'flex',
        flexDirection: 'column',
        alignItems: self.alignment$.map(function(alignment) { return alignment.alignmentStyle }),
        textAlign: self.alignment$.map(function(alignment) { return alignment.textAlign }),
        width: '100%'
      });

      e.add(this.dynamic(function(icon) {
        if ( icon ) {
          this.start('div')
            .style({
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            })
            .start(self.Image, {
              role: 'presentation',
              ...(
                self.theme && self.theme.glyphs && self.theme.glyphs[icon] ?
                { glyph: self.theme.glyphs[icon] } :
                { data: icon, embedSVG: true }
              )
            })
            .style({
              width: self.iconSize$,
              height: self.iconSize$,
              color: self.iconColor$.map(v => self.getColorFromToken(v))
            })
            .end()
          .end();
        }
      }));
      e.start('div')
          .style({
            fontSize: this.labelFontSize$,
            color: this.labelColor$.map(v => self.getColorFromToken(v)),
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontWeight: this.labelFontWeight$,
            marginBottom: '8px'
          })
          .add(this.label$)
      .end();
      e.add(this.dynamic(function(metric_) {
        var metric = metric_;
        // Value
        this.start('div')
          .style({
            fontSize: self.valueFontSize$,
            fontWeight: 'bold',
            color: self.valueColor$.map(v => self.getColorFromToken(v)),
            lineHeight: '1'
          })
          .callIfElse(foam.lang.Property.isInstance(self.sink.arg1) && self.lastEncounteredObj_, function() {
            this.startContext({ controllerMode: 'VIEW', objData: self.lastEncounteredObj_}).tag(self.sink.arg1, {data: metric.value }).endContext();
          }, function() {
            this.add(metric.value)
          })
        .end();

        // Count - show how many records were processed
        if ( self.showCount && metric.count !== null ) {
            this.start('a')
              .style({
                fontSize: self.countFontSize$,
                marginTop: '8px',
                color: self.countColor$.map(v => self.getColorFromToken(v)),
                fontWeight: self.countFontWeight$
              })
              .callIf(self.countOnClick, function() {
                this
                  .on('click', self.onCountClick)
                  .style({ textDecoration: 'underline', cursor: 'pointer' })
               })
              .add(self.countSuffix$.map(v => metric.count.toLocaleString() + (v ? ' ' + v : '')))
            .end();
        }
      }));
    },

    function reset(sub) {
      if ( this.sink && this.sink.reset ) {
        this.sink.reset(sub);
      }
      if ( this.countSink && this.countSink.reset ) {
        this.countSink.reset(sub);
      }
    },
    function toString() {
      return 'DashboardMetricSink(' + this.sink.toString() + ')';
    },
    async function onLoad() {
      this.updateSink();
    }
  ],
  listeners: [
    {
      name: 'updateSink',
      isFramed: true,
      on: ['this.propertyChange.operation', 'this.propertyChange.prop'],
      code: function() {
        let sink =  this.operation ? this.operation.createSink(this.prop) : foam.mlang.MLang.COUNT();
        if ( this.sink.cls_ !== sink.cls_ ) {
          this.sink = sink;
        } else {
          this.sink.copyFrom(sink);
        }
      }
    },
    {
      name: 'onCountClick',
      isFramed: true,
      code: function() {
        with ( this.scope ) {
          var result = eval('(async function() { ' + this.countOnClick + ' })').call(this);
          return result;
        }
      }
    },
  ]
});

foam.CLASS({
  package: 'foam.core.reflow.dashboard',
  name: 'DashboardCalendarSink',
  extends: 'foam.dao.AbstractSink',
  mixins: [
    'foam.core.reflow.dashboard.ChartDisplayMixin',
    'foam.core.reflow.dashboard.ColorMappingMixin'
  ],
  documentation: 'Calendar sink with fully live dashboard properties (match Pie/Bar).',
  requires: [
    'foam.u2.layout.ContainerWidth',
    'foam.core.reflow.dashboard.CalendarChartView'
  ],

  sections: [
    { name: 'dataConfig', title: 'Data Configuration', order: 0, collapsable: true,
      properties: ['dateProp', 'categoryProp', 'aggregation', 'showAllData', 'periodCount'] },
    { name: 'displayOptions', title: 'Display', order: 1, collapsable: true,
      properties: ['alignment', 'maintainAspectRatio', 'height', 'showLegend', 'legendPosition', 'animate', 'animationDuration'] },
    { name: 'colorConfig', title: 'Colors', order: 2, collapsable: true,
      properties: ['colors'] },
    // The calendar draws no tooltips, but ChartDisplayMixin adds two tooltip
    // switches. A mixin's properties install after this class's own, so an
    // override cannot hide them; this section, never shown, holds them instead.
    { name: 'unusedTooltips', isAvailable: function() { return false; },
      properties: ['showTooltips', 'showTooltipSum'] }
  ],

  constants: [
    { name: 'TOTAL_SLOT', value: 'valueSink' }
  ],

  properties: [
    // generateJava: false: this sink's put() has no Java code, and its Java
    // class never had these two fields.
    { class: 'foam.core.reflow.dashboard.ChartFieldProperty', name: 'dateProp', label: 'Date Property', required: true, generateJava: false },
    {
      class: 'foam.core.reflow.dashboard.ChartChoiceFieldProperty', generateJava: false,
      name: 'categoryProp', label: 'Category Property'
    },
    {
      class: 'FObjectProperty', generateJava: false, autoValidate: true,
      name: 'aggregation', label: 'Aggregation',
      view: { class: 'foam.core.reflow.SinkView',
              choice: 'foam.core.reflow.CountDAOAgent',
              disabledTypes: [ 'structure', 'format', 'chart' ] }
    },
    // Internal properties wired programmatically by createSink() — hidden from editor
    { name: 'valueSink', hidden: true, documentation: 'Aggregator sink.' },
    { class: 'Boolean', name: 'showAllData', label: 'Show All Data',
      help: 'When enabled, the calendar includes every record regardless of date. Disable to limit to the last N days configured by Periods.' },
    { class: 'Int', name: 'periodCount', label: 'Periods', value: 12,
      help: 'How many days to show from today. Ignored when Show All Data is enabled.',
      visibility: function(showAllData) {
        return showAllData ? foam.u2.DisplayMode.HIDDEN : foam.u2.DisplayMode.RW;
      } },
    { name: 'map_', hidden: true, factory: function() { return {}; } },
    // Display & colors properties come from ChartDisplayMixin and ColorMappingMixin
    {
      name: 'chart_',
      hidden: true,
      transient: true,
      factory: function() {
        // Only create once, then drive via property slots
        return this.CalendarChartView.create({});
      }
    }
  ],
  methods: [
    function put(obj) {
      let d = this.dateProp.f(obj);
      let c = this.hasDefaultValue('categoryProp') ? 'default' : this.categoryProp.f(obj);
      if (!d || !c) return;
      let key = d;
      if ( ! (d instanceof Date) ) {
        if ( typeof d !== 'string' ) {
          throw new Error('Date must be Date object or a string');
        }
        if ( d.length === 7 ) { d = d + d[4] + '01'; }
        d = foam.parse.DateParser.create().parseDateString(d);
        if ( ! d || d.getTime() === foam.Date.MAX_DATE.getTime() ) return;
        key = d;
      }
      key = key.toISOString().slice(0, 10);
      if (!this.map_[key]) this.map_[key] = {};
      let v = 1;
      if (this.valueSink && this.valueSink.put) {
        this.valueSink.reset && this.valueSink.reset();
        this.valueSink.put(obj);
        v = this.valueSink.value !== undefined ? this.valueSink.value : 1;
      }
      this.map_[key][c] = (this.map_[key][c] || 0) + v;
    },
    function toE(_, x) { return x.E().add(this.chart_$); },
    function addToE(e) {
      var self = this;
      // Prepare labels/categories/values live from map_
      function updateChartData() {
        const allCatsSet = new Set();
        Object.values(self.map_).forEach(row => Object.keys(row).forEach(k => allCatsSet.add(k)));
        const categories = Array.from(allCatsSet).sort();
        const allDates = Object.keys(self.map_).sort();
        self.chart_.categories = categories;
        self.chart_.labels = allDates;
        self.chart_.values = allDates.map(date => categories.map(cat => (self.map_[date] && self.map_[date][cat]) ? self.map_[date][cat] : 0));
      }
      // Initial chart creation
      updateChartData();
      e.add(this.chart_$);
      // Live slot binding like Pie/Bar
      this.onDetach(this.dynamic(function(colors, showLegend, legendPosition, maintainAspectRatio, height, alignment, animate, animationDuration) {
        var c = self.chart_;
        if (!c) return;
        c.colors = colors;
        c.showLegend = showLegend;
        c.legendPosition = legendPosition;
        c.maintainAspectRatio = maintainAspectRatio;
        c.height = height;
        c.alignment = alignment;
        c.animate = animate;
        c.animationDuration = animationDuration;
        // Also update chart data in-case of data changes
        updateChartData();
        c.invalidate && c.invalidate();
      }, this.colors$, this.showLegend$, this.legendPosition$, this.maintainAspectRatio$, this.height$, this.alignment$, this.animate$, this.animationDuration$));
    }
  ]
});

foam.CLASS({
  package: 'foam.core.reflow.dashboard',
  name: 'DashboardScatterSink',
  extends: 'foam.dao.AbstractSink',
  mixins: [
    'foam.core.reflow.dashboard.ChartDisplayMixin',
    'foam.core.reflow.dashboard.ColorMappingMixin'
  ],

  documentation: `
    One dot per row: the X and Y properties are two numeric properties of the
    row, such as response time and size. A row whose X or Y is not a number
    (a date, text or yes/no value) is left out. Giving a Series property draws
    one colour and one legend entry per value of it, e.g. one per severity; a
    row with no value there is left out too.
  `,

  requires: [
    'foam.u2.chart.ScatterChart'
  ],

  sections: [
    { name: 'dataConfig', title: 'Data Configuration', order: 0, collapsable: true,
      properties: ['xProp', 'yProp', 'seriesProp'] },
    { name: 'chartSettings', title: 'Scatter Chart Settings', order: 1, collapsable: true,
      properties: ['xAxisLabel', 'yAxisLabel', 'showGridLines', 'onClickScript'] },
    { name: 'displayOptions', title: 'Display', order: 2, collapsable: true,
      properties: ['height', 'showLegend', 'legendPosition', 'showTooltips', 'animate', 'animationDuration', 'emptyValueMessage'] },
    { name: 'colorConfig', title: 'Colors', order: 3, collapsable: true,
      properties: ['colors'] },
    // The scatter has no alignment, aspect ratio or tooltip sum, but
    // ChartDisplayMixin adds them. A mixin's properties install after this
    // class's own, so an override cannot hide them; this section, never
    // shown, holds them instead.
    { name: 'unused', isAvailable: function() { return false; },
      properties: ['alignment', 'maintainAspectRatio', 'showTooltipSum'] }
  ],

  messages: [
    { name: 'DEFAULT_SERIES', message: 'Points' }
  ],

  properties: [
    // generateJava: false: this sink's put() has no Java code, and its Java
    // class never had these fields.
    { class: 'foam.core.reflow.dashboard.ChartFieldProperty', name: 'xProp', label: 'X Property', help: 'Numeric property drawn along the x axis', required: true, generateJava: false },
    { class: 'foam.core.reflow.dashboard.ChartFieldProperty', name: 'yProp', label: 'Y Property', help: 'Numeric property drawn along the y axis', required: true, generateJava: false },
    {
      class: 'foam.core.reflow.dashboard.ChartChoiceFieldProperty', generateJava: false,
      name: 'seriesProp', label: 'Series Property',
      help: 'Optional: one colour and legend entry per value of this property'
    },
    { class: 'String', name: 'xAxisLabel', label: 'X-Axis Label' },
    { class: 'String', name: 'yAxisLabel', label: 'Y-Axis Label' },
    { class: 'Boolean', name: 'showGridLines', label: 'Show Grid Lines', value: true },
    {
      class: 'Code',
      name: 'onClickScript',
      label: 'On Click Script',
      help: 'Function expression called when a dot is clicked. Signature: (x, y, series, chartX, chartY, pageX, pageY) => void'
    },
    {
      class: 'String',
      name: 'emptyValueMessage',
      label: 'Empty Message',
      help: 'Shown in place of the chart when the query finds no points. Left empty, it says "No data available".'
    },
    {
      class: 'Array',
      name: 'series_',
      hidden: true,
      // Points collected by put(), one entry per series in the order first seen:
      // [ { label: 'GET', data: [ { x: 40, y: 56.2 } ] } ]. Kept as plain
      // arrays, since the sink is copied and sent as JSON during a select, and a
      // JS Map arrives as {} and then fails in put(). Transient, so the points
      // of one run are never saved into the flow.
      transient: true
    },
    {
      name: 'chart_',
      hidden: true,
      transient: true,
      // Read once, by addToE, after the select has collected every point.
      factory: function() {
        var self = this;
        var datasets = this.series_.map(function(e, i) {
          var c = self.colors && self.colors.length ? self.colors[i % self.colors.length] : undefined;
          return {
            label: e.label,
            data: e.data,
            backgroundColor: c ? foam.CSS.returnTokenValue(c, self.cls_, self.__context__) : undefined
          };
        });
        // The form's On Click Script is a function expression, called with
        // (x, y, series, chartX, chartY, pageX, pageY) for the clicked dot:
        // its two values, its series name, the point inside the chart and
        // the point on the page.
        var click = null;
        if ( this.onClickScript ) {
          try {
            click = eval(this.onClickScript);
          } catch ( e ) {
            console.warn('Invalid onClickScript for DashboardScatterSink:', e);
          }
        }
        return this.createChart_({
          datasets:          datasets,
          // With no title typed in, an axis is titled with its field's label,
          // as the line chart does: "Amount", not a blank axis.
          xAxisLabel:        this.xAxisLabel || this.labelOf_(this.xProp),
          yAxisLabel:        this.yAxisLabel || this.labelOf_(this.yProp),
          showGridLines:     this.showGridLines,
          showLegend:        this.showLegend,
          legendPosition:    this.legendPosition,
          showTooltips:      this.showTooltips,
          animate:           this.animate,
          animationDuration: this.animationDuration,
          onPointClick: typeof click !== 'function' ? null : function(di, j, evt) {
            try {
              var p   = datasets[di].data[j];
              var box = evt.target.ownerSVGElement.getBoundingClientRect();
              click.apply(null, self.clickArgs_(p, datasets[di].label).concat(
                evt.clientX - box.left, evt.clientY - box.top, evt.pageX, evt.pageY));
            } catch ( e ) {
              console.warn('Error executing onClickScript:', e);
            }
          }
        });
      }
    }
  ],

  methods: [
    function pointOf_(obj) {
      // The point a row draws as { x, y }, or null when the row has none.
      // Only number values count: a date would plot as milliseconds since
      // 1970 and yes/no as 0 or 1. NaN and Infinity are left to the chart,
      // which drops them.
      var x = this.xProp.f(obj), y = this.yProp.f(obj);
      return typeof x === 'number' && typeof y === 'number' ? { x: x, y: y } : null;
    },

    function createChart_(args) {
      return this.ScatterChart.create(args);
    },

    function clickArgs_(p, series) {
      // The leading arguments of the On Click Script, before the chart and page position.
      return [ p.x, p.y, series ];
    },

    function put(obj) {
      var pt = this.pointOf_(obj);
      if ( ! pt ) return;
      var key = this.DEFAULT_SERIES;
      if ( ! this.hasDefaultValue('seriesProp') ) {
        // A row with no series value is left out, as the calendar chart does,
        // rather than drawn as a series called "undefined".
        var v = this.seriesProp.f(obj);
        if ( v == null || v === '' ) return;
        key = String(v);
      }
      var s = this.series_.find(function(e) { return e.label === key; });
      if ( ! s ) this.series_.push(s = { label: key, data: [] });
      s.data.push(pt);
    },

    function addToE(e) {
      e.style({ width: '100%' });
      this.addChartOrEmpty_(e, this.series_.length, this.emptyValueMessage);
    }
  ]
});

foam.CLASS({
  package: 'foam.core.reflow.dashboard',
  name: 'DashboardBubbleSink',
  extends: 'foam.core.reflow.dashboard.DashboardScatterSink',

  documentation: `
    One bubble per row: the X and Y properties place it and the Size property
    sets its area, e.g. latency against payload size with the request count as
    the size. A row whose X, Y or Size is not a number is left out. Series
    works as on the scatter.
  `,

  requires: [
    'foam.u2.chart.BubbleChart'
  ],

  sections: [
    { name: 'dataConfig', title: 'Data Configuration', order: 0, collapsable: true,
      properties: ['xProp', 'yProp', 'sizeProp', 'seriesProp'] },
    { name: 'chartSettings', title: 'Bubble Chart Settings', order: 1, collapsable: true,
      properties: ['xAxisLabel', 'yAxisLabel', 'sizeLabel', 'showGridLines', 'onClickScript'] }
  ],

  properties: [
    { class: 'foam.core.reflow.dashboard.ChartFieldProperty', name: 'sizeProp', label: 'Size Property', help: 'Numeric property that sets the area of the bubble', required: true, generateJava: false },
    { class: 'String', name: 'sizeLabel', label: 'Size Label', help: 'What the tooltip calls the size. Left empty, it takes the Size Property\'s label.' },
    {
      name: 'onClickScript',
      help: 'Function expression called when a bubble is clicked. Signature: (x, y, size, series, chartX, chartY, pageX, pageY) => void'
    }
  ],

  methods: [
    function pointOf_(obj) {
      var pt = this.SUPER(obj);
      var r  = this.sizeProp.f(obj);
      if ( ! pt || typeof r !== 'number' ) return null;
      pt.r = r;
      return pt;
    },

    function createChart_(args) {
      args.sizeLabel = this.sizeLabel || this.labelOf_(this.sizeProp);
      return this.BubbleChart.create(args);
    },

    function clickArgs_(p, series) {
      return [ p.x, p.y, p.r, series ];
    }
  ]
});

foam.CLASS({
  package: 'foam.core.reflow.dashboard',
  name: 'DashboardCandlestickSink',
  extends: 'foam.dao.AbstractSink',
  mixins: [
    'foam.core.reflow.dashboard.ChartDisplayMixin',
    'foam.core.reflow.dashboard.ColorMappingMixin'
  ],

  documentation: `
    One candle per row: the Time property places it, and the Open, High, Low
    and Close properties are four numeric properties of the row, such as the
    first, highest, lowest and last response time of each minute. A row whose
    time is not a date, or whose open, high, low or close is not a number, is
    left out. Colors takes two colours, rise then fall.
  `,

  requires: [
    'foam.u2.chart.CandlestickChart'
  ],

  sections: [
    { name: 'dataConfig', title: 'Data Configuration', order: 0, collapsable: true,
      properties: ['timeProp', 'openProp', 'highProp', 'lowProp', 'closeProp'] },
    { name: 'chartSettings', title: 'Candlestick Chart Settings', order: 1, collapsable: true,
      properties: ['timeUnit', 'xAxisLabel', 'yAxisLabel', 'showGridLines', 'onClickScript'] },
    { name: 'displayOptions', title: 'Display', order: 2, collapsable: true,
      properties: ['height', 'showLegend', 'legendPosition', 'showTooltips', 'animate', 'animationDuration', 'emptyValueMessage'] },
    { name: 'colorConfig', title: 'Colors', order: 3, collapsable: true,
      properties: ['colors'] },
    // The candlestick has no alignment, aspect ratio or tooltip sum, but
    // ChartDisplayMixin adds them. A mixin's properties install after this
    // class's own, so an override cannot hide them; this section, never
    // shown, holds them instead.
    { name: 'unused', isAvailable: function() { return false; },
      properties: ['alignment', 'maintainAspectRatio', 'showTooltipSum'] }
  ],

  properties: [
    // generateJava: false: this sink's put() has no Java code, and its Java
    // class never had these fields.
    { class: 'foam.core.reflow.dashboard.ChartFieldProperty', name: 'timeProp',  label: 'Time Property',  help: 'Date or date-and-time property that places each candle along the x axis', required: true, generateJava: false },
    { class: 'foam.core.reflow.dashboard.ChartFieldProperty', name: 'openProp',  label: 'Open Property',  help: 'Numeric property: the value at the start of the step, where the box begins', required: true, generateJava: false },
    { class: 'foam.core.reflow.dashboard.ChartFieldProperty', name: 'highProp',  label: 'High Property',  help: 'Numeric property: the highest value of the step, the top of the line', required: true, generateJava: false },
    { class: 'foam.core.reflow.dashboard.ChartFieldProperty', name: 'lowProp',   label: 'Low Property',   help: 'Numeric property: the lowest value of the step, the bottom of the line', required: true, generateJava: false },
    { class: 'foam.core.reflow.dashboard.ChartFieldProperty', name: 'closeProp', label: 'Close Property', help: 'Numeric property: the value at the end of the step, where the box ends', required: true, generateJava: false },
    { class: 'Enum', of: 'foam.u2.chart.TimeUnit', name: 'timeUnit', value: 'DAY',
      label: 'Time Unit', help: 'Period the x-axis ticks mark; pick Minute for a candle a minute', generateJava: false },
    { class: 'String', name: 'xAxisLabel', label: 'X-Axis Label' },
    { class: 'String', name: 'yAxisLabel', label: 'Y-Axis Label' },
    { class: 'Boolean', name: 'showGridLines', label: 'Show Grid Lines', value: true },
    {
      class: 'Code',
      name: 'onClickScript',
      label: 'On Click Script',
      help: 'Function expression called when a candle is clicked. Signature: (time, open, high, low, close, chartX, chartY, pageX, pageY) => void'
    },
    {
      class: 'String',
      name: 'emptyValueMessage',
      label: 'Empty Message',
      help: 'Shown in place of the chart when the query finds no candles. Left empty, it says "No data available".'
    },
    {
      class: 'Array',
      name: 'candles_',
      hidden: true,
      // Candles collected by put(), in the order the rows arrive:
      // [ { x: 1700000000000, open: 10, high: 14, low: 8, close: 13 } ]. Kept
      // as plain objects, since the sink is copied and sent as JSON during a
      // select. Transient, so the candles of one run are never saved into the flow.
      transient: true
    },
    {
      name: 'chart_',
      hidden: true,
      transient: true,
      // Read once, by addToE, after the select has collected every candle.
      factory: function() {
        var self = this;
        var data = this.candles_.slice().sort(function(l, r) { return l.x - r.x; });
        var click = null;
        if ( this.onClickScript ) {
          try {
            click = eval(this.onClickScript);
          } catch ( e ) {
            console.warn('Invalid onClickScript for DashboardCandlestickSink:', e);
          }
        }
        // Colors is a list: rise, then fall. One colour given leaves the fall to the theme.
        var colors = ( this.colors || [] ).slice(0, 2).map(function(c) {
          return c ? foam.CSS.returnTokenValue(c, self.cls_, self.__context__) : undefined;
        });
        return this.CandlestickChart.create({
          datasets:          [ { data: data, backgroundColor: colors.length ? colors : undefined } ],
          timeUnit:          this.timeUnit,
          // A Date is midnight UTC and reads in UTC; a DateTime reads in local time.
          utc:               foam.lang.Date.isInstance(this.timeProp) && ! foam.lang.DateTime.isInstance(this.timeProp),
          xAxisLabel:        this.xAxisLabel || this.labelOf_(this.timeProp),
          // The four values share one axis, so with no title typed it takes the Close field's label.
          yAxisLabel:        this.yAxisLabel || this.labelOf_(this.closeProp),
          showGridLines:     this.showGridLines,
          showLegend:        this.showLegend,
          legendPosition:    this.legendPosition,
          showTooltips:      this.showTooltips,
          animate:           this.animate,
          animationDuration: this.animationDuration,
          onCandleClick: typeof click !== 'function' ? null : function(j, evt) {
            try {
              var c   = data[j];
              var box = evt.target.ownerSVGElement.getBoundingClientRect();
              click(c.x, c.open, c.high, c.low, c.close, evt.clientX - box.left, evt.clientY - box.top, evt.pageX, evt.pageY);
            } catch ( e ) {
              console.warn('Error executing onClickScript:', e);
            }
          }
        });
      }
    }
  ],

  methods: [
    function put(obj) {
      // Only a date and four numbers make a candle: a number would plot as
      // that many seconds since 1970 and yes/no as 0 or 1. NaN and Infinity
      // are left to the chart, which drops them.
      var t = this.timeProp.f(obj);
      var c = {
        open:  this.openProp.f(obj),
        high:  this.highProp.f(obj),
        low:   this.lowProp.f(obj),
        close: this.closeProp.f(obj)
      };
      if ( ! ( t instanceof Date ) ) return;
      for ( var k in c ) if ( typeof c[k] !== 'number' ) return;
      c.x = t.getTime();
      this.candles_.push(c);
    },

    function addToE(e) {
      e.style({ width: '100%' });
      this.addChartOrEmpty_(e, this.candles_.length, this.emptyValueMessage);
    }
  ]
});

foam.CLASS({
  package: 'foam.core.reflow.dashboard',
  name: 'DashboardRadarSink',
  extends: 'foam.core.reflow.GridBy',
  mixins: [
    'foam.core.reflow.dashboard.ChartDisplayMixin',
    'foam.core.reflow.dashboard.ColorMappingMixin'
  ],

  documentation: `
    A spoke per value of the Category property, aggregated with the form's
    Count, Sum or Average: log messages counted per severity, say. Giving a
    Series property draws one polygon per value of it, e.g. one per day; with
    none, one polygon holds every row. A row with no value in either field is
    left out.
  `,

  requires: [
    'foam.u2.chart.RadarChart'
  ],

  sections: [
    { name: 'dataConfig', title: 'Data Configuration', order: 0, collapsable: true,
      properties: ['xFunc', 'yFunc', 'aggregation'] },
    { name: 'chartSettings', title: 'Radar Chart Settings', order: 1, collapsable: true,
      properties: ['onClickScript'] },
    { name: 'displayOptions', title: 'Display', order: 2, collapsable: true,
      properties: ['alignment', 'height', 'showLegend', 'legendPosition', 'showTooltips', 'showTooltipSum', 'animate', 'animationDuration', 'emptyValueMessage'] },
    { name: 'colorConfig', title: 'Colors', order: 3, collapsable: true,
      properties: ['colors'] },
    // The radar keeps its shape whatever the card's size, but
    // ChartDisplayMixin adds an aspect-ratio switch. A mixin's properties
    // install after this class's own, so an override cannot hide it; this
    // section, never shown, holds it instead.
    { name: 'unused', isAvailable: function() { return false; },
      properties: ['maintainAspectRatio'] }
  ],

  constants: [
    { name: 'TOTAL_SLOT', value: 'acc' }
  ],

  messages: [
    { name: 'DEFAULT_SERIES', message: 'Values' }
  ],

  properties: [
    { class: 'foam.core.reflow.dashboard.ChartFieldProperty', name: 'xFunc', label: 'Category Property', help: 'One spoke per value of this property', required: true },
    {
      class: 'foam.core.reflow.dashboard.ChartChoiceFieldProperty',
      name: 'yFunc', label: 'Series Property',
      help: 'Optional: one polygon and legend entry per value of this property'
    },
    {
      class: 'FObjectProperty', generateJava: false, autoValidate: true,
      name: 'aggregation', label: 'Aggregation',
      view: { class: 'foam.core.reflow.SinkView',
              choice: 'foam.core.reflow.CountDAOAgent',
              disabledTypes: [ 'structure', 'format', 'chart' ] }
    },
    {
      class: 'Code',
      name: 'onClickScript',
      label: 'On Click Script',
      help: 'Function expression called when a polygon corner is clicked. Signature: (value, category, series, chartX, chartY, pageX, pageY) => void'
    },
    {
      class: 'String',
      name: 'emptyValueMessage',
      label: 'Empty Message',
      help: 'Shown in place of the chart when the query finds no rows. Left empty, it says "No data available".'
    },
    // Hide GridBy parent-class internals wired programmatically by createSink()
    { name: 'acc', hidden: true },
    { name: 'rows', hidden: true },
    { name: 'cols', hidden: true },
    { name: 'x', hidden: true },
    { name: 'y', hidden: true },
    { name: 'query', hidden: true },
    { name: 'selection', hidden: true },
    {
      name: 'chart_',
      hidden: true,
      transient: true,
      expression: function(cols, rows, colors, showLegend, legendPosition, showTooltips, showTooltipSum,
                          animate, animationDuration, onClickScript) {
        var self      = this;
        var rowGroups = rows && rows.groups ? rows.groups : {};
        var keys = function(g) { return self.groupKeys_(g); };

        // cols.groups holds the spokes and rows.groups the polygons; the
        // value of a polygon on a spoke is rows.groups[series].groups[spoke].
        var spokeKeys = keys(cols);
        var labels    = spokeKeys.map(function(k) { return self.xFunc && self.xFunc.chartFormatter ? self.xFunc.chartFormatter(k) : k; });
        var datasets  = keys(rows).map(function(seriesKey, i) {
          var cells = rowGroups[seriesKey] && rowGroups[seriesKey].groups || {};
          var ds = {
            label: seriesKey.toString(),
            data: spokeKeys.map(function(k) { return cells[k] && cells[k].value || 0; })
          };
          if ( colors && colors.length ) {
            ds.backgroundColor = foam.CSS.returnTokenValue(colors[i % colors.length], self.cls_, self.__context__);
          }
          return ds;
        });

        // The form's On Click Script is a function expression, called with
        // (value, category, series, chartX, chartY, pageX, pageY) for the
        // clicked corner: its value, its spoke, its polygon, the point inside
        // the chart and the point on the page.
        var clickHandler = null;
        if ( onClickScript ) {
          try {
            clickHandler = eval(onClickScript);
          } catch ( e ) {
            console.warn('Invalid onClickScript for DashboardRadarSink:', e);
          }
        }

        return this.RadarChart.create({
          labels:            labels,
          datasets:          datasets,
          showLegend:        showLegend,
          legendPosition:    legendPosition,
          showTooltips:      showTooltips,
          showTooltipSum:    showTooltipSum,
          animate:           animate,
          animationDuration: animationDuration,
          onPointClick: typeof clickHandler !== 'function' ? null : function(di, j, evt) {
            try {
              var box = evt.target.ownerSVGElement.getBoundingClientRect();
              clickHandler(datasets[di].data[j], labels[j], datasets[di].label,
                evt.clientX - box.left, evt.clientY - box.top, evt.pageX, evt.pageY);
            } catch ( e ) {
              console.warn('Error executing onClickScript:', e);
            }
          }
        });
      }
    }
  ],

  methods: [
    function addToE(e) {
      e.style({
        width: '100%',
        display: 'flex',
        justifyContent: this.alignment$.map(function(a) { return a.alignmentStyle; }),
        textAlign: this.alignment$.map(function(a) { return a.textAlign; })
      });
      this.addChartOrEmpty_(e, this.chart_.labels.length, this.emptyValueMessage);
    }
  ]
});

foam.CLASS({
  package: 'foam.core.reflow.dashboard',
  name: 'DashboardHeatmapSink',
  extends: 'foam.core.reflow.GridBy',

  mixins: [
    'foam.core.reflow.dashboard.ChartDisplayMixin',
    'foam.core.reflow.dashboard.ColorMappingMixin'
  ],

  documentation: `
    One cell per pair of values: X Axis gives the columns (hour of day of a
    date, say) and Y Axis the rows (a log severity), and each cell is coloured
    by the Aggregation of the rows that fall in it: a Count, or a Sum or
    Average of a numeric field. A pair with no rows is an empty cell, not a
    zero. The first colour in Colors is the strong end of the colour scale.
  `,

  requires: [
    'foam.u2.chart.HeatmapChart'
  ],

  sections: [
    { name: 'dataConfig', title: 'Data Configuration', order: 0, collapsable: true,
      properties: ['xFunc', 'yFunc', 'aggregation'] },
    { name: 'chartSettings', title: 'Heatmap Settings', order: 1, collapsable: true,
      properties: ['showValues', 'onClickScript'] },
    { name: 'axisLabels', title: 'Axis Labels', order: 2, collapsable: true,
      properties: ['xAxisLabel', 'yAxisLabel'] },
    { name: 'displayOptions', title: 'Display', order: 3, collapsable: true,
      properties: ['height', 'showLegend', 'legendPosition', 'showTooltips', 'animate', 'animationDuration', 'emptyValueMessage'] },
    { name: 'colorConfig', title: 'Colors', order: 4, collapsable: true,
      properties: ['colors'] },
    // The heatmap has no alignment, aspect ratio or tooltip sum, but
    // ChartDisplayMixin adds them. A mixin's properties install after this
    // class's own, so an override cannot hide them; this section, never
    // shown, holds them instead.
    { name: 'unused', isAvailable: function() { return false; },
      properties: ['alignment', 'maintainAspectRatio', 'showTooltipSum'] }
  ],

  constants: [
    { name: 'TOTAL_SLOT', value: 'acc' }
  ],

  properties: [
    { class: 'foam.core.reflow.dashboard.ChartFieldProperty', name: 'xFunc', label: 'X Axis', required: true },
    { class: 'foam.core.reflow.dashboard.ChartFieldProperty', name: 'yFunc', label: 'Y Axis', required: true },
    {
      class: 'FObjectProperty', generateJava: false, autoValidate: true,
      name: 'aggregation', label: 'Aggregation',
      view: { class: 'foam.core.reflow.SinkView',
              choice: 'foam.core.reflow.CountDAOAgent',
              disabledTypes: [ 'structure', 'format', 'chart' ] }
    },
    { class: 'Boolean', name: 'showValues', label: 'Show Values', help: 'Write each cell\'s value inside it when the text fits' },
    {
      class: 'Code',
      name: 'onClickScript',
      label: 'On Click Script',
      help: 'Function expression called when a cell is clicked. Signature: (value, xLabel, yLabel, x, y, pageX, pageY) => void'
    },
    { class: 'String', name: 'xAxisLabel', label: 'X-Axis Label' },
    { class: 'String', name: 'yAxisLabel', label: 'Y-Axis Label' },
    {
      class: 'String',
      name: 'emptyValueMessage',
      label: 'Empty Message',
      help: 'Shown in place of the chart when the query finds no rows. Left empty, it says "No data available".'
    },
    // GridBy internals wired programmatically by createSink()
    { name: 'acc', hidden: true },
    { name: 'rows', hidden: true },
    { name: 'cols', hidden: true },
    { name: 'x', hidden: true },
    { name: 'y', hidden: true },
    { name: 'query', hidden: true },
    { name: 'selection', hidden: true },
    {
      name: 'chart_',
      hidden: true,
      transient: true,
      expression: function(cols, rows, colors, xAxisLabel, yAxisLabel, showValues, showLegend,
                          legendPosition, showTooltips, animate, animationDuration, onClickScript) {
        var rowGroups = rows && rows.groups ? rows.groups : {};
        var self      = this;
        var colKeys   = this.groupKeys_(cols);
        var rowKeys   = this.groupKeys_(rows);

        // A date field labels its cells as the bar charts do ("2024-03-01");
        // anything else, a date expression such as the hour included, is
        // labelled by its own key.
        var text = function(f, key) { return f && f.chartFormatter ? f.chartFormatter(key) : key; };
        var labels = colKeys.map(function(k) { return String(text(self.xFunc, k)); });

        // One dataset per row. A pair with no rows has no group, and its
        // value stays null: an empty cell, not a zero.
        var datasets = rowKeys.map(function(rk, i) {
          var sub = rowGroups[rk] && rowGroups[rk].groups || {};
          var ds  = {
            label: String(text(self.yFunc, rk)),
            data:  colKeys.map(function(ck) { return sub[ck] ? sub[ck].value : null; })
          };
          // The first dataset's colour is the strong end of the scale.
          if ( ! i && colors && colors.length ) ds.backgroundColor = foam.CSS.returnTokenValue(colors[0], self.cls_, self.__context__);
          return ds;
        });

        // The form's On Click Script is a function expression, called with
        // (value, xLabel, yLabel, x, y, pageX, pageY) for the clicked cell:
        // its value, its column and row names, the point inside the chart
        // and the point on the page.
        var click = null;
        if ( onClickScript ) {
          try {
            click = eval(onClickScript);
          } catch ( e ) {
            console.warn('Invalid onClickScript for DashboardHeatmapSink:', e);
          }
        }

        return this.HeatmapChart.create({
          labels:            labels,
          datasets:          datasets,
          // With no title typed in, an axis is titled with its field's label,
          // as the line chart does: "Amount", not a blank axis.
          xAxisLabel:        xAxisLabel || this.labelOf_(this.xFunc),
          yAxisLabel:        yAxisLabel || this.labelOf_(this.yFunc),
          showValues:        showValues,
          showLegend:        showLegend,
          legendPosition:    legendPosition,
          showTooltips:      showTooltips,
          animate:           animate,
          animationDuration: animationDuration,
          onCellClick: typeof click !== 'function' ? null : function(xi, yi, evt) {
            try {
              var box = evt.target.ownerSVGElement.getBoundingClientRect();
              click(datasets[yi].data[xi], labels[xi], datasets[yi].label,
                evt.clientX - box.left, evt.clientY - box.top, evt.pageX, evt.pageY);
            } catch ( e ) {
              console.warn('Error executing onClickScript:', e);
            }
          }
        });
      }
    }
  ],

  methods: [
    function addToE(e) {
      e.style({ width: '100%' });
      this.addChartOrEmpty_(e, this.chart_.labels.length, this.emptyValueMessage);
    }
  ]
});

foam.CLASS({
  package: 'foam.core.reflow.dashboard',
  name: 'DashboardHistogramSink',
  extends: 'foam.dao.AbstractSink',
  mixins: [
    'foam.core.reflow.dashboard.ChartDisplayMixin',
    'foam.core.reflow.dashboard.ColorMappingMixin'
  ],

  documentation: `
    The distribution of one numeric property of the rows, such as the size of
    a payment: the chart cuts its range into bins and counts the rows in each.
    A row whose value is not a number (a date, text or yes/no value) is left
    out. Giving a Series property draws one set of bars and one legend entry
    per value of it, e.g. one per request method, over the same bins; a row with
    no value there is left out too.
  `,

  requires: [
    'foam.u2.chart.HistogramChart'
  ],

  sections: [
    { name: 'dataConfig', title: 'Data Configuration', order: 0, collapsable: true,
      properties: ['valueProp', 'seriesProp'] },
    { name: 'chartSettings', title: 'Histogram Settings', order: 1, collapsable: true,
      properties: ['binCount', 'xAxisLabel', 'yAxisLabel', 'showGridLines', 'onClickScript'] },
    { name: 'displayOptions', title: 'Display', order: 2, collapsable: true,
      properties: ['height', 'showLegend', 'legendPosition', 'showTooltips', 'animate', 'animationDuration', 'emptyValueMessage'] },
    { name: 'colorConfig', title: 'Colors', order: 3, collapsable: true,
      properties: ['colors'] },
    // The histogram has no alignment, aspect ratio or tooltip sum, but
    // ChartDisplayMixin adds them. A mixin's properties install after this
    // class's own, so an override cannot hide them; this section, never
    // shown, holds them instead.
    { name: 'unused', isAvailable: function() { return false; },
      properties: ['alignment', 'maintainAspectRatio', 'showTooltipSum'] }
  ],

  messages: [
    { name: 'DEFAULT_SERIES', message: 'Values' },
    { name: 'COUNT',          message: 'Count' }
  ],

  properties: [
    // generateJava: false: this sink's put() has no Java code, and its Java
    // class never had these fields.
    { class: 'foam.core.reflow.dashboard.ChartFieldProperty', name: 'valueProp', label: 'Value Property', help: 'Numeric property whose distribution is drawn', required: true, generateJava: false },
    {
      class: 'foam.core.reflow.dashboard.ChartChoiceFieldProperty', generateJava: false,
      name: 'seriesProp', label: 'Series Property',
      help: 'Optional: one set of bars and legend entry per value of this property'
    },
    {
      class: 'Int',
      name: 'binCount',
      label: 'Number of Bins',
      help: 'About how many bins; the edges are rounded to nice numbers, so the chart may draw a few more or fewer',
      value: 10
    },
    { class: 'String', name: 'xAxisLabel', label: 'X-Axis Label', help: 'Left empty, it is the label of the Value Property' },
    { class: 'String', name: 'yAxisLabel', label: 'Y-Axis Label', help: 'Left empty, it says "Count"' },
    { class: 'Boolean', name: 'showGridLines', label: 'Show Grid Lines', value: true },
    {
      class: 'Code',
      name: 'onClickScript',
      label: 'On Click Script',
      help: 'Function expression called when a bar is clicked. Signature: (binStart, binEnd, count, series, chartX, chartY, pageX, pageY) => void'
    },
    {
      class: 'String',
      name: 'emptyValueMessage',
      label: 'Empty Message',
      help: 'Shown in place of the chart when the query finds no values. Left empty, it says "No data available".'
    },
    {
      class: 'Array',
      name: 'series_',
      hidden: true,
      // Values collected by put(), one entry per series in the order first seen:
      // [ { label: 'GET', data: [ 12.5, 40 ] } ]. Kept as plain arrays, since
      // the sink is copied and sent as JSON during a select, and a JS Map
      // arrives as {} and then fails in put(). Transient, so the values of
      // one run are never saved into the flow.
      transient: true
    },
    {
      name: 'chart_',
      hidden: true,
      transient: true,
      // Read once, by addToE, after the select has collected every value.
      factory: function() {
        var self = this;
        var datasets = this.series_.map(function(e, i) {
          var c = self.colors && self.colors.length ? self.colors[i % self.colors.length] : undefined;
          return {
            label: e.label,
            data: e.data,
            backgroundColor: c ? foam.CSS.returnTokenValue(c, self.cls_, self.__context__) : undefined
          };
        });
        // The form's On Click Script is a function expression, called with
        // (binStart, binEnd, count, series, chartX, chartY, pageX, pageY) for
        // the clicked bar: the bin's range, how many values it holds, the
        // series name, the point inside the chart and the point on the page.
        var click = null;
        if ( this.onClickScript ) {
          try {
            click = eval(this.onClickScript);
          } catch ( e ) {
            console.warn('Invalid onClickScript for DashboardHistogramSink:', e);
          }
        }
        var chart = this.HistogramChart.create({
          datasets:          datasets,
          binCount:          this.binCount,
          // With no title typed in, the x axis takes its field's label, as
          // the line chart does: "Amount", not a blank axis.
          xAxisLabel:        this.xAxisLabel || this.labelOf_(this.valueProp),
          yAxisLabel:        this.yAxisLabel || this.COUNT,
          showGridLines:     this.showGridLines,
          showLegend:        this.showLegend,
          legendPosition:    this.legendPosition,
          showTooltips:      this.showTooltips,
          animate:           this.animate,
          animationDuration: this.animationDuration,
          onBinClick: typeof click !== 'function' ? null : function(di, j, evt) {
            try {
              var b   = chart.bins();
              var box = evt.target.ownerSVGElement.getBoundingClientRect();
              click(b.edges[j], b.edges[j + 1], b.counts[di][j], datasets[di].label,
                evt.clientX - box.left, evt.clientY - box.top, evt.pageX, evt.pageY);
            } catch ( e ) {
              console.warn('Error executing onClickScript:', e);
            }
          }
        });
        return chart;
      }
    }
  ],

  methods: [
    function put(obj) {
      // Only number values count: a date would be binned as milliseconds
      // since 1970 and yes/no as 0 or 1. NaN and Infinity are left to the chart.
      var v = this.valueProp.f(obj);
      if ( typeof v !== 'number' ) return;
      var key = this.labelOf_(this.valueProp) || this.DEFAULT_SERIES;
      if ( ! this.hasDefaultValue('seriesProp') ) {
        // A row with no series value is left out, as the calendar chart does,
        // rather than drawn as a series called "undefined".
        var s = this.seriesProp.f(obj);
        if ( s == null || s === '' ) return;
        key = String(s);
      }
      var e = this.series_.find(function(e) { return e.label === key; });
      if ( ! e ) this.series_.push(e = { label: key, data: [] });
      e.data.push(v);
    },

    function addToE(e) {
      e.style({ width: '100%' });
      this.addChartOrEmpty_(e, this.series_.length, this.emptyValueMessage);
    }
  ]
});

foam.CLASS({
  package: 'foam.core.reflow.dashboard',
  name: 'DashboardWaterfallSink',
  extends: 'foam.mlang.sink.GroupBy',

  mixins: [
    'foam.core.reflow.dashboard.ChartDisplayMixin',
    'foam.core.reflow.dashboard.ColorMappingMixin'
  ],

  documentation: `
    Groups the rows by one field, in the field's order, and aggregates one
    value per group (a Count, or a Sum or Average of a numeric field). Each
    group is one step of a waterfall. By default a step is the group's value
    itself: sales per month of 40, -15 and 25 give a rise, a fall and a rise.
    With Change From Previous on, a step is the group's value minus the one
    before it, so a value that is never negative, such as requests per hour,
    still shows rises and falls: 40, 25 and 50 give +40, -15 and +25. The
    first group has nothing before it, so it counts as a step up from zero.
    The first three colours in Colors are the rise, fall and total bars.
  `,

  requires: [
    'foam.u2.chart.WaterfallChart'
  ],

  sections: [
    { name: 'dataConfig', title: 'Data Configuration', order: 0, collapsable: true,
      properties: ['arg1', 'aggregation', 'changeFromPrevious'] },
    { name: 'chartSettings', title: 'Waterfall Settings', order: 1, collapsable: true,
      properties: ['showTotal', 'showGridLines', 'onClickScript'] },
    { name: 'axisLabels', title: 'Axis Labels', order: 2, collapsable: true,
      properties: ['xAxisLabel', 'yAxisLabel'] },
    { name: 'displayOptions', title: 'Display', order: 3, collapsable: true,
      properties: ['height', 'showLegend', 'legendPosition', 'showTooltips', 'animate', 'animationDuration', 'emptyValueMessage'] },
    { name: 'colorConfig', title: 'Colors', order: 4, collapsable: true,
      properties: ['colors'] },
    // The waterfall has no alignment, aspect ratio or tooltip sum, but
    // ChartDisplayMixin adds them. A mixin's properties install after this
    // class's own, so an override cannot hide them; this section, never
    // shown, holds them instead.
    { name: 'unused', isAvailable: function() { return false; },
      properties: ['alignment', 'maintainAspectRatio', 'showTooltipSum'] }
  ],

  properties: [
    { class: 'foam.core.reflow.dashboard.ChartFieldProperty', name: 'arg1', label: 'Group By', required: true,
      help: 'One step for each value of this property, in its order: the hour of a date, say' },
    {
      // An FObjectProperty, so copying the sink into a flow's context also
      // moves the Sum or Count agent there. JS only: the DAO agents it holds
      // do not exist in Java.
      class: 'FObjectProperty', generateJava: false, autoValidate: true,
      name: 'aggregation', label: 'Aggregation',
      view: { class: 'foam.core.reflow.SinkView',
              choice: 'foam.core.reflow.CountDAOAgent',
              disabledTypes: [ 'structure', 'format', 'chart' ] }
    },
    {
      class: 'Boolean',
      name: 'changeFromPrevious',
      label: 'Change From Previous',
      help: 'Plot how each group differs from the one before it, not the group\'s own value'
    },
    { class: 'Boolean', name: 'showTotal', label: 'Show Total', value: true, help: 'Add a last bar with the end total' },
    { class: 'Boolean', name: 'showGridLines', label: 'Show Grid Lines', value: true },
    {
      class: 'Code',
      name: 'onClickScript',
      label: 'On Click Script',
      help: 'Function expression called when a step is clicked. Signature: (change, label, total, x, y, pageX, pageY) => void, where total is the running total after the step'
    },
    { class: 'String', name: 'xAxisLabel', label: 'X-Axis Label' },
    { class: 'String', name: 'yAxisLabel', label: 'Y-Axis Label' },
    {
      class: 'String',
      name: 'emptyValueMessage',
      label: 'Empty Message',
      help: 'Shown in place of the chart when the query finds no rows. Left empty, it says "No data available".'
    },
    // GroupBy internals wired programmatically by createSink()
    { name: 'arg2', hidden: true },
    { name: 'groupLimit', hidden: true },
    {
      name: 'chart_',
      hidden: true,
      transient: true,
      expression: function(groups, colors, changeFromPrevious, showTotal, xAxisLabel, yAxisLabel,
                          showGridLines, showLegend, legendPosition, showTooltips,
                          animate, animationDuration, onClickScript) {
        var self = this;
        var keys = this.groupKeys_(this);

        var labels = keys.map(function(k) {
          return String(self.arg1 && self.arg1.chartFormatter ? self.arg1.chartFormatter(k) : k);
        });
        var values = keys.map(function(k) { return Number(groups[k] && groups[k].value) || 0; });
        // Each step is the group's value less the one before it; the first
        // group counts from zero.
        var steps  = changeFromPrevious ?
          values.map(function(v, i) { return v - ( i ? values[i - 1] : 0 ); }) : values;

        // The form's On Click Script is called with (change, label, total, x,
        // y, pageX, pageY): the clicked step's change and name, the running
        // total after it, the point inside the chart and the point on the page.
        var click = null;
        if ( onClickScript ) {
          try {
            click = eval(onClickScript);
          } catch ( e ) {
            console.warn('Invalid onClickScript for DashboardWaterfallSink:', e);
          }
        }

        var chart = this.WaterfallChart.create({
          labels:            labels,
          datasets:          [ {
            data:            steps,
            backgroundColor: colors && colors.length ?
              colors.slice(0, 3).map(function(c) { return foam.CSS.returnTokenValue(c, self.cls_, self.__context__); }) : undefined
          } ],
          showTotal:         showTotal,
          // With no title typed in, the x axis is titled with its field's label.
          xAxisLabel:        xAxisLabel || this.labelOf_(this.arg1),
          yAxisLabel:        yAxisLabel,
          showGridLines:     showGridLines,
          showLegend:        showLegend,
          legendPosition:    legendPosition,
          showTooltips:      showTooltips,
          animate:           animate,
          animationDuration: animationDuration,
          onStepClick: typeof click !== 'function' ? null : function(i, evt) {
            try {
              var box   = evt.target.ownerSVGElement.getBoundingClientRect();
              var total = steps.slice(0, i + 1).reduce(function(a, v) { return a + v; }, 0);
              // The total bar, one past the last step, has no step of its own.
              var step  = i < steps.length ? steps[i] : total;
              click(step, i < labels.length ? labels[i] : chart.TOTAL, total,
                evt.clientX - box.left, evt.clientY - box.top, evt.pageX, evt.pageY);
            } catch ( e ) {
              console.warn('Error executing onClickScript:', e);
            }
          }
        });
        return chart;
      }
    }
  ],

  methods: [
    function addToE(e) {
      e.style({ width: '100%' });
      this.addChartOrEmpty_(e, this.chart_.labels.length, this.emptyValueMessage);
    }
  ]
});

foam.CLASS({
  package: 'foam.core.reflow.dashboard',
  name: 'DashboardFunnelSink',
  extends: 'foam.mlang.sink.GroupBy',

  mixins: [
    'foam.core.reflow.dashboard.ChartDisplayMixin',
    'foam.core.reflow.dashboard.ColorMappingMixin'
  ],

  documentation: `
    Groups the rows by one field, in the field's order, and aggregates one
    value per group (a Count, or a Sum or Average of a numeric field). Each
    group is one step of a funnel, drawn as a band as wide as its value: the
    visits to each page, say. The steps keep the order of the field, as a
    funnel's order is the process order; Sort By Value puts the largest
    first instead. A row with no value in Group By, and a group whose value
    is negative, adds no step.
  `,

  requires: [
    'foam.u2.chart.FunnelChart'
  ],

  sections: [
    { name: 'dataConfig', title: 'Data Configuration', order: 0, collapsable: true,
      properties: ['arg1', 'aggregation', 'sortByValue'] },
    { name: 'chartSettings', title: 'Funnel Settings', order: 1, collapsable: true,
      properties: ['onClickScript'] },
    { name: 'displayOptions', title: 'Display', order: 2, collapsable: true,
      properties: ['height', 'showLegend', 'legendPosition', 'showTooltips', 'animate', 'animationDuration', 'emptyValueMessage'] },
    { name: 'colorConfig', title: 'Colors', order: 3, collapsable: true,
      properties: ['colors'] },
    // The funnel has no alignment, aspect ratio or tooltip sum, but
    // ChartDisplayMixin adds them. A mixin's properties install after this
    // class's own, so an override cannot hide them; this section, never
    // shown, holds them instead.
    { name: 'unused', isAvailable: function() { return false; },
      properties: ['alignment', 'maintainAspectRatio', 'showTooltipSum'] }
  ],

  properties: [
    { class: 'foam.core.reflow.dashboard.ChartFieldProperty', name: 'arg1', label: 'Group By', required: true,
      help: 'One step for each value of this property, in its order: the hour of a date, say' },
    {
      // An FObjectProperty, so copying the sink into a flow's context also
      // moves the Sum or Count agent there. JS only: the DAO agents it holds
      // do not exist in Java.
      class: 'FObjectProperty', generateJava: false, autoValidate: true,
      name: 'aggregation', label: 'Aggregation',
      view: { class: 'foam.core.reflow.SinkView',
              choice: 'foam.core.reflow.CountDAOAgent',
              disabledTypes: [ 'structure', 'format', 'chart' ] }
    },
    {
      class: 'Boolean',
      name: 'sortByValue',
      label: 'Sort By Value',
      help: 'Put the step with the largest value first, instead of keeping the order of Group By'
    },
    {
      class: 'Code',
      name: 'onClickScript',
      label: 'On Click Script',
      help: 'Function expression called when a step is clicked. Signature: (value, label, x, y, pageX, pageY) => void'
    },
    {
      class: 'String',
      name: 'emptyValueMessage',
      label: 'Empty Message',
      help: 'Shown in place of the chart when the query finds no rows. Left empty, it says "No data available".'
    },
    // GroupBy internals wired programmatically by createSink()
    { name: 'arg2', hidden: true },
    { name: 'groupLimit', hidden: true },
    {
      name: 'chart_',
      hidden: true,
      transient: true,
      expression: function(groups, colors, sortByValue, showLegend, legendPosition, showTooltips,
                          animate, animationDuration, onClickScript) {
        var self = this;
        var keys = this.groupKeys_(this);
        var vals = {};
        keys.forEach(function(k) { vals[k] = Number(groups[k] && groups[k].value) || 0; });
        // Largest first, and a tie keeps the field's order.
        if ( sortByValue ) keys = keys.slice().sort(function(a, b) { return vals[b] - vals[a]; });

        var labels = keys.map(function(k) {
          return String(self.arg1 && self.arg1.chartFormatter ? self.arg1.chartFormatter(k) : k);
        });
        var values = keys.map(function(k) { return vals[k]; });

        // The form's On Click Script is called with (value, label, x, y,
        // pageX, pageY): the clicked step's value and name, the point inside
        // the chart and the point on the page.
        var click = null;
        if ( onClickScript ) {
          try {
            click = eval(onClickScript);
          } catch ( e ) {
            console.warn('Invalid onClickScript for DashboardFunnelSink:', e);
          }
        }

        return this.FunnelChart.create({
          labels:            labels,
          datasets:          [ {
            data:            values,
            backgroundColor: colors && colors.length ?
              colors.map(function(c) { return foam.CSS.returnTokenValue(c, self.cls_, self.__context__); }) : undefined
          } ],
          showLegend:        showLegend,
          legendPosition:    legendPosition,
          showTooltips:      showTooltips,
          animate:           animate,
          animationDuration: animationDuration,
          onStepClick: typeof click !== 'function' ? null : function(i, evt) {
            try {
              var box = evt.target.ownerSVGElement.getBoundingClientRect();
              click(values[i], labels[i], evt.clientX - box.left, evt.clientY - box.top, evt.pageX, evt.pageY);
            } catch ( e ) {
              console.warn('Error executing onClickScript:', e);
            }
          }
        });
      }
    }
  ],

  methods: [
    function addToE(e) {
      e.style({ width: '100%' });
      this.addChartOrEmpty_(e, this.chart_.labels.length, this.emptyValueMessage);
    }
  ]
});

foam.CLASS({
  package: 'foam.core.reflow.dashboard',
  name: 'DashboardBoxPlotSink',
  extends: 'foam.core.reflow.GridBy',

  mixins: [
    'foam.core.reflow.dashboard.ChartDisplayMixin',
    'foam.core.reflow.dashboard.ColorMappingMixin'
  ],

  documentation: `
    The spread of a number per category: one box per value of the Category
    property, drawn from every Value property seen in it (the count of
    requests, say, per event key). The box runs from the first to the third
    quartile, with a line at the median, whiskers, and a dot for each outlier.
    Giving a Series property draws one box per value of it in each category,
    in its own colour. A row with no category, no series value (when a Series
    property is set) or a value that is not a number is left out.
  `,

  requires: [
    'foam.u2.chart.BoxPlotChart'
  ],

  sections: [
    { name: 'dataConfig', title: 'Data Configuration', order: 0, collapsable: true,
      properties: ['xFunc', 'valueProp', 'yFunc'] },
    { name: 'chartSettings', title: 'Box Plot Settings', order: 1, collapsable: true,
      properties: ['xAxisLabel', 'yAxisLabel', 'showGridLines', 'onClickScript'] },
    { name: 'displayOptions', title: 'Display', order: 2, collapsable: true,
      properties: ['height', 'showLegend', 'legendPosition', 'showTooltips', 'animate', 'animationDuration', 'emptyValueMessage'] },
    { name: 'colorConfig', title: 'Colors', order: 3, collapsable: true,
      properties: ['colors'] },
    // The box plot has no alignment, aspect ratio or tooltip sum, but
    // ChartDisplayMixin adds them. A mixin's properties install after this
    // class's own, so an override cannot hide them; this section, never
    // shown, holds them instead.
    { name: 'unused', isAvailable: function() { return false; },
      properties: ['alignment', 'maintainAspectRatio', 'showTooltipSum'] }
  ],

  messages: [
    { name: 'DEFAULT_SERIES', message: 'Values' }
  ],

  properties: [
    { class: 'foam.core.reflow.dashboard.ChartFieldProperty', name: 'xFunc', label: 'Category Property', help: 'One box per value of this property', required: true },
    {
      class: 'foam.core.reflow.dashboard.ChartFieldProperty',
      name: 'valueProp', label: 'Value Property', required: true,
      help: 'Numeric property whose spread each box shows'
    },
    {
      class: 'foam.core.reflow.dashboard.ChartChoiceFieldProperty',
      name: 'yFunc', label: 'Series Property',
      help: 'Optional: one box per value of this property in each category, in its own colour'
    },
    { class: 'String', name: 'xAxisLabel', label: 'X-Axis Label' },
    { class: 'String', name: 'yAxisLabel', label: 'Y-Axis Label' },
    { class: 'Boolean', name: 'showGridLines', label: 'Show Grid Lines', value: true },
    {
      class: 'Code',
      name: 'onClickScript',
      label: 'On Click Script',
      help: 'Function expression called when a box is clicked. Signature: (median, category, series, chartX, chartY, pageX, pageY) => void'
    },
    {
      class: 'String',
      name: 'emptyValueMessage',
      label: 'Empty Message',
      help: 'Shown in place of the chart when the query finds no numbers. Left empty, it says "No data available".'
    },
    // GridBy internals wired programmatically by createSink()
    { name: 'acc', hidden: true },
    { name: 'rows', hidden: true },
    { name: 'cols', hidden: true },
    { name: 'x', hidden: true },
    { name: 'y', hidden: true },
    { name: 'query', hidden: true },
    { name: 'selection', hidden: true },
    {
      name: 'chart_',
      hidden: true,
      transient: true,
      expression: function(cols, rows, colors, xAxisLabel, yAxisLabel, showGridLines, showLegend,
                          legendPosition, showTooltips, animate, animationDuration, onClickScript) {
        var self      = this;
        var rowGroups = rows && rows.groups ? rows.groups : {};
        var keys = function(g) { return self.groupKeys_(g); };

        // cols.groups holds the categories and rows.groups the series; the
        // numbers of one box are rows.groups[series].groups[category].data,
        // a list of one-entry lists [ value ], as the Plot sink keeps them.
        var valuesOf = function(seriesKey, catKey) {
          var cell = rowGroups[seriesKey] && rowGroups[seriesKey].groups[catKey];
          return cell && cell.data ? cell.data.map(function(d) { return d[0]; }).filter(function(v) { return typeof v === 'number'; }) : [];
        };
        var seriesKeys = keys(rows);
        // A category with no number in any series has no box: it is left out.
        var catKeys = keys(cols).filter(function(c) { return seriesKeys.some(function(s) { return valuesOf(s, c).length; }); });

        var labels   = catKeys.map(function(k) { return String(self.xFunc && self.xFunc.chartFormatter ? self.xFunc.chartFormatter(k) : k); });
        var datasets = seriesKeys.map(function(seriesKey, i) {
          var ds = { label: String(seriesKey), data: catKeys.map(function(c) { return valuesOf(seriesKey, c); }) };
          if ( colors && colors.length ) {
            ds.backgroundColor = foam.CSS.returnTokenValue(colors[i % colors.length], self.cls_, self.__context__);
          }
          return ds;
        });

        // The form's On Click Script is a function expression, called with
        // (median, category, series, chartX, chartY, pageX, pageY) for the
        // clicked box: its median, its category and series names, the point
        // inside the chart and the point on the page.
        var click = null;
        if ( onClickScript ) {
          try {
            click = eval(onClickScript);
          } catch ( e ) {
            console.warn('Invalid onClickScript for DashboardBoxPlotSink:', e);
          }
        }

        var chart = this.BoxPlotChart.create({
          labels:            labels,
          datasets:          datasets,
          // With no title typed in, an axis is titled with its field's label,
          // as the line chart does: "Amount", not a blank axis.
          xAxisLabel:        xAxisLabel || this.labelOf_(this.xFunc),
          yAxisLabel:        yAxisLabel || this.labelOf_(this.valueProp),
          showGridLines:     showGridLines,
          showLegend:        showLegend,
          legendPosition:    legendPosition,
          showTooltips:      showTooltips,
          animate:           animate,
          animationDuration: animationDuration
        });
        if ( typeof click === 'function' ) {
          chart.onBoxClick = function(di, j, evt) {
            try {
              var box = evt.target.ownerSVGElement.getBoundingClientRect();
              click(chart.stats_(datasets[di].data[j]).median, labels[j], datasets[di].label,
                evt.clientX - box.left, evt.clientY - box.top, evt.pageX, evt.pageY);
            } catch ( e ) {
              console.warn('Error executing onClickScript:', e);
            }
          };
        }
        return chart;
      }
    }
  ],

  methods: [
    function addToE(e) {
      e.style({ width: '100%' });
      this.addChartOrEmpty_(e, this.chart_.labels.length, this.emptyValueMessage);
    }
  ]
});

foam.CLASS({
  package: 'foam.core.reflow.dashboard',
  name: 'DashboardTreemapSink',
  extends: 'foam.mlang.sink.TopNGroupBy',

  mixins: [
    'foam.core.reflow.dashboard.ChartDisplayMixin',
    'foam.core.reflow.dashboard.ColorMappingMixin'
  ],

  documentation: `
    Groups the rows by one field and aggregates one value per group (a Count,
    or a Sum or Average of a numeric field). Each group is one rectangle of a
    treemap, its area in proportion to the group's value. With Top N set, the
    biggest N groups get a rectangle each and the rest share one called
    "Others": requests per page, with 40 pages and a Top N of 10, give ten
    pages and an "Others".
  `,

  requires: [
    'foam.u2.chart.TreemapChart'
  ],

  sections: [
    { name: 'dataConfig', title: 'Data Configuration', order: 0, collapsable: true,
      properties: ['arg1', 'aggregation', 'topN', 'includeOthers', 'sortOrder', 'othersLabel'] },
    { name: 'chartSettings', title: 'Treemap Settings', order: 1, collapsable: true,
      properties: ['onClickScript'] },
    { name: 'displayOptions', title: 'Display', order: 2, collapsable: true,
      properties: ['height', 'showLegend', 'legendPosition', 'showTooltips', 'animate', 'animationDuration', 'emptyValueMessage'] },
    { name: 'colorConfig', title: 'Colors', order: 3, collapsable: true,
      properties: ['colors'] },
    // The treemap has no alignment, aspect ratio or tooltip sum, but
    // ChartDisplayMixin adds them. A mixin's properties install after this
    // class's own, so an override cannot hide them; this section, never
    // shown, holds them instead.
    { name: 'unused', isAvailable: function() { return false; },
      properties: ['alignment', 'maintainAspectRatio', 'showTooltipSum'] }
  ],

  properties: [
    { class: 'foam.core.reflow.dashboard.ChartFieldProperty', name: 'arg1', label: 'Group By', required: true,
      help: 'One rectangle for each value of this property: the page of a request, say' },
    {
      // An FObjectProperty, so copying the sink into a flow's context also
      // moves the Sum or Count agent there. JS only: the DAO agents it holds
      // do not exist in Java.
      class: 'FObjectProperty', generateJava: false, autoValidate: true,
      name: 'aggregation', label: 'Aggregation',
      view: { class: 'foam.core.reflow.SinkView',
              choice: 'foam.core.reflow.CountDAOAgent',
              disabledTypes: [ 'structure', 'format', 'chart' ] }
    },
    { class: 'Int', name: 'topN', label: 'Top N', value: 10,
      help: 'Keep the N biggest groups, each with its own rectangle (0 = every group). The rest can be merged into "Others".' },
    { class: 'Boolean', name: 'includeOthers', label: 'Include Others', value: true,
      help: 'Give the groups outside the top N one rectangle together',
      visibility: function(topN) {
        return topN > 0 ? foam.u2.DisplayMode.RW : foam.u2.DisplayMode.HIDDEN;
      } },
    { class: 'Enum', of: 'foam.mlang.sink.GroupBySortOrder', name: 'sortOrder', label: 'Sort Order', value: 'DESC',
      help: 'DESC keeps the biggest groups, ASC the smallest',
      visibility: function(topN) {
        return topN > 0 ? foam.u2.DisplayMode.RW : foam.u2.DisplayMode.HIDDEN;
      } },
    { class: 'String', name: 'othersLabel', label: 'Others Label', value: 'Others',
      help: 'Label for the merged "Others" rectangle',
      visibility: function(topN) {
        return topN > 0 ? foam.u2.DisplayMode.RW : foam.u2.DisplayMode.HIDDEN;
      } },
    {
      class: 'Code',
      name: 'onClickScript',
      label: 'On Click Script',
      help: 'Function expression called when a rectangle is clicked. Signature: (value, label, total, x, y, pageX, pageY) => void, where total is the sum of every rectangle'
    },
    {
      class: 'String',
      name: 'emptyValueMessage',
      label: 'Empty Message',
      help: 'Shown in place of the chart when the query finds no rows. Left empty, it says "No data available".'
    },
    // TopNGroupBy internals wired programmatically by createSink()
    { name: 'arg2', hidden: true },
    { name: 'groupKeys', hidden: true },
    { name: 'processArrayValuesIndividually', hidden: true },
    { name: 'groupLimit', hidden: true },
    {
      name: 'chart_',
      hidden: true,
      transient: true,
      expression: function(groups, groupKeys, colors, showLegend, legendPosition, showTooltips,
                          animate, animationDuration, onClickScript) {
        var self = this;
        // With Top N set the server's order is kept in groupKeys, with
        // "Others" last; otherwise the keys are sorted.
        var keys = this.topN > 0 && groupKeys && groupKeys.length ?
          groupKeys.filter(function(k) { return ! this.isEmptyKey_(k); }, this) :
          this.groupKeys_(this);

        var labels = keys.map(function(k) {
          return String(self.arg1 && self.arg1.chartFormatter ? self.arg1.chartFormatter(k) : k);
        });
        var data = keys.map(function(k) { return Number(groups[k] && groups[k].value) || 0; });
        // A rectangle keeps its colour by its position, so hiding another one does not change it.
        var backgroundColors = colors && colors.length ?
          keys.map(function(k, i) {
            return foam.CSS.returnTokenValue(colors[i % colors.length], self.cls_, self.__context__);
          }) : undefined;

        // The form's On Click Script is called with (value, label, total, x,
        // y, pageX, pageY): the clicked rectangle's value and name, the sum of
        // every rectangle, the point inside the chart and the point on the page.
        var click = null;
        if ( onClickScript ) {
          try {
            click = eval(onClickScript);
          } catch ( e ) {
            console.warn('Invalid onClickScript for DashboardTreemapSink:', e);
          }
        }
        var total = data.reduce(function(a, v) { return v > 0 ? a + v : a; }, 0);

        return this.TreemapChart.create({
          labels:            labels,
          datasets:          [ { data: data, backgroundColor: backgroundColors } ],
          showLegend:        showLegend,
          legendPosition:    legendPosition,
          showTooltips:      showTooltips,
          animate:           animate,
          animationDuration: animationDuration,
          onRectClick: typeof click !== 'function' ? null : function(i, evt) {
            try {
              var box = evt.target.ownerSVGElement.getBoundingClientRect();
              click(data[i], labels[i], total, evt.clientX - box.left, evt.clientY - box.top, evt.pageX, evt.pageY);
            } catch ( e ) {
              console.warn('Error executing onClickScript:', e);
            }
          }
        });
      }
    }
  ],

  methods: [
    function addToE(e) {
      e.style({ width: '100%' });
      this.addChartOrEmpty_(e, this.chart_.labels.length, this.emptyValueMessage);
    }
  ]
});

foam.CLASS({
  package: 'foam.core.reflow.dashboard',
  name: 'DashboardTotalSink',
  extends: 'foam.dao.AbstractSink',
  implements: [ 'foam.lang.Serializable' ],

  documentation: `
    A sink that adds every row to one aggregate, its total: a Count, or the
    Sum, Average, Min or Max of a field. A select runs it on the server, where
    put runs in Java, and the total comes back with the result.
  `,

  constants: [
    // The field the agent's buildTotal_() puts each run's aggregate in.
    { name: 'TOTAL_SLOT', value: 'total' }
  ],

  properties: [
    {
      // The aggregate this run collects, wired by the agent's createSink().
      class: 'foam.mlang.SinkProperty',
      name: 'total',
      externalTransient: true,
      hidden: true,
      javaFactory: 'return foam.mlang.MLang.COUNT();',
      factory: function() { return foam.mlang.sink.Count.create(); }
    }
  ],

  methods: [
    {
      name: 'put',
      code: function put(obj, sub) { this.total.put(obj, sub); },
      javaCode: 'getTotal().put(obj, sub);'
    },

    // A client DAO caches a select by the sink's text; naming the total keeps
    // a Sum of one field apart from a Count or the Sum of another. A mixin's
    // toString (ChartDisplayMixin's) wraps this one, so it sits in a parent.
    function toString() { return String(this.total); }
  ]
});

foam.CLASS({
  package: 'foam.core.reflow.dashboard',
  name: 'DashboardGaugeSink',
  extends: 'foam.core.reflow.dashboard.DashboardTotalSink',

  mixins: [
    'foam.core.reflow.dashboard.ChartDisplayMixin'
  ],

  documentation: `
    One number against a range, drawn as a half-circle dial: the Aggregation
    (a Count, or the Sum, Average, Min or Max of a numeric field) over every
    row, against Maximum. Today's request count against a target of 500 reads
    as a dial filled to the share of 500 it reached. The range starts at 0.
    Bands colour stretches of the dial, for example red up to 50, amber up to
    80 and green up to 100. The aggregate is worked out on the server, where
    this sink's put runs in Java.
  `,

  requires: [
    'foam.u2.chart.GaugeChart'
  ],

  sections: [
    { name: 'dataConfig', title: 'Data Configuration', order: 0, collapsable: true,
      properties: [ 'aggregation', 'maxValue', 'bands' ] },
    { name: 'chartSettings', title: 'Gauge Settings', order: 1, collapsable: true,
      properties: [ 'onClickScript' ] },
    { name: 'displayOptions', title: 'Display', order: 2, collapsable: true,
      properties: [ 'height', 'showLegend', 'legendPosition', 'showTooltips', 'animate', 'animationDuration', 'emptyValueMessage' ] },
    // The gauge has no alignment, aspect ratio or tooltip sum, but
    // ChartDisplayMixin adds them. A mixin's properties install after this
    // class's own, so an override cannot hide them; this section, never
    // shown, holds them instead.
    { name: 'unused', isAvailable: function() { return false; },
      properties: [ 'alignment', 'maintainAspectRatio', 'showTooltipSum' ] }
  ],

  messages: [
    { name: 'DEFAULT_SERIES', message: 'Value' }
  ],

  properties: [
    {
      // An FObjectProperty, so copying the sink into a flow's context also
      // moves the Sum or Count agent there. JS only: the DAO agents it holds
      // do not exist in Java.
      class: 'FObjectProperty', generateJava: false, autoValidate: true,
      name: 'aggregation', label: 'Aggregation',
      view: { class: 'foam.core.reflow.SinkView',
              choice: 'foam.core.reflow.CountDAOAgent',
              disabledTypes: [ 'structure', 'format', 'chart' ] }
    },
    {
      class: 'Double',
      name: 'maxValue',
      label: 'Maximum',
      value: 100,
      help: 'The value at the right end of the dial: a target, say. A bigger result fills the whole dial.'
    },
    {
      // Has Java: a select sends this sink to the server and the client
      // draws the copy that comes back, so a field left out of the Java class
      // is lost on the way and the dial shows no bands.
      class: 'FObjectArray',
      of: 'foam.u2.chart.GaugeBand',
      name: 'bands',
      label: 'Bands',
      help: 'Coloured stretches of the dial, each ending at its Up To: red to 50, amber to 80, green to 100'
    },
    {
      class: 'Code',
      name: 'onClickScript',
      label: 'On Click Script',
      help: 'Function expression called when the dial is clicked. Signature: (value, x, y, pageX, pageY) => void'
    },
    {
      class: 'String',
      name: 'emptyValueMessage',
      label: 'Empty Message',
      help: 'Shown in place of the dial when the aggregate is not a number, such as the Min of no rows. Left empty, it says "No data available".'
    },
    {
      name: 'chart_',
      hidden: true,
      transient: true,
      expression: function(total, maxValue, bands, showLegend, legendPosition, showTooltips,
                          animate, animationDuration, onClickScript) {
        var self  = this;
        var value = total && typeof total.value === 'number' && isFinite(total.value) ? total.value : null;

        // The form's On Click Script is a function expression, called with
        // (value, x, y, pageX, pageY): the dial's value, the point inside
        // the chart and the point on the page.
        var click = null;
        if ( onClickScript ) {
          try {
            click = eval(onClickScript);
          } catch ( e ) {
            console.warn('Invalid onClickScript for DashboardGaugeSink:', e);
          }
        }

        return this.GaugeChart.create({
          // Named by the total's field, read from the total and not from
          // aggregation: the server's copy of this sink has no aggregation.
          // With no field to name it (a Count), the value is just "Value".
          datasets:          [ { label: this.labelOf_(total && total.arg1) || this.DEFAULT_SERIES, data: [ value ] } ],
          max:               maxValue,
          bands:             bands,
          showLegend:        showLegend,
          legendPosition:    legendPosition,
          showTooltips:      showTooltips,
          animate:           animate,
          animationDuration: animationDuration,
          onValueClick: typeof click !== 'function' ? null : function(evt) {
            try {
              var box = evt.target.ownerSVGElement.getBoundingClientRect();
              click(value, evt.clientX - box.left, evt.clientY - box.top, evt.pageX, evt.pageY);
            } catch ( e ) {
              console.warn('Error executing onClickScript:', e);
            }
          }
        });
      }
    }
  ],

  methods: [
    function addToE(e) {
      e.style({ width: '100%' });
      var v = this.total && this.total.value;
      this.addChartOrEmpty_(e, typeof v === 'number' && isFinite(v), this.emptyValueMessage);
    }
  ]
});
