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
      // Detect time granularity from the property expression
      var granularity = null;

      // Check if prop is a date transformation expression
      if ( prop && prop.delegate && foam.lang.Date.isInstance(prop.delegate) ) {
        if ( foam.mlang.expr.DateToWeekExpr.isInstance(prop) ) {
          granularity = 'week';
        } else if ( foam.mlang.expr.DateToQuarterExpr.isInstance(prop) ) {
          granularity = 'quarter';
        } else if ( foam.mlang.expr.DateToDayOfYearExpr.isInstance(prop) ) {
          granularity = 'day';
        } else if ( foam.mlang.expr.DateToYYYYMMExpr.isInstance(prop) ) {
          granularity = 'month';
        } else if ( foam.mlang.expr.DateToYYYYExpr.isInstance(prop) ) {
          granularity = 'year';
        } else if ( foam.mlang.expr.DateToYYYYMMDDExpr.isInstance(prop) ) {
          granularity = 'date';
        }
      }

      if ( ! granularity ) return existingKeys; // Not a supported time expression

      // Calculate range based on periods (e.g., last 12 months from today)
      var now = new Date();
      var minDate = new Date(now);
      var maxDate = new Date(now);

      // Calculate start date based on granularity and periods
      // Subtract (periods - 1) to get the correct range including current period
      // Example: periods=12 for months means current month + 11 previous = 12 total
      if ( granularity === 'week' ) {
        minDate.setDate(minDate.getDate() - ((periods - 1) * 7));
      } else if ( granularity === 'quarter' ) {
        minDate.setMonth(minDate.getMonth() - ((periods - 1) * 3));
      } else if ( granularity === 'month' ) {
        minDate.setMonth(minDate.getMonth() - (periods - 1));
      } else if ( granularity === 'year' ) {
        minDate.setFullYear(minDate.getFullYear() - (periods - 1));
      } else if ( granularity === 'date' || granularity === 'day' ) {
        minDate.setDate(minDate.getDate() - (periods - 1));
      }

      // Generate keys using the property expression
      var minKey = prop.f({ [prop.delegate.name]: minDate });
      var maxKey = prop.f({ [prop.delegate.name]: maxDate });

      // Generate all keys between min and max based on granularity
      var allKeys = [];

      if ( granularity === 'week' ) {
        // Format: YYYY-W##
        var match = minKey.match(/^(\d{4})-W(\d{2})$/);
        var minYear = parseInt(match[1]);
        var minWeek = parseInt(match[2]);
        match = maxKey.match(/^(\d{4})-W(\d{2})$/);
        var maxYear = parseInt(match[1]);
        var maxWeek = parseInt(match[2]);

        for ( var y = minYear; y <= maxYear; y++ ) {
          var startWeek = (y === minYear) ? minWeek : 1;
          var endWeek = (y === maxYear) ? maxWeek : 52;
          for ( var w = startWeek; w <= endWeek; w++ ) {
            allKeys.push(y + '-W' + String(w).padStart(2, '0'));
          }
        }
      } else if ( granularity === 'quarter' ) {
        // Format: YYYY-Q#
        var match = minKey.match(/^(\d{4})-Q(\d)$/);
        var minYear = parseInt(match[1]);
        var minQ = parseInt(match[2]);
        match = maxKey.match(/^(\d{4})-Q(\d)$/);
        var maxYear = parseInt(match[1]);
        var maxQ = parseInt(match[2]);

        for ( var y = minYear; y <= maxYear; y++ ) {
          var startQ = (y === minYear) ? minQ : 1;
          var endQ = (y === maxYear) ? maxQ : 4;
          for ( var q = startQ; q <= endQ; q++ ) {
            allKeys.push(y + '-Q' + q);
          }
        }
      } else if ( granularity === 'month' ) {
        // Format: YYYY/MM
        var parts = minKey.split('/');
        var minYear = parseInt(parts[0]);
        var minMonth = parseInt(parts[1]);
        parts = maxKey.split('/');
        var maxYear = parseInt(parts[0]);
        var maxMonth = parseInt(parts[1]);

        for ( var y = minYear; y <= maxYear; y++ ) {
          var startM = (y === minYear) ? minMonth : 1;
          var endM = (y === maxYear) ? maxMonth : 12;
          for ( var m = startM; m <= endM; m++ ) {
            allKeys.push(y + '/' + String(m).padStart(2, '0'));
          }
        }
      } else if ( granularity === 'year' ) {
        // Format: YYYY
        var minYear = parseInt(minKey);
        var maxYear = parseInt(maxKey);
        for ( var y = minYear; y <= maxYear; y++ ) {
          allKeys.push(String(y));
        }
      } else if ( granularity === 'date' || granularity === 'day' ) {
        // Format: YYYY/MM/DD or YYYY-###
        if ( granularity === 'day' ) {
          // Day of year: YYYY-###
          var match = minKey.match(/^(\d{4})-(\d{3})$/);
          var minYear = parseInt(match[1]);
          var minDay = parseInt(match[2]);
          match = maxKey.match(/^(\d{4})-(\d{3})$/);
          var maxYear = parseInt(match[1]);
          var maxDay = parseInt(match[2]);

          for ( var y = minYear; y <= maxYear; y++ ) {
            var daysInYear = (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 366 : 365;
            var startD = (y === minYear) ? minDay : 1;
            var endD = (y === maxYear) ? maxDay : daysInYear;
            for ( var d = startD; d <= endD; d++ ) {
              allKeys.push(y + '-' + String(d).padStart(3, '0'));
            }
          }
        } else {
          // Full date: YYYY/MM/DD
          var parts = minKey.split('/');
          var minDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          parts = maxKey.split('/');
          var maxDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));

          var currentDate = new Date(minDate);
          while ( currentDate <= maxDate ) {
            var y = currentDate.getFullYear();
            var m = String(currentDate.getMonth() + 1).padStart(2, '0');
            var d = String(currentDate.getDate()).padStart(2, '0');
            allKeys.push(y + '/' + m + '/' + d);
            currentDate.setDate(currentDate.getDate() + 1);
          }
        }
      }

      return allKeys;
    }
  ]
});

