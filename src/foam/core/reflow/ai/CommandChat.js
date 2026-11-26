/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.ai',
  name: 'CommandChat',

  documentation: `
    One request to the model in which it may run scripts at the Reflow prompt before it
    answers. ask(message) sends the message, runs every script the model sends through
    the tool (a CommandTool) and sends the results back, until the model answers without
    a script or maxCalls is reached, and returns that answer.
  `,

  requires: [
    'foam.ai.llm.ChatMessage',
    'foam.ai.llm.ChatRequest',
    'foam.core.reflow.ai.CommandTool'
  ],

  imports: [ 'llmService' ],

  properties: [
    {
      name: 'options',
      documentation: 'The foam.ai.llm.LLMOptions of every call; the tool is added to its tools.'
    },
    {
      name: 'tool',
      documentation: 'The CommandTool the model\'s scripts run through.',
      factory: function() { return this.CommandTool.create(null, this); }
    },
    {
      class: 'Int',
      name: 'maxCalls',
      value: 12,
      documentation: `Model calls one ask makes. Every call sends the conversation so
        far, so the cost grows with each; before the last one the model is told
        to answer.`
    },
    {
      class: 'String',
      name: 'lastCall',
      value: 'That was your last script: answer now.',
      documentation: 'What the model is told before its last call.'
    }
  ],

  methods: [
    async function ask(message) {
      var options  = this.options.clone();
      options.tools = options.tools.concat([ this.tool.tool() ]);
      // every call sends the whole ask so far, so a flow's conversation must not add its own copy
      options.stateless = true;
      var messages = [ this.ChatMessage.create({ content: message }) ];
      for ( var call = 1 ; ; call++ ) {
        var reply = await this.llmService.chat(this.__subContext__, this.ChatRequest.create({ options: options, messages: messages }));
        // an answer still running scripts at the last call is returned as it is
        if ( call === this.maxCalls || ! reply.toolUses.length ) return reply.content;
        for ( var use of reply.toolUses ) use.result = await this.tool.run(use);
        messages = messages.concat([ reply.toMessage() ]);
        if ( call + 1 === this.maxCalls ) messages = messages.concat([ this.ChatMessage.create({ content: this.lastCall }) ]);
      }
    }
  ]
});
