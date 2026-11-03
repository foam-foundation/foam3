/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.ai.llm.provider',
  name: 'TransformersLLMService',
  implements: ['foam.ai.llm.LLMService'],

  requires: [
    'foam.ai.llm.ChatMessage',
    'foam.ai.llm.ChatRole',
    'foam.ai.llm.ChatRequest',
    'foam.ai.llm.LLMResponse',
    'foam.u2.ModuleLib'
  ],

  constants: {
    CDN: 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js'
  },

  properties: [
    {
      class: 'String',
      name: 'model',
      value: 'Xenova/Qwen1.5-0.5B-Chat'
    },
    {
      name: 'pipeline_',
      transient: true
    }
  ],

  methods: [
    async function ensurePipeline_() {
      if ( this.pipeline_ ) return;
      const mod = await this.ModuleLib.create({ src: this.CDN }).installLib();
      if ( ! mod ) throw new Error('Failed to load Transformers.js from ' + this.CDN);
      mod.env.allowLocalModels = false;
      this.pipeline_ = await mod.pipeline('text-generation', this.model);
    },

    async function complete(x, request) {
      var userMsg = this.ChatMessage.create({ role: 'USER', content: request.prompt });
      return this.chat(x, this.ChatRequest.create({
        messages: [ userMsg ],
        options:  request.options
      }));
    },

    async function chat(x, request) {
      await this.ensurePipeline_();

      var messages = request.messages;
      var options  = request.options;

      // Build plain objects for the pipeline, prepending system from options
      var plainMsgs = [];
      if ( options && options.systemPrompt ) {
        plainMsgs.push({ role: 'system', content: options.systemPrompt });
      }
      for ( var i = 0; i < messages.length; i++ ) {
        plainMsgs.push({ role: messages[i].role.label, content: messages[i].content });
      }

      var maxTokens   = (options && options.maxTokens) || 512;
      var temperature = (options && options.temperature !== 1.0) ? options.temperature : 0.2;

      var out = await this.pipeline_(plainMsgs, {
        max_new_tokens:     maxTokens,
        do_sample:          true,
        temperature:        temperature,
        repetition_penalty: 1.1,
        return_full_text:   false
      });

      // With messages input, generated_text is an array; last entry is the assistant reply
      var result  = out[0]?.generated_text;
      var content = Array.isArray(result) ? (result.at(-1)?.content || '') : (result || '').trim();
      return this.LLMResponse.create({ content: content });
    }
  ]
});
