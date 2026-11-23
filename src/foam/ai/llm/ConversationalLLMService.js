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
      documentation: 'Messages kept after a cut; the oldest go first.',
      value: 50
    },
    {
      class: 'Int',
      name: 'maxOverflow',
      documentation: `How many messages past maxHistory the history may grow before it is cut back
        to maxHistory in one step. A model that caches the start of its prompt, as server APIs do,
        reuses that start only while it stays the same, so cutting once every few turns keeps most
        calls cheap. With maxHistory 6 and maxOverflow 6 the history grows to 12 messages, then
        drops to the last 6. Set 0 for a model that reruns the whole prompt on every call: there
        only a shorter prompt saves time, so the history is cut every turn.`,
      expression: function(maxHistory) { return Math.floor(maxHistory / 2); }
    },
    {
      name: 'inbox',
      documentation: `What was said to the model while a caller was still acting on its last
        reply. A Reflow agent sets this to an array for as long as it runs the commands of a
        reply: the answers of its asks gather here and go out together as its next request.
        Unset when no caller is acting on a reply.`
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
      // A caller with its own history already sends its earlier messages;
      // adding ours would send each of them twice.
      if ( request.options && request.options.stateless ) return this.delegate.chat(x, request);

      var response = await this.delegate.chat(x, this.ChatRequest.create({
        messages: this.history.concat(request.messages),
        options:  request.options
      }));

      // A request joins the history only with its reply. Added before the call,
      // a request whose call failed, such as on a gateway timeout, stayed in the
      // history unanswered, and the next call sent two user messages in a row.
      var i;
      for ( i = 0; i < request.messages.length; i++ ) this.history.push(request.messages[i]);

      // the turn keeps its tool calls and thinking, or the next request sends the
      // results of calls the model never made, which the provider refuses
      this.history.push(response.toMessage());

      this.trimHistory_();
      return response;
    },

    function clearHistory() {
      this.history = [];
    },

    function trimHistory_() {
      if ( this.history.length > this.maxHistory + this.maxOverflow ) {
        this.history = this.history.slice(this.history.length - this.maxHistory);
      }
    }
  ]
});
