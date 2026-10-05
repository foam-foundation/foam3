/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */


foam.ENUM({
  package: 'foam.ai.llm',
  name: 'ChatRole',
  values: [
    { name: 'SYSTEM',    label: 'system'    },
    { name: 'USER',      label: 'user'      },
    { name: 'ASSISTANT', label: 'assistant'  }
  ]
});


foam.CLASS({
  package: 'foam.ai.llm',
  name: 'ChatMessage',

  properties: [
    {
      class: 'Enum',
      of: 'foam.ai.llm.ChatRole',
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
  package: 'foam.ai.llm',
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
  package: 'foam.ai.llm',
  name: 'LLMRequest',
  abstract: true,

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.ai.llm.LLMOptions',
      name: 'options',
      factory: function() { return foam.ai.llm.LLMOptions.create(); }
    }
  ]
});


foam.CLASS({
  package: 'foam.ai.llm',
  name: 'CompletionRequest',
  extends: 'foam.ai.llm.LLMRequest',

  properties: [
    {
      class: 'String',
      name: 'prompt',
      required: true
    }
  ]
});


foam.CLASS({
  package: 'foam.ai.llm',
  name: 'ChatRequest',
  extends: 'foam.ai.llm.LLMRequest',

  properties: [
    {
      class: 'FObjectArray',
      of: 'foam.ai.llm.ChatMessage',
      name: 'messages'
    }
  ]
});


foam.CLASS({
  package: 'foam.ai.llm',
  name: 'LLMResponse',

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
  package: 'foam.ai.llm',
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
      type: 'foam.ai.llm.LLMResponse',
      documentation: 'Send a prompt and return the model completion.',
      args: 'Context x, foam.ai.llm.CompletionRequest request'
    },
    {
      name: 'chat',
      async: true,
      type: 'foam.ai.llm.LLMResponse',
      documentation: 'Multi-turn chat completion with message history.',
      args: 'Context x, foam.ai.llm.ChatRequest request'
    }
  ]
});
