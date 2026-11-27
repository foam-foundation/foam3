/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// The look of these charts (chart types, legend, tooltips and options) is based
// on Chart.js (https://github.com/chartjs/Chart.js), which drew FOAM's charts
// before. The code is FOAM's own; no Chart.js code was used.
foam.POM({
  name: 'chart',
  projects: [
    { name: 'test/pom', flags: 'test' }
  ],
  files: [
    { name: 'TimeUnit',                         flags: 'js|java' },
    { name: 'LegendPosition',                   flags: 'js|java' },
    { name: 'PropertyChartFormatterRefinement', flags: 'web' },
    { name: 'LinearScale',                      flags: 'web' },
    { name: 'BandScale',                        flags: 'web' },
    { name: 'TimeScale',                        flags: 'web' },
    { name: 'ColorScale',                       flags: 'web' },
    { name: 'SVGPath',                          flags: 'web' },
    { name: 'Dataset',                          flags: 'web' },
    { name: 'LineDataset',                      flags: 'web' },
    { name: 'ChartLegend',                      flags: 'web' },
    { name: 'ChartView',                        flags: 'web' },
    { name: 'CartesianChartView',               flags: 'web' },
    { name: 'BarChart',                         flags: 'web' },
    { name: 'XAxisType',                        flags: 'web' },
    { name: 'LineChart',                        flags: 'web' },
    { name: 'PieChart',                         flags: 'web' },
    { name: 'ScatterChart',                     flags: 'web' },
    { name: 'BubbleChart',                      flags: 'web' },
    { name: 'RadarChart',                       flags: 'web' },
    { name: 'HeatmapChart',                     flags: 'web' },
    { name: 'HistogramChart',                   flags: 'web' },
    { name: 'WaterfallStepKind',                flags: 'web' },
    { name: 'WaterfallChart',                   flags: 'web' },
    { name: 'BoxPlotChart',                     flags: 'web' },
    { name: 'TreemapChart',                     flags: 'web' },
    { name: 'FunnelChart',                      flags: 'web' }
  ]
});
