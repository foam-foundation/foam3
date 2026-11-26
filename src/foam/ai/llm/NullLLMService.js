/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.ai.llm',
  name: 'NullLLMService',
  implements: [ 'foam.ai.llm.LLMService' ],

  documentation: `
    The LLMService to give a user who may not use AI. Instead of failing, every
    complete and chat call answers with NOT_AVAILABLE, "AI is not available for
    this user.", so an AI screen shows that sentence in place of a model's reply.
    It holds no state, so there is only one: NullLLMService.create() in JS, and
    NullLLMService.instance() in Java.
  `,

  axioms: [ foam.pattern.Singleton.create() ],

  requires: [ 'foam.ai.llm.LLMResponse' ],

  messages: [
    { name: 'NOT_AVAILABLE', message: 'markdown The LLM Service is not available for this user.' }
  ],

  javaCode: `
    private static final NullLLMService instance__ = new NullLLMService();
    public  static NullLLMService instance() { return instance__; }
  `,

  methods: [
    {
      name: 'complete',
      code: async function(x, request) {
        return this.LLMResponse.create({ content: this.NOT_AVAILABLE });
      },
      javaCode: `
        LLMResponse response = new LLMResponse();
        response.setContent(NOT_AVAILABLE);
        return response;
      `
    },
    {
      name: 'chat',
      code: async function(x, request) {
        return this.LLMResponse.create({ content: this.NOT_AVAILABLE });
      },
      javaCode: `
        LLMResponse response = new LLMResponse();
        response.setContent(NOT_AVAILABLE);
        return response;
      `
    }
  ]
});
