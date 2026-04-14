/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ai',
  name: 'OllamaLLMService',
  extends: 'foam.core.ai.OpenAILLMService',

  documentation: `
    Ollama implementation of LLMService.
    Ollama runs models locally and exposes an OpenAI-compatible API,
    so this just overrides the base URL and default model.
    No API key required for local instances.
  `,

  properties: [
    {
      class: 'String',
      name: 'defaultModel',
      value: 'llama3'
    },
    {
      class: 'String',
      name: 'baseURL',
      value: 'http://localhost:11434/v1/chat/completions'
    }
  ]
});
