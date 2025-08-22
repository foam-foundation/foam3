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
  name: 'ChartDisplayMixin',
  
  documentation: 'Mixin for common chart display options',
  
  requires: [
    'foam.core.reflow.dashboard.LegendPosition'
  ],
  
  properties: [
    {
      class: 'Boolean',
      name: 'responsive',
      label: 'Responsive',
      value: true
    },
    {
      class: 'Boolean',
      name: 'maintainAspectRatio',
      label: 'Maintain Aspect Ratio',
      value: true
    },
    {
      class: 'Int',
      name: 'height',
      label: 'Chart Height (px)',
      value: 300,
      view: {
        class: 'foam.u2.RangeView',
        minValue: 100,
        maxValue: 800,
        step: 10,
        onKey: true
      },
      visibility: function(responsive) {
        return !responsive ? foam.u2.DisplayMode.RW : foam.u2.DisplayMode.HIDDEN;
      }
    },
    {
      class: 'Int',
      name: 'width',
      label: 'Chart Width (px)',
      value: 400,
      view: {
        class: 'foam.u2.RangeView',
        minValue: 200,
        maxValue: 1200,
        step: 10,
        onKey: true
      },
      help: 'Width in pixels (200-1200)',
      visibility: function(responsive) {
        return !responsive ? foam.u2.DisplayMode.RW : foam.u2.DisplayMode.HIDDEN;
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
        .add('Height: ', this.HEIGHT, 'px Width: ', this.WIDTH, 'px')
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
        .add('Responsive: ', this.RESPONSIVE, ' Maintain Ratio: ', this.MAINTAIN_ASPECT_RATIO)
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
      properties: ['prop', 'sink', 'topN', 'includeOthers', 'sortOrder', 'othersLabel']
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
      properties: ['responsive', 'maintainAspectRatio', 'height', 'width', 'showLegend', 'legendPosition', 'showTooltips', 'showTooltipSum', 'animate', 'animationDuration']
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
    function createSink() {
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
        responsive: this.responsive,
        maintainAspectRatio: this.maintainAspectRatio,
        height: this.height,
        width: this.width,
        showLegend: this.showLegend,
        legendPosition: this.legendPosition,
        showTooltips: this.showTooltips,
        showTooltipSum: this.showTooltipSum,
        animate: this.animate,
        animationDuration: this.animationDuration
      });
      
      return sink;
    },
    
    function addSinkToE(e, s) {
      var self = this;
      // Add the sink once
      e.add(s);
      
      // Then update its properties reactively
      this.onDetach(this.dynamic(function(colors, horizontal, barThickness, xAxisLabel, yAxisLabel, showGridLines, 
                                  responsive, maintainAspectRatio, height, width, showLegend, legendPosition, 
                                  showTooltips, showTooltipSum, animate, animationDuration) { 
        s.colors = colors;
        s.horizontal = horizontal;
        s.barThickness = barThickness;
        s.xAxisLabel = xAxisLabel;
        s.yAxisLabel = yAxisLabel;
        s.showGridLines = showGridLines;
        s.responsive = responsive;
        s.maintainAspectRatio = maintainAspectRatio;
        s.height = height;
        s.width = width;
        s.showLegend = showLegend;
        s.legendPosition = legendPosition;
        s.showTooltips = showTooltips;
        s.showTooltipSum = showTooltipSum;
        s.animate = animate;
        s.animationDuration = animationDuration;
        
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
      clone.colors$ = this.colors$;
      clone.horizontal$ = this.horizontal$;
      clone.barThickness$ = this.barThickness$;
      clone.xAxisLabel$ = this.xAxisLabel$;
      clone.yAxisLabel$ = this.yAxisLabel$;
      clone.showGridLines$ = this.showGridLines$;
      clone.responsive$ = this.responsive$;
      clone.maintainAspectRatio$ = this.maintainAspectRatio$;
      clone.height$ = this.height$;
      clone.width$ = this.width$;
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
      properties: ['prop2', 'prop1', 'sink', 'timeUnit']
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
      properties: ['responsive', 'maintainAspectRatio', 'height', 'width', 'showLegend', 'legendPosition', 'showTooltips', 'showTooltipSum', 'animate', 'animationDuration']
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
    }
  ],

  methods: [
    function createSink() {
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
        responsive: this.responsive,
        maintainAspectRatio: this.maintainAspectRatio,
        height: this.height,
        width: this.width,
        showLegend: this.showLegend,
        legendPosition: this.legendPosition,
        showTooltips: this.showTooltips,
        showTooltipSum: this.showTooltipSum,
        animate: this.animate,
        animationDuration: this.animationDuration
      });
    },
    
    function addSinkToE(e, s) {
      var self = this;
      // Add the sink once
      e.add(s);
      
      // Then update its properties reactively
      this.onDetach(this.dynamic(function(colors, horizontal, xAxisLabel, yAxisLabel, showGridLines,
                                  responsive, maintainAspectRatio, height, width, showLegend, legendPosition, 
                                  showTooltips, showTooltipSum, animate, animationDuration) { 
        s.colors = colors;
        s.horizontal = horizontal;
        s.xAxisLabel = xAxisLabel;
        s.yAxisLabel = yAxisLabel;
        s.showGridLines = showGridLines;
        s.responsive = responsive;
        s.maintainAspectRatio = maintainAspectRatio;
        s.height = height;
        s.width = width;
        s.showLegend = showLegend;
        s.legendPosition = legendPosition;
        s.showTooltips = showTooltips;
        s.showTooltipSum = showTooltipSum;
        s.animate = animate;
        s.animationDuration = animationDuration;
        
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
      clone.colors$ = this.colors$;
      clone.horizontal$ = this.horizontal$;
      clone.xAxisLabel$ = this.xAxisLabel$;
      clone.yAxisLabel$ = this.yAxisLabel$;
      clone.showGridLines$ = this.showGridLines$;
      clone.responsive$ = this.responsive$;
      clone.maintainAspectRatio$ = this.maintainAspectRatio$;
      clone.height$ = this.height$;
      clone.width$ = this.width$;
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
      properties: ['showPercentages', 'cutoutPercentage', 'clockwise', 'rotation']
    },
    {
      name: 'display',
      title: 'Display Options',
      order: 3,
      collapsable: true,
      properties: ['responsive', 'maintainAspectRatio', 'height', 'width', 'showLegend', 'legendPosition', 'showTooltips', 'showTooltipSum', 'animate', 'animationDuration']
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
    }
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
        responsive: this.responsive,
        maintainAspectRatio: this.maintainAspectRatio,
        height: this.height,
        width: this.width,
        showLegend: this.showLegend,
        legendPosition: this.legendPosition,
        showTooltips: this.showTooltips,
        showTooltipSum: this.showTooltipSum,
        animate: this.animate,
        animationDuration: this.animationDuration
      });

      return sink;
    },
    function addSinkToE(e, s) {
      var self = this;
      // Add the sink once
      e.add(s);
      
      // Then update its properties reactively
      this.onDetach(this.dynamic(function(cutoutPercentage, rotation, colors, showPercentages, clockwise,
                                  responsive, maintainAspectRatio, height, width, showLegend, legendPosition, 
                                  showTooltips, showTooltipSum, animate, animationDuration) { 
        s.cutoutPercentage = cutoutPercentage;
        s.rotation = rotation;
        s.colors = colors;
        s.showPercentages = showPercentages;
        s.clockwise = clockwise;
        s.responsive = responsive;
        s.maintainAspectRatio = maintainAspectRatio;
        s.height = height;
        s.width = width;
        s.showLegend = showLegend;
        s.legendPosition = legendPosition;
        s.showTooltips = showTooltips;
        s.showTooltipSum = showTooltipSum;
        s.animate = animate;
        s.animationDuration = animationDuration;
        
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
      clone.cutoutPercentage$ = this.cutoutPercentage$;
      clone.rotation$ = this.rotation$;
      clone.colors$ = this.colors$;
      clone.showPercentages$ = this.showPercentages$;
      clone.clockwise$ = this.clockwise$;
      clone.responsive$ = this.responsive$;
      clone.maintainAspectRatio$ = this.maintainAspectRatio$;
      clone.height$ = this.height$;
      clone.width$ = this.width$;
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


// DashboardDonutChartDAOAgent removed - use DashboardPieChartDAOAgent with cutoutPercentage instead

foam.CLASS({
  package: 'foam.core.reflow.dashboard',
  name: 'DashboardLineChartDAOAgent',
  extends: 'foam.core.reflow.AbstractSinkDAOAgent',
  mixins: [
    'foam.core.reflow.dashboard.ColorMappingMixin',
    'foam.core.reflow.dashboard.ChartDisplayMixin'
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
      properties: ['fill', 'tension', 'stepped', 'showPoints', 'pointRadius', 'showGridLines']
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
      properties: ['responsive', 'maintainAspectRatio', 'height', 'width', 'showLegend', 'legendPosition', 'showTooltips', 'showTooltipSum', 'animate', 'animationDuration']
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
    function createSink() {
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
          responsive: this.responsive,
          maintainAspectRatio: this.maintainAspectRatio,
          height: this.height,
          width: this.width,
          showLegend: this.showLegend,
          legendPosition: this.legendPosition,
          showTooltips: this.showTooltips,
          showTooltipSum: this.showTooltipSum,
          animate: this.animate,
          animationDuration: this.animationDuration
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
          responsive: this.responsive,
          maintainAspectRatio: this.maintainAspectRatio,
          height: this.height,
          width: this.width,
          showLegend: this.showLegend,
          legendPosition: this.legendPosition,
          showTooltips: this.showTooltips,
          showTooltipSum: this.showTooltipSum,
          animate: this.animate,
          animationDuration: this.animationDuration
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
                                  responsive, maintainAspectRatio, height, width, showLegend, legendPosition, 
                                  showTooltips, showTooltipSum, animate, animationDuration) { 
        s.colors = colors;
        s.xAxisLabel = xAxisLabel;
        s.yAxisLabel = yAxisLabel;
        s.fill = fill;
        s.tension = tension;
        s.stepped = stepped;
        s.showPoints = showPoints;
        s.pointRadius = pointRadius;
        s.showGridLines = showGridLines;
        s.responsive = responsive;
        s.maintainAspectRatio = maintainAspectRatio;
        s.height = height;
        s.width = width;
        s.showLegend = showLegend;
        s.legendPosition = legendPosition;
        s.showTooltips = showTooltips;
        s.showTooltipSum = showTooltipSum;
        s.animate = animate;
        s.animationDuration = animationDuration;
        
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
      clone.colors$ = this.colors$;
      clone.xAxisLabel$ = this.xAxisLabel$;
      clone.yAxisLabel$ = this.yAxisLabel$;
      clone.fill$ = this.fill$;
      clone.tension$ = this.tension$;
      clone.stepped$ = this.stepped$;
      clone.showPoints$ = this.showPoints$;
      clone.pointRadius$ = this.pointRadius$;
      clone.showGridLines$ = this.showGridLines$;
      clone.responsive$ = this.responsive$;
      clone.maintainAspectRatio$ = this.maintainAspectRatio$;
      clone.height$ = this.height$;
      clone.width$ = this.width$;
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

  requires: [
    'foam.core.reflow.dashboard.DashboardMetricSink',
    'foam.core.reflow.dashboard.MetricOperation',
    'foam.core.reflow.ReactiveSectionedDetailView'
  ],

  sections: [
    {
      name: 'metricConfig',
      title: 'Metric Configuration',
      order: 1,
      collapsable: true,
      properties: ['operation', 'prop', 'label', 'prefix', 'postfix', 'decimalPlaces']
    },
    {
      name: 'display',
      title: 'Display Options',
      order: 2,
      collapsable: true,
      // iconColor is hidden for now until implementation is fixed
      properties: ['icon', 'iconSize', 'alignment', 'showCount', 'countSuffix', 'valueColor']
    },
    {
      name: 'labelFont',
      title: 'Label Font Options',
      order: 3,
      collapsable: true,
      properties: ['labelFontSize', 'labelFontWeight', 'labelColor']
    },
    {
      name: 'countFont',
      title: 'Count Font Options',
      order: 4,
      collapsable: true,
      properties: ['countFontSize', 'countFontWeight', 'countColor']
    }
  ],

  properties: [
    {
      class: 'Enum',
      of: 'foam.core.reflow.dashboard.MetricOperation',
      name: 'operation',
      label: 'Operation',
      value: 'COUNT'
    },
    {
      name: 'prop',
      label: 'Property',
      view: function(_, X) {
        return { 
          class: 'foam.core.reflow.PropertyChoiceView', 
          forCls: X.data.dao ? X.data.dao.of : X.data.of
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
      class: 'String',
      name: 'label',
      label: 'Display Label',
      value: 'Metric'
    },
    {
      class: 'String',
      name: 'icon',
      label: 'Icon',
      help: 'Theme icon name to display above the metric value (e.g., "chart", "users", "dollar")'
    },
    {
      class: 'String',
      name: 'iconColor',
      label: 'Icon Color',
      help: 'Color for the icon (CSS color or token)',
      view: 'foam.u2.view.TokenColorEditView',
      value: '$primary500',
      view: 'foam.u2.view.ColorEditView',
      // TODO: Hidden for now as CSS override for SVG fill is not working properly
      // Need to fix the implementation to properly apply color to icons
      hidden: true
    },
    // Label font controls
    {
      class: 'String',
      name: 'labelFontSize',
      label: 'Label Font Size',
      help: 'Font size for the display label (e.g., "1rem", "14px")',
      value: '0.875rem',
      section: 'labelFont'
    },
    {
      class: 'String',
      name: 'labelFontWeight',
      label: 'Label Font Weight',
      help: 'Font weight for the display label (e.g., "normal", "bold", "500")',
      value: 'medium',
      section: 'labelFont'
    },
    {
      class: 'String',
      name: 'labelColor',
      label: 'Label Color',
      help: 'Color for the display label (CSS color or token)',
      section: 'labelFont',
      value: '$textSecondary',
      view: 'foam.u2.view.ColorEditView'
    },
    // Count font controls
    {
      class: 'String',
      name: 'countFontSize',
      label: 'Count Font Size',
      help: 'Font size for the count text (e.g., "0.75rem", "12px")',
      value: '0.75rem',
      section: 'countFont'
    },
    {
      class: 'String',
      name: 'countFontWeight',
      label: 'Count Font Weight',
      help: 'Font weight for the count text (e.g., "normal", "bold")',
      value: 'normal',
      section: 'countFont'
    },
    {
      class: 'String',
      name: 'countColor',
      label: 'Count Color',
      help: 'Color for the count text (CSS color or token)',
      section: 'countFont',
      value: '$textSecondary',
      view: 'foam.u2.view.ColorEditView'
    },
    {
      class: 'Enum',
      name: 'alignment',
      label: 'Alignment',
      of: 'foam.core.reflow.dashboard.MetricAlignment',
      value: 'CENTER'
    },
    {
      class: 'Boolean',
      name: 'showCount',
      label: 'Show Record Count',
      value: true,
      help: 'Display how many records were used in the calculation'
    },
    {
      class: 'String',
      name: 'countSuffix',
      label: 'Count Suffix',
      value: 'records',
      help: 'Text to display after the count number',
      visibility: function(showCount) {
        return showCount ? foam.u2.DisplayMode.RW : foam.u2.DisplayMode.HIDDEN;
      }
    },
    {
      class: 'String',
      name: 'valueColor',
      label: 'Value Color',
      help: 'Color for the metric value (CSS color or token)',
      value: '$primary500',
      view: 'foam.u2.view.ColorEditView'
    },
    {
      class: 'String',
      name: 'prefix',
      label: 'Prefix',
      help: 'Text to display before value (e.g., $, €, #)'
    },
    {
      class: 'String',
      name: 'postfix',
      label: 'Postfix',
      help: 'Text to display after value (e.g., %, ms, USD)'
    },
    {
      class: 'String',
      name: 'iconSize',
      label: 'Icon Size',
      help: 'Size of the icon (CSS size value like "2rem", "24px")',
      value: '2rem'
    },
    {
      class: 'Int',
      name: 'decimalPlaces',
      label: 'Decimal Places',
      value: 0,
      help: 'Number of decimal places to show'
    }
  ],

  methods: [
    function createSink() {
      return this.DashboardMetricSink.create({
        operation: this.operation,
        prop: this.prop,
        label: this.label,
        icon: this.icon,
        iconColor: this.iconColor,
        alignment: this.alignment,
        showCount: this.showCount,
        countSuffix: this.countSuffix,
        valueColor: this.valueColor,
        prefix: this.prefix,
        postfix: this.postfix,
        iconSize: this.iconSize,
        decimalPlaces: this.decimalPlaces
      });
    },
    

    function addSinkToE(e, s) {
      var self = this;
      // Add the sink once
      e.add(s);
      
      // Then update its properties reactively
      this.onDetach(this.dynamic(function(label, icon, iconColor, alignment, showCount, countSuffix, valueColor, prefix, postfix, iconSize, decimalPlaces) { 
        s.label = label;
        s.icon = icon;
        s.iconColor = iconColor;
        s.alignment = alignment;
        s.showCount = showCount;
        s.countSuffix = countSuffix;
        s.valueColor = valueColor;
        s.prefix = prefix;
        s.postfix = postfix;
        s.iconSize = iconSize;
        s.decimalPlaces = decimalPlaces;
        
        // Force metric to update/redraw
        if ( s.updateMetric ) s.updateMetric();
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
      clone.operation$ = this.operation$;
      clone.prop$ = this.prop$;
      clone.label$ = this.label$;
      clone.icon$ = this.icon$;
      clone.iconColor$ = this.iconColor$;
      clone.alignment$ = this.alignment$;
      clone.showCount$ = this.showCount$;
      clone.countSuffix$ = this.countSuffix$;
      clone.valueColor$ = this.valueColor$;
      clone.prefix$ = this.prefix$;
      clone.postfix$ = this.postfix$;
      clone.iconSize$ = this.iconSize$;
      clone.decimalPlaces$ = this.decimalPlaces$;
      clone.labelFontSize$ = this.labelFontSize$;
      clone.labelFontWeight$ = this.labelFontWeight$;
      clone.labelColor$ = this.labelColor$;
      clone.countFontSize$ = this.countFontSize$;
      clone.countFontWeight$ = this.countFontWeight$;
      clone.countColor$ = this.countColor$;
      return clone;
    }
  ]
});
