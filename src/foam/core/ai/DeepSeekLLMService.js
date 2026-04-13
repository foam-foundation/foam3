/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ai',
  name: 'DeepSeekLLMService',
  extends: 'foam.core.ai.OpenAILLMService',

  documentation: `
    DeepSeek implementation of LLMService.
    DeepSeek uses an OpenAI-compatible API, so this just
    overrides the base URL and default model.
  `,

  properties: [
    {
      class: 'String',
      name: 'defaultModel',
      value: 'deepseek-chat'
    },
    {
      class: 'String',
      name: 'baseURL',
      value: 'https://api.deepseek.com/chat/completions'
    }
  ]
});
