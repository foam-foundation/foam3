foam.POM({
  name: 'dashboard',
  projects: [
    { name: 'test/pom', flags: 'test' }
  ],
  files: [
    { name: 'MetricOperation',         flags: 'js|java' },
    { name: 'MetricAlignment',         flags: 'js|java' },

    { name: 'DateKeys',                flags: 'js|java' },

    { name: 'CalendarChartView',       flags: 'web' },
    { name: 'ChartFieldProperty',      flags: 'js|java' },
    { name: 'DashboardSinks',          flags: 'js|java' },
    { name: 'DashboardDAOAgents',      flags: 'js' }
  ]
});