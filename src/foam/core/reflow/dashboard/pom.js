foam.POM({
  name: 'dashboard',
  projects: [
    { name: 'test/pom', flags: 'test' }
  ],
  files: [
    { name: 'MetricOperation',         flags: 'js|java' },
    { name: 'MetricAlignment',         flags: 'js|java' },

    { name: 'LegendPosition',          flags: 'js|java' },
    { name: 'CanvasTextUtil',          flags: 'js' },
    { name: 'DashboardSinks',          flags: 'js|java' },
    { name: 'DashboardDAOAgents',      flags: 'js' },

    { name: 'TimeUnit',                flags: 'js|java' },
  ]
});