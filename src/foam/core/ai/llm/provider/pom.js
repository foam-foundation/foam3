foam.POM({
  name: 'provider',

  files: [
    { name: 'AbstractHTTPLLMService', flags: 'js|java' },
    { name: 'OpenAILLMService',   flags: 'js|java' },
    { name: 'ClaudeLLMService',   flags: 'js|java' },
    { name: 'DeepSeekLLMService', flags: 'js|java' },
    { name: 'OllamaLLMService',   flags: 'js|java' }
  ],

  projects: [
    { name: 'test/pom', flags: 'test' }
  ]
});
