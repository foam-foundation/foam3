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
  name: 'DashboardBarSink',
  extends: 'foam.mlang.sink.TopNGroupBy',
  
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
    {
      name: 'chart_',
      transient: true,
      expression: function(groups, colors, timeUnit, horizontal, barThickness, datasetLabel, xAxisLabel, yAxisLabel, 
                          showGridLines, responsive, maintainAspectRatio, showLegend, 
                          legendPosition, showTooltips, showTooltipSum, animate, animationDuration) {
        
        var labels = [];
        var data = [];
        var backgroundColors = [];
        
        // Check if we're dealing with dates using the groupBy property
        var isDateAxis = this.arg1 && (foam.lang.Date.isInstance(this.arg1) || foam.lang.DateTime.isInstance(this.arg1));
        
        // If topN > 0, use groupKeys to preserve backend order (JavaScript reorders numeric keys)
        // Otherwise, use sortedKeys() for proper sorting
        var sortedKeys = this.topN > 0 ? (this.groupKeys || Object.keys(groups)) : 
                        (this.sortedKeys ? this.sortedKeys() : Object.keys(groups));
        
        var index = 0;
        for ( var i = 0; i < sortedKeys.length; i++ ) {
          var key = sortedKeys[i];
          // Use chartJsFormatter if available, otherwise use the key as-is
          var label = this.arg1 && this.arg1.chartJsFormatter ? 
                      this.arg1.chartJsFormatter(key) : key;
          labels.push(label);
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
        
        // Configure time scale if dealing with date/time properties
        // Use the isDateAxis flag we set earlier when detecting date keys
        if ( isDateAxis ) {
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
      e.style({ 'min-height': this.height$, height: this.height$ }).add(this.chart_$);
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
      e.style({ 'min-height': this.height$, height: this.height$ }).add(this.chart_$);
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow.dashboard',
  name: 'DashboardStackedBarSink',
  extends: 'foam.core.reflow.GridBy',
  
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
    {
      name: 'chart_',
      transient: true,
      expression: function(cols, rows, colors, timeUnit, horizontal, xAxisLabel, yAxisLabel,
                          showGridLines, responsive, maintainAspectRatio,
                          showLegend, legendPosition, showTooltips, showTooltipSum, animate, animationDuration) {
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
        
        // Check if we're dealing with dates on x-axis using the xFunc property
        var isDateAxis = this.xFunc && (foam.lang.Date.isInstance(this.xFunc) || foam.lang.DateTime.isInstance(this.xFunc));
        
        // Get sorted column keys using FOAM's sorting
        var sortedColKeys = [];
        if ( cols && cols.sortedKeys ) {
          sortedColKeys = cols.sortedKeys();
        } else {
          sortedColKeys = Object.keys(colGroups);
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
      e.style({ 'min-height': this.height$, height: this.height$ }).add(this.chart_$);
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
    { class: 'Int', name: 'animationDuration', value: 1000 }
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
      e.style({ 'min-height': this.height$, height: this.height$ }).add(this.chart_$);
    }
  ]
});

foam.CLASS({
  package: 'foam.core.reflow.dashboard',
  name: 'DashboardLineSink',
  extends: 'foam.mlang.sink.GroupBy',
  mixins: ['foam.core.reflow.dashboard.LineChartMixin'],
  
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
                        showTooltips, showTooltipSum, animate, animationDuration) {

      if ( !arg1 || !arg2 ) return null;

      var data = [];
      var sortedKeys = this.sortedKeys ? this.sortedKeys() : Object.keys(groups);

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
  mixins: ['foam.core.reflow.dashboard.LineChartMixin'],
  
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
                        showTooltips, showTooltipSum, animate, animationDuration) {

      if ( !xFunc || !yFunc || !acc ) return null;

      var datasets = [];
      var colorIndex = 0;

      var colGroups = cols && cols.groups ? cols.groups : {};
      var rowGroups = rows && rows.groups ? rows.groups : {};

      var sortedColKeys = cols && cols.sortedKeys ? cols.sortedKeys() : Object.keys(colGroups);
      var sortedRowKeys = rows && rows.sortedKeys ? rows.sortedKeys() : Object.keys(rowGroups);

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

  imports: ['theme'],

  exports: ['lastEncounteredObj_ as objData'],

  sections: [
    {
      name: 'metricConfig',
      title: 'Metric Configuration',
      order: 1,
      collapsable: true,
      properties: ['operation', 'prop', 'label', 'prefix', 'postfix', 'decimalPlaces', 'convertToLocalString']
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
      view: 'foam.u2.view.TokenColorEditView',
      value: '$primary500',
      view: 'foam.u2.view.ColorEditView',
      // TODO: Hidden for now as CSS override for SVG fill is not working properly
      // Need to fix the implementation to properly apply color to icons
      hidden: true
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
      class: 'Color',
      name: 'valueColor',
      help: 'Color for the metric value',
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
      class: 'Color',
      name: 'labelColor',
      help: 'Color for the display label (CSS color or token)',
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
      class: 'Color',
      name: 'countColor',
      help: 'Color for the count text (CSS color or token)',
      value: '$textSecondary'
    },
    {
      name: 'metric_',
      hidden: true,
      expression: function(sink, countSink, showCount, decimalPlaces, convertToLocalString, postfix, prefix) {
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
    function init() {
      this.SUPER();
      if ( ! this.sink )
        this.updateSink();
    },
    
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
            height: this.iconSize$
          })
          .end()
        .end();
      }
      e.start('div')
          .style({
            fontSize: this.labelFontSize$,
            color: this.labelColor$,
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
            color: self.valueColor$,
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
          this.start('div')
            .style({
              fontSize: self.countFontSize$,
              marginTop: '8px',
              color: self.countColor$,
              fontWeight: self.countFontWeight$
            })
            .add(self.countSuffix$.map(v => metric.count.toLocaleString() + (v ? ' ' + v : '')))
          .end();
        }
      }));
    },

    function eof() {
      // No action needed for simple sink
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
    }
  ]
});

