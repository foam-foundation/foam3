foam.POM({
  name: 'grant',

  projects: [
    { name: 'test/pom', flags: 'test' }
  ],

  files: [
    { name: 'Grant',                      flags: 'js|java' },
    { name: 'Recording',                  flags: 'js|java' }
  ]
});
