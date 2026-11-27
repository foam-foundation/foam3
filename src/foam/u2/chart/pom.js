/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.POM({
  name: 'chart',
  projects: [
    { name: 'test/pom', flags: 'test' }
  ],
  files: [
    { name: 'PropertyChartFormatterRefinement', flags: 'web' },
    { name: 'LinearScale',                      flags: 'web' },
    { name: 'BandScale',                        flags: 'web' },
    { name: 'TimeScale',                        flags: 'web' },
    { name: 'ChartLegend',                      flags: 'web' },
    { name: 'ChartView',                        flags: 'web' },
    { name: 'CartesianChartView',               flags: 'web' },
    { name: 'BarChart',                         flags: 'web' },
    { name: 'LineChart',                        flags: 'web' },
    { name: 'PieChart',                         flags: 'web' }
  ]
});