foam.CLASS({
  package: 'foam.core.reflow.dashboard',
  name: 'DashboardBarSink',
  extends: 'foam.mlang.sink.TopNGroupBy',
  mixins: [
    'foam.core.reflow.dashboard.TimeSeriesGapFillingSinkMixin'
  ],
  
  requires: [
    'org.chartjs.Bar2'
  ],
  
  properties: [
    // TopNGroupBy properties (inherited but exposed here for clarity)
    // IMPORTANT: groupLimit is inherited from GroupBy but should NOT be used with TopNGroupBy sinks
    // groupLimit cuts off data collection early, while topN properly aggregates all data first
    { name: 'sortOrder', value: 'DESC', help: 'Sort order for groups' },
    { name: 'includeOthers', value: false, help: 'Include "Others" category for remaining groups' },
    { name: 'othersLabel', value: 'Others', help: 'Label for the "Others" category' },
    // Chart-specific properties
    {
      class: 'StringArray',
      name: 'colors',
    },
    {
      class: 'Enum',
      of: 'foam.core.reflow.dashboard.TimeUnit',
      name: 'timeUnit'
    },
    { class: 'Boolean', name: 'horizontal', value: false },
    { class: 'Int', name: 'barThickness' },
    { class: 'String', name: 'datasetLabel', value: '', help: 'Label for the dataset (shown in legend if enabled)' },
    { class: 'String', name: 'xAxisLabel' },
    { class: 'String', name: 'yAxisLabel' },
    { class: 'Boolean', name: 'showGridLines', value: true },
    // periodCount inherited from TimeSeriesGapFillingSinkMixin
    // Display properties
    { class: 'Boolean', name: 'responsive', value: true },
    { class: 'Boolean', name: 'maintainAspectRatio', value: false },
    { class: 'Int', name: 'height', value: 300 },
    {
      class: 'Int',
      name: 'width',
      value: 400
    },
    { class: 'Boolean', name: 'showLegend', value: false },  // Bar charts typically don't need legend for single dataset
    { class: 'String', name: 'legendPosition', value: 'TOP' },
    { class: 'Boolean', name: 'showTooltips', value: true },
    { class: 'Boolean', name: 'showTooltipSum', value: false, help: 'Show sum total in tooltip footer' },
    { class: 'Boolean', name: 'animate', value: true },
    { class: 'Int', name: 'animationDuration', value: 1000 },
    { class: 'Enum', of: 'foam.core.reflow.dashboard.MetricAlignment', name: 'alignment', value: 'CENTER' },
    {
      name: 'chart_',
      transient: true,
      expression: function(groups, colors, timeUnit, horizontal, barThickness, datasetLabel, xAxisLabel, yAxisLabel,
                          showGridLines, responsive, maintainAspectRatio, showLegend,
                          legendPosition, showTooltips, showTooltipSum, animate, animationDuration, periodCount) {

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

        var index = 0;
        for ( var i = 0; i < sortedKeys.length; i++ ) {
          var key = sortedKeys[i];
          // Use chartJsFormatter if available, otherwise use the key as-is
          var label = this.arg1 && this.arg1.chartJsFormatter ?
                      this.arg1.chartJsFormatter(key) : key;
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
        
        
        var chartData = {
          labels: labels,
          datasets: [{
            label: datasetLabel || 'Values',  // Use configurable label or default to 'Values'
            data: data,
            backgroundColor: backgroundColors.length > 0 ? backgroundColors : undefined
            // Don't set barThickness if it's 0 or undefined, let Chart.js use defaults
          }]
        };
        
        var chartJSOptions = {
          responsive: responsive,
          maintainAspectRatio: maintainAspectRatio,
          indexAxis: horizontal ? 'y' : 'x',
          plugins: {
            legend: {
              display: showLegend,
              position: legendPosition ? legendPosition.toString().toLowerCase() : 'top',
              labels: {
                sort: function(a, b, data) {
                  // Always put "Others" at the end
                  // Chart.js legend items use 'text' property for the label
                  var aLabel = (a.text || '').toLowerCase();
                  var bLabel = (b.text || '').toLowerCase();
                  var aIsOthers = aLabel.includes('others');
                  var bIsOthers = bLabel.includes('others');
                  
                  if (aIsOthers && !bIsOthers) return 1;  // a goes after b
                  if (!aIsOthers && bIsOthers) return -1; // a goes before b
                  return 0; // maintain original order for non-Others items
                }
              }
            },
            tooltip: {
              enabled: showTooltips,
              callbacks: showTooltipSum ? {
                footer: function(tooltipItems) {
                  var sum = 0;
                  tooltipItems.forEach(function(tooltipItem) {
                    sum += tooltipItem.parsed.y || tooltipItem.parsed.x || 0;
                  });
                  return 'Sum: ' + sum.toLocaleString();
                }
              } : undefined
            }
          },
          animation: animate ? {
            duration: animationDuration
          } : false,
          scales: {
            x: {
              title: {
                display: !!xAxisLabel,
                text: xAxisLabel
              },
              grid: {
                display: showGridLines
              }
            },
            y: {
              title: {
                display: !!yAxisLabel,
                text: yAxisLabel
              },
              grid: {
                display: showGridLines
              }
            }
          }
        };
        
        // Configure time scale if dealing with RAW date/time properties (not transformed)
        // Only use Chart.js time scale for raw Date/DateTime properties, not for date transformation expressions
        // Date transformation expressions already format the dates as strings (e.g., "2024/10")
        var isRawDateProperty = this.arg1 && (foam.lang.Date.isInstance(this.arg1) || foam.lang.DateTime.isInstance(this.arg1));

        if ( isRawDateProperty ) {
          chartJSOptions.scales.x.type = 'time';
          chartJSOptions.scales.x.time = {
            unit: timeUnit.chartJsUnit || 'day',
            displayFormats: {}
          };

          // Set display format for the selected time unit
          if ( timeUnit.displayFormat ) {
            chartJSOptions.scales.x.time.displayFormats[timeUnit.chartJsUnit || 'day'] = timeUnit.displayFormat;
          }

          // Configure tooltip format
          if ( timeUnit.tooltipFormat ) {
            chartJSOptions.scales.x.time.tooltipFormat = timeUnit.tooltipFormat;
          }
        }
        
        var barChart = this.Bar2.create({
          data: chartData,
          chartJSOptions: chartJSOptions,
          width: this.width,
          height: this.height
        });
        
        
        return barChart;
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
          .style({ 'min-height': this.height$, height: this.height$ })
          .add(this.chart_$)
        .end();
    }
  ]
});

foam.CLASS({
  package: 'foam.core.reflow.dashboard',
  name: 'DashboardPieSink',
  extends: 'foam.mlang.sink.TopNGroupBy',
  
  requires: [
    'org.chartjs.Pie2'
  ],
  
  properties: [
    // TopNGroupBy properties (inherited but exposed here for clarity)
    // IMPORTANT: groupLimit is inherited from GroupBy but should NOT be used with TopNGroupBy sinks
    // groupLimit cuts off data collection early, while topN properly aggregates all data first
    // The init() method forces groupLimit to -1 to prevent interference
    { name: 'sortOrder', value: 'DESC', help: 'Sort order for slices' },
    { name: 'includeOthers', value: true, help: 'Include "Others" slice for remaining groups' },
    { name: 'othersLabel', value: 'Others', help: 'Label for the "Others" slice' },
    // Pie-specific properties
    {
      class: 'StringArray',
      name: 'colors',
    },
    { class: 'Boolean', name: 'showPercentages', value: false },
    { class: 'Int', name: 'cutoutPercentage', value: 0 },
    { class: 'Boolean', name: 'clockwise', value: true },
    { class: 'Int', name: 'rotation', value: -90 },
    // Display properties
    { class: 'Boolean', name: 'responsive', value: true },
    { class: 'Boolean', name: 'maintainAspectRatio', value: false },
    { class: 'Int', name: 'height', value: 300 },
    { 
      class: 'Int',
      name: 'width', 
      factory: function() { 
        // Default to 0 which means auto-width (100% of container)
        // But when rendered in a canvas, we need a real width
        return 400; 
      }
    },    
    { class: 'Boolean', name: 'showLegend', value: true },
    { class: 'String', name: 'legendPosition', value: 'TOP' },
    { class: 'Boolean', name: 'showTooltips', value: true },
    { class: 'Boolean', name: 'showTooltipSum', value: false, help: 'Show sum total in tooltip footer' },
    { class: 'Boolean', name: 'animate', value: true },
    { class: 'Int', name: 'animationDuration', value: 1000 },
    { class: 'Enum', of: 'foam.core.reflow.dashboard.MetricAlignment', name: 'alignment', value: 'CENTER' },
    {
      name: 'chart_',
      transient: true,
      expression: function(groups,groupKeys, colors, showPercentages, cutoutPercentage, clockwise, rotation,
                          responsive, maintainAspectRatio, showLegend, 
                          legendPosition, showTooltips, showTooltipSum, animate, animationDuration) {
        var labels = [];
        var data = [];
        var backgroundColors = [];
        
        // If topN > 0, use groupKeys to preserve backend order (JavaScript reorders numeric keys)
        // Otherwise, use sortedKeys() for proper sorting
        var sortedKeys = this.topN > 0 ? (this.groupKeys || Object.keys(groups)) : 
                        (this.sortedKeys ? this.sortedKeys() : Object.keys(groups));
        
        var index = 0;
        for ( var i = 0; i < sortedKeys.length; i++ ) {
          var key = sortedKeys[i];
          labels.push(key.toString());
          data.push(groups[key].value);
          
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
        
        
        var chartData = {
          labels: labels,
          datasets: [{
            data: data,
            backgroundColor: backgroundColors.length > 0 ? backgroundColors : undefined
          }]
        };

        var options = {
          responsive: responsive,
          maintainAspectRatio: maintainAspectRatio,
          cutout: cutoutPercentage + '%',
          rotation: rotation,
          circumference: clockwise ? 360 : -360,
          plugins: {
            legend: {
              display: showLegend,
              position: legendPosition ? legendPosition.toString().toLowerCase() : 'top',

            },
            tooltip: {
              enabled: showTooltips,
              callbacks: (function() {
                var callbacks = {};
                
                // Add percentage display to individual tooltip labels
                if ( showPercentages ) {
                  callbacks.label = function(context) {
                    var label = context.label || '';
                    var value = context.parsed || 0;
                    var dataset = context.chart.data.datasets[0];
                    var total = dataset.data.reduce(function(sum, val) { 
                      return sum + val; 
                    }, 0);
                    var percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
                    
                    if ( label ) {
                      label += ': ';
                    }
                    label += value.toLocaleString() + ' (' + percentage + '%)';
                    return label;
                  };
                }
                
                // Add sum footer if requested
                if ( showTooltipSum ) {
                  callbacks.footer = function(tooltipItems) {
                    var sum = 0;
                    tooltipItems.forEach(function(tooltipItem) {
                      sum += tooltipItem.parsed || 0;
                    });
                    return 'Sum: ' + sum.toLocaleString();
                  };
                }
                
                return Object.keys(callbacks).length > 0 ? callbacks : undefined;
              })()
            },
            datalabels: {
              display: true,
              color: 'white',
              font: {
                weight: 'bold'
              }
            }
          },
          animation: animate ? {
            duration: animationDuration,
            animateRotate: true,
            animateScale: true
          } : false
        };
        
        if ( showPercentages ) {
          options.plugins.legend.labels = {
            generateLabels: function(chart) {
              var dataset = chart.data.datasets[0];
              var total = dataset.data.reduce(function(sum, val) { return sum + val; }, 0);
              
              return chart.data.labels.map(function(label, i) {
                var percentage = total > 0 ? ((dataset.data[i] / total) * 100).toFixed(1) : '0.0';
                var style = chart.getDatasetMeta(0).controller ? 
                           chart.getDatasetMeta(0).controller.getStyle(i) : 
                           { backgroundColor: dataset.backgroundColor[i] };
                
                return {
                  text: percentage + '% ' + label,
                  fillStyle: style.backgroundColor,
                  fontColor: undefined,
                  index: i
                };
              });
            }
          };
        }
        
        return this.Pie2.create({
          data: chartData,
          chartJSOptions: options,
          width: this.width,
          height: this.height
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
          .style({ 'min-height': this.height$, height: this.height$ })
          .add(this.chart_$)
        .end();
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow.dashboard',
  name: 'DashboardStackedBarSink',
  extends: 'foam.core.reflow.GridBy',

  mixins: [
    'foam.core.reflow.dashboard.TimeSeriesGapFillingSinkMixin'
  ],

  requires: [
    'org.chartjs.StackedBar2'
  ],
  
  properties: [
    // Stacked bar-specific properties
    {
      class: 'StringArray',
      name: 'colors',
    },
    { 
      class: 'Enum',
      of: 'foam.core.reflow.dashboard.TimeUnit', 
      name: 'timeUnit' 
    },
    { class: 'Boolean', name: 'horizontal', value: false },
    { class: 'String', name: 'xAxisLabel' },
    { class: 'String', name: 'yAxisLabel' },
    { class: 'Boolean', name: 'showGridLines', value: true },
    // Display properties
    { class: 'Boolean', name: 'responsive', value: true },
    { class: 'Boolean', name: 'maintainAspectRatio', value: false },
    { class: 'Int', name: 'height', value: 300 },
    { class: 'Int', name: 'width', value: 400 },
    { class: 'Boolean', name: 'showLegend', value: true },
    { class: 'String', name: 'legendPosition', value: 'TOP' },
    { class: 'Boolean', name: 'showTooltips', value: true },
    { class: 'Boolean', name: 'showTooltipSum', value: false, help: 'Show sum total in tooltip footer' },
    { class: 'Boolean', name: 'animate', value: true },
    { class: 'Int', name: 'animationDuration', value: 1000 },
    { class: 'Enum', of: 'foam.core.reflow.dashboard.MetricAlignment', name: 'alignment', value: 'CENTER' },
    {
      name: 'chart_',
      transient: true,
      expression: function(cols, rows, colors, timeUnit, horizontal, xAxisLabel, yAxisLabel,
                          showGridLines, responsive, maintainAspectRatio,
                          showLegend, legendPosition, showTooltips, showTooltipSum, animate, animationDuration,
                          periodCount) {
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
        for ( var i = 0; i < sortedColKeys.length; i++ ) {
          var col = sortedColKeys[i];
          // Use chartJsFormatter if available on xFunc, otherwise use the key as-is
          var label = this.xFunc && this.xFunc.chartJsFormatter ? 
                      this.xFunc.chartJsFormatter(col) : col;
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
        
        
        var chartJSOptions = {
          responsive: responsive,
          maintainAspectRatio: maintainAspectRatio,
          indexAxis: horizontal ? 'y' : 'x',
          plugins: {
            legend: {
              display: showLegend,
              position: legendPosition ? legendPosition.toString().toLowerCase() : 'top'
            },
            tooltip: {
              enabled: showTooltips,
              mode: 'index',
              intersect: false,
              callbacks: showTooltipSum ? {
                footer: function(tooltipItems) {
                  var sum = 0;
                  tooltipItems.forEach(function(tooltipItem) {
                    sum += tooltipItem.parsed.y || 0;
                  });
                  return 'Sum: ' + sum.toLocaleString();
                }
              } : undefined
            },
            datalabels: {
              display: true,
              color: 'white',
              font: {
                weight: 'bold'
              }
            }
          },
          animation: animate ? {
            duration: animationDuration
          } : false,
          scales: {
            x: {
              stacked: true,
              title: {
                display: !!xAxisLabel,
                text: xAxisLabel
              },
              grid: {
                display: showGridLines
              }
            },
            y: {
              stacked: true,
              title: {
                display: !!yAxisLabel,
                text: yAxisLabel
              },
              grid: {
                display: showGridLines
              }
            }
          }
        };
        
        // Configure time scale if dealing with date/time properties
        // Check if xFunc is a date/time property
        var isTimeScale = this.xFunc && (foam.lang.Date.isInstance(this.xFunc) || foam.lang.DateTime.isInstance(this.xFunc));
        
        if ( isTimeScale && timeUnit ) {
          chartJSOptions.scales.x.type = 'time';
          chartJSOptions.scales.x.time = {
            unit: timeUnit.chartJsUnit || 'day',
            displayFormats: {}
          };
          
          // Set display format for the selected time unit
          if ( timeUnit.displayFormat ) {
            chartJSOptions.scales.x.time.displayFormats[timeUnit.chartJsUnit || 'day'] = timeUnit.displayFormat;
          }
          
          // Configure tooltip format
          if ( timeUnit.tooltipFormat ) {
            chartJSOptions.scales.x.time.tooltipFormat = timeUnit.tooltipFormat;
          }
        }
        
        return this.StackedBar2.create({
          data: {
            labels: labels,
            datasets: datasets
          },
          chartJSOptions: chartJSOptions,
          width: this.width,
          height: this.height
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
          .style({ 'min-height': this.height$, height: this.height$ })
          .add(this.chart_$)
        .end();
    }
  ]
});

foam.CLASS({
  package: 'foam.core.reflow.dashboard',
  name: 'LineChartMixin',
  
  requires: [
    'org.chartjs.Line2'
  ],
  
  properties: [
    // Chart rendering properties
    { 
      class: 'Enum',
      of: 'foam.core.reflow.dashboard.TimeUnit', 
      name: 'timeUnit' 
    },
    { class: 'StringArray', name: 'colors' },
    { class: 'StringArray', name: 'borderColors', help: 'Border colors for line elements. If not specified, colors will be used.' },
    { class: 'String', name: 'xAxisLabel' },
    { class: 'String', name: 'yAxisLabel' },
    { class: 'Boolean', name: 'fill', value: false },
    { class: 'Double', name: 'tension', value: 0.1 },
    { class: 'Boolean', name: 'stepped', value: false },
    { class: 'Boolean', name: 'showPoints', value: true },
    { class: 'Int', name: 'pointRadius', value: 3 },
    { class: 'Boolean', name: 'showGridLines', value: true },
    // Display properties
    { class: 'Boolean', name: 'responsive', value: true },
    { class: 'Boolean', name: 'maintainAspectRatio', value: false },
    { class: 'Int', name: 'height', value: 300 },
    { class: 'Int', name: 'width', value: 400 },
    { class: 'Boolean', name: 'showLegend', value: true },
    { class: 'String', name: 'legendPosition', value: 'TOP' },
    { class: 'Boolean', name: 'showTooltips', value: true },
    { class: 'Boolean', name: 'showTooltipSum', value: false, help: 'Show sum total in tooltip footer (for multiple lines)' },
    { class: 'Boolean', name: 'animate', value: true },
    { class: 'Int', name: 'animationDuration', value: 1000 },
    { class: 'Enum', of: 'foam.core.reflow.dashboard.MetricAlignment', name: 'alignment', value: 'CENTER' }
  ],
  
  methods: [
    function createChartOptions(datasets, isTimeScale, xAxisLabel, yAxisLabel, showGridLines, 
                               responsive, maintainAspectRatio, showLegend, legendPosition,
                               showTooltips, showTooltipSum, animate, animationDuration, timeUnit,
                               xPropForLabels, yPropForLabels) {
      var chartJSOptions = {
        responsive: responsive,
        maintainAspectRatio: maintainAspectRatio,
        plugins: {
          legend: {
            display: showLegend && (datasets.length > 1 || showLegend),
            position: (legendPosition || 'TOP').toString().toLowerCase()
          },
          tooltip: {
            enabled: showTooltips,
            mode: datasets.length > 1 ? 'index' : 'nearest',
            intersect: false,
            callbacks: showTooltipSum && datasets.length > 1 ? {
              footer: function(tooltipItems) {
                var sum = 0;
                tooltipItems.forEach(function(tooltipItem) {
                  sum += tooltipItem.parsed.y || 0;
                });
                return 'Sum: ' + sum.toLocaleString();
              }
            } : undefined
          }
        },
        animation: animate ? {
          duration: animationDuration
        } : false,
        scales: {
          x: {
            title: { 
              display: !!xAxisLabel || !!(xPropForLabels && xPropForLabels.label),
              text: xAxisLabel || (xPropForLabels ? xPropForLabels.label : '')
            },
            grid: {
              display: showGridLines
            }
          },
          y: {
            title: { 
              display: !!yAxisLabel || !!(yPropForLabels && yPropForLabels.label),
              text: yAxisLabel || (yPropForLabels ? yPropForLabels.label : '')
            },
            grid: {
              display: showGridLines
            }
          }
        }
      };
      
      // Configure time scale if dealing with date/time properties
      if ( isTimeScale && timeUnit ) {
        chartJSOptions.scales.x.type = 'time';
        chartJSOptions.scales.x.time = {
          unit: timeUnit.chartJsUnit || 'day',
          displayFormats: {}
        };
        
        if ( timeUnit.displayFormat ) {
          chartJSOptions.scales.x.time.displayFormats[timeUnit.chartJsUnit || 'day'] = timeUnit.displayFormat;
        }
      }
      
      return this.Line2.create({
        data: { datasets: datasets },
        options: chartJSOptions,
        width: this.width,
        height: this.height
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
          .style({ 'min-height': this.height$, height: this.height$ })
          .add(this.chart_$)
        .end();
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
  
  properties: [
    // Map GroupBy properties directly
    { 
      name: 'arg1',
      label: 'X-Axis Property',
      help: 'Property to group by (x-axis values)' 
    },
    { 
      name: 'arg2',
      label: 'Aggregation Sink', 
      help: 'Sink to aggregate y-values for each x-value' 
    },
     {
    name: 'chart_',
    transient: true,
    expression: function(groups, arg1, arg2, timeUnit, colors, borderColors, xAxisLabel, yAxisLabel,
                        fill, tension, stepped, showPoints, pointRadius, showGridLines,
                        responsive, maintainAspectRatio, showLegend, legendPosition,
                        showTooltips, showTooltipSum, animate, animationDuration,
                        periodCount) {

      if ( !arg1 || !arg2 ) return null;

      var data = [];
      var sortedKeys = this.sortedKeys ? this.sortedKeys() : Object.keys(groups);

      // Check if arg1 is a date property for period range display
      var isDateAxis = false;
      if ( arg1 ) {
        if ( foam.lang.Date.isInstance(arg1) || foam.lang.DateTime.isInstance(arg1) ) {
          isDateAxis = true;
        } else if ( arg1.delegate && (foam.lang.Date.isInstance(arg1.delegate) || foam.lang.DateTime.isInstance(arg1.delegate)) ) {
          isDateAxis = true;
        }
      }

      // Apply period range if enabled (periodCount > 0) and x-axis is a date
      if ( periodCount > 0 && isDateAxis ) {
        sortedKeys = this.fillTimeGapKeys(sortedKeys, groups, periodCount, arg1);
      }

      // Process GroupBy results to Chart.js format
      for ( var i = 0; i < sortedKeys.length; i++ ) {
        var xValue = sortedKeys[i];
        var aggregatedSink = groups[xValue];
        var yValue = aggregatedSink ? aggregatedSink.value : 0;

        // Format x value for Chart.js
        var xVal = xValue;
        if ( arg1 && arg1.chartJsFormatter ) {
          xVal = arg1.chartJsFormatter(xValue);
        } else if ( foam.lang.Date.isInstance(arg1) || foam.lang.DateTime.isInstance(arg1) ) {
          if ( typeof xValue === 'number' ) {
            xVal = new Date(xValue);
          } else if ( typeof xValue === 'string' ) {
            xVal = new Date(xValue);
          }
        }

        data.push({ x: xVal, y: yValue });
      }

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
      var isTimeScale = arg1 && (foam.lang.Date.isInstance(arg1) || foam.lang.DateTime.isInstance(arg1));

      // Use the mixin method instead of duplicating chart options
      return this.createChartOptions(datasets, isTimeScale, xAxisLabel, yAxisLabel, showGridLines,
                                   responsive, maintainAspectRatio, showLegend, legendPosition,
                                   showTooltips, showTooltipSum, animate, animationDuration, timeUnit,
                                   arg1, arg2);
    }

  }
  ],
  
  methods: [
    function toE(_, x) { 
      return x.E().add(this.chart_$);
    },
    function addToE(e) { 
      e.style({ 'min-height': this.height$, height: this.height$ }).add(this.chart_$);
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
  
  properties: [
    // Map GridBy properties directly  
    { 
      name: 'xFunc',
      label: 'X-Axis Property',
      help: 'Property to group by (x-axis values)' 
    },
    { 
      name: 'yFunc',
      label: 'Line Group Property', 
      help: 'Property to group by (different lines)' 
    },
    { 
      name: 'acc',
      label: 'Aggregation Sink',
      help: 'Sink to aggregate y-values for each x-value/line combination' 
    },
      {
    name: 'chart_',
    transient: true,
    expression: function(cols, rows, xFunc, yFunc, acc, timeUnit, colors, borderColors, xAxisLabel, yAxisLabel,
                        fill, tension, stepped, showPoints, pointRadius, showGridLines,
                        responsive, maintainAspectRatio, showLegend, legendPosition,
                        showTooltips, showTooltipSum, animate, animationDuration,
                        periodCount) {

      if ( !xFunc || !yFunc || !acc ) return null;

      var datasets = [];
      var colorIndex = 0;

      var colGroups = cols && cols.groups ? cols.groups : {};
      var rowGroups = rows && rows.groups ? rows.groups : {};

      var sortedColKeys = cols && cols.sortedKeys ? cols.sortedKeys() : Object.keys(colGroups);
      var sortedRowKeys = rows && rows.sortedKeys ? rows.sortedKeys() : Object.keys(rowGroups);

      // Check if xFunc is a date property for period range display
      var isDateAxis = false;
      if ( xFunc ) {
        if ( foam.lang.Date.isInstance(xFunc) || foam.lang.DateTime.isInstance(xFunc) ) {
          isDateAxis = true;
        } else if ( xFunc.delegate && (foam.lang.Date.isInstance(xFunc.delegate) || foam.lang.DateTime.isInstance(xFunc.delegate)) ) {
          isDateAxis = true;
        }
      }

      // Apply period range if enabled (periodCount > 0) and x-axis is a date
      if ( periodCount > 0 && isDateAxis ) {
        sortedColKeys = this.fillTimeGapKeys(sortedColKeys, colGroups, periodCount, xFunc);
      }

      // Create a dataset for each line (row group)
      for ( var j = 0; j < sortedRowKeys.length; j++ ) {
        var lineKey = sortedRowKeys[j];
        var rowGroup = rowGroups[lineKey];
        var data = [];

        for ( var i = 0; i < sortedColKeys.length; i++ ) {
          var xValue = sortedColKeys[i];
          var yValue = 0;

          if ( rowGroup && rowGroup.groups && rowGroup.groups[xValue] ) {
            yValue = rowGroup.groups[xValue].value || 0;
          }

          // Format x value for Chart.js
          var xVal = xValue;
          if ( xFunc && xFunc.chartJsFormatter ) {
            xVal = xFunc.chartJsFormatter(xValue);
          } else if ( foam.lang.Date.isInstance(xFunc) || foam.lang.DateTime.isInstance(xFunc) ) {
            if ( typeof xValue === 'number' ) {
              xVal = new Date(xValue);
            } else if ( typeof xValue === 'string' ) {
              xVal = new Date(xValue);
            }
          }

          data.push({ x: xVal, y: yValue });
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

      var isTimeScale = xFunc && (foam.lang.Date.isInstance(xFunc) || foam.lang.DateTime.isInstance(xFunc));

      // Use the mixin method instead of duplicating chart options  
      return this.createChartOptions(datasets, isTimeScale, xAxisLabel, yAxisLabel, showGridLines,
                                   responsive, maintainAspectRatio, showLegend, legendPosition,
                                   showTooltips, showTooltipSum, animate, animationDuration, timeUnit,
                                   xFunc, yFunc);
      }
    }
      
  ],
  
  methods: [
    function toE(_, x) { 
      return x.E().add(this.chart_$);
    },
    function addToE(e) { 
      e.style({ 'min-height': this.height$, height: this.height$ }).add(this.chart_$);
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
      properties: ['icon', 'iconColor', 'iconSize', 'alignment', 'valueColor']
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
      if ( self.icon ) {
        e.start('div')
          .style({
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          })
          .start(self.Image, {
            role: 'presentation',
            ...(
              self.theme && self.theme.glyphs && self.theme.glyphs[self.icon] ? 
              { glyph: self.theme.glyphs[self.icon] } : 
              { data: self.icon, embedSVG: true }
            )
          })
          .style({
            width: this.iconSize$,
            height: this.iconSize$,
            color: this.iconColor$.map(v => self.getColorFromToken(v))
          })
          .end()
        .end();
      }
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
            fontSize: '3rem',
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
                  .style({ textDecoration: 'underline' })
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

