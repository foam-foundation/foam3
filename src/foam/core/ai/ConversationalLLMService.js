/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ai',
  name: 'ConversationalLLMService',
  extends: 'foam.core.ai.ProxyLLMService',

  documentation: `
    Decorator that maintains conversation history.
    Converts complete() calls into chat() calls with accumulated
    message history so the LLM has context across multiple
    agent invocations within the same flow document.
  `,

  properties: [
    {
      name: 'history',
      documentation: 'Map of flowId → ChatMessage[]',
      factory: function() { return []; }
    },
    {
      class: 'Int',
      name: 'maxHistory',
      documentation: 'Max messages to retain per flow. Older messages are trimmed.',
      value: 50
    }
  ],

  methods: [
    async function complete(x, request) {
      var history = this.history;

      // Append user message
      history.push(
        foam.core.ai.ChatMessage.create({
          role:    foam.core.ai.ChatRole.USER,
          content: request.prompt
        })
      );

      // Call delegate as chat with full history
      var response = await this.delegate.chat(x, history, request.options);

      // Append assistant response
      history.push(
        foam.core.ai.ChatMessage.create({
          role:    foam.core.ai.ChatRole.ASSISTANT,
          content: response.content
        })
      );

      this.trimHistory();

      return response;
    },

    async function chat(x, messages, options) {
      // Pass-through for explicit chat calls
      return this.delegate.chat(x, messages, options);
    },

    function trimHistory() {
      if ( this.history.length > this.maxHistory ) {
        // Keep the most recent messages, always trimming in pairs
        this.history = history.slice(this.history.length - this.maxHistory);
      }
    },

    function clearHistory() {
      this.history = {};
    }
  ]
});
