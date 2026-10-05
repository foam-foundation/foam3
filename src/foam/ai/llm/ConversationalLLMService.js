/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.ai.llm',
  name: 'ConversationalLLMService',
  extends: 'foam.ai.llm.ProxyLLMService',

  documentation: `
    Decorator that accumulates conversation history across calls.
    Wrap any LLMService with this to get stateful multi-turn chat without
    the caller needing to manage history manually.
  `,

  requires: [
    'foam.ai.llm.ChatMessage',
    'foam.ai.llm.ChatRole',
    'foam.ai.llm.ChatRequest'
  ],

  properties: [
    {
      class: 'Array',
      name: 'history',
      documentation: 'Accumulated ChatMessage[] across all calls.',
      factory: function() { return []; }
    },
    {
      class: 'Int',
      name: 'maxHistory',
      documentation: 'Max messages to retain. Older messages are trimmed in pairs.',
      value: 50
    }
  ],

  methods: [
    async function complete(x, request) {
      var userMsg = this.ChatMessage.create({ role: 'USER', content: request.prompt });
      return this.chat(x, this.ChatRequest.create({
        messages: [ userMsg ],
        options:  request.options
      }));
    },

    async function chat(x, request) {
      var i;
      for ( i = 0; i < request.messages.length; i++ ) this.history.push(request.messages[i]);

      var response = await this.delegate.chat(x, this.ChatRequest.create({
        messages: this.history,
        options:  request.options
      }));

      this.history.push(this.ChatMessage.create({
        role:    'ASSISTANT',
        content: response.content
      }));

      this.trimHistory_();
      return response;
    },

    function clearHistory() {
      this.history = [];
    },

    function trimHistory_() {
      if ( this.history.length > this.maxHistory ) {
        this.history = this.history.slice(this.history.length - this.maxHistory);
      }
    }
  ]
});
