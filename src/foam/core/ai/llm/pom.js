foam.POM({
  name: 'llm',

  projects: [
    { name: 'provider/pom' }
  ],

  files: [
    { name: 'LoggingLLMService', flags: 'js|java' },
    { name: 'PMLLMService',      flags: 'js|java' }
  ]
});
