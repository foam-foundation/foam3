foam.POM({
  name: 'ai',

  projects: [
    { name: 'vector/pom' },
    { name: 'test/pom', flags: 'test' }
  ],

  javaFiles: [
    { name: 'mcp/MCPWebAgent' },
    { name: 'LLMStreamWriter' }
  ],

  files: [
    // Interface (generates Skeleton, Client, Proxy)
    { name: 'LLMService',               flags: 'js|java' },
    { name: 'LLMStream',                flags: 'js|java' },

    // Implementations
    { name: 'OllamaLLMService',         flags: 'js|java' },
    { name: 'ClaudeLLMService',         flags: 'js|java' },
    { name: 'DeepSeekLLMService',       flags: 'js|java' },
    { name: 'OpenAILLMService',         flags: 'js|java' },

    // Decorators
    { name: 'ConversationalLLMService', flags: 'js' },
    { name: 'LoggingLLMService',        flags: 'js|java' },
    { name: 'PMLLMService',             flags: 'js|java' }
  ]
});
