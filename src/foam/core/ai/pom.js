foam.POM({
  name: 'ai',

  files: [
    // Interface (generates Skeleton, Client, Proxy)
    { name: 'LLMService',               flags: 'js|java' },

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
