/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */


foam.ENUM({
  package: 'foam.core.ai',
  name: 'ChatRole',
  values: [
    { name: 'SYSTEM',    label: 'system'    },
    { name: 'USER',      label: 'user'      },
    { name: 'ASSISTANT', label: 'assistant'  }
  ]
});


foam.CLASS({
  package: 'foam.core.ai',
  name: 'ChatMessage',

  properties: [
    {
      class: 'Enum',
      of: 'foam.core.ai.ChatRole',
      name: 'role',
      value: 'USER'
    },
    {
      class: 'String',
      name: 'content'
    }
  ]
});


foam.CLASS({
  package: 'foam.core.ai',
  name: 'LLMOptions',

  documentation: 'Provider-agnostic completion options.',

  properties: [
    {
      class: 'String',
      name: 'model',
      documentation: 'Model identifier. Provider maps this to its own naming.'
    },
    {
      class: 'Int',
      name: 'maxTokens',
      value: 4096
    },
    {
      class: 'Float',
      name: 'temperature',
      value: 1.0
    },
    {
      class: 'String',
      name: 'systemPrompt'
    }
  ]
});


foam.CLASS({
  package: 'foam.core.ai',
  name: 'CompletionRequest',

  properties: [
    {
      class: 'String',
      name: 'prompt',
      required: true
    },
    {
      class: 'FObjectProperty',
      of: 'foam.core.ai.LLMOptions',
      name: 'options',
      factory: function() { return foam.core.ai.LLMOptions.create(); }
    }
  ]
});


foam.CLASS({
  package: 'foam.core.ai',
  name: 'CompletionResponse',

  properties: [
    {
      class: 'String',
      name: 'content',
      documentation: 'The text response from the model.'
    },
    {
      class: 'String',
      name: 'model',
      documentation: 'The model that actually served the request.'
    },
    {
      class: 'Int',
      name: 'inputTokens'
    },
    {
      class: 'Int',
      name: 'outputTokens'
    },
    {
      class: 'String',
      name: 'stopReason'
    }
  ]
});


foam.INTERFACE({
  package: 'foam.core.ai',
  name: 'LLMService',

  documentation: `
    Abstract LLM completion service. Implementations provide
    Claude, OpenAI, Ollama, etc. behind a uniform interface.
    Decoratable for logging, auth, rate-limiting, caching, etc.
  `,

  skeleton: true,
  client:   true,
  proxy:    true,

  methods: [
    {
      name: 'complete',
      async: true,
      type: 'foam.core.ai.CompletionResponse',
      documentation: 'Send a prompt and return the model completion.',
      args: 'Context x, foam.core.ai.CompletionRequest request'
    },
    {
      name: 'chat',
      async: true,
      type: 'foam.core.ai.CompletionResponse',
      documentation: 'Multi-turn chat completion with message history.',
      args: 'Context x, foam.core.ai.ChatMessage[] messages, foam.core.ai.LLMOptions options'
    }
  ]
});
