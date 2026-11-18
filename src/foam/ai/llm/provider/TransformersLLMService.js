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
    'foam.ai.vector.provider.TransformersPipeline'
  ],

  messages: [
    { name: 'PREPARING', message: 'Preparing the assistant…' },
    { name: 'WRITING',   message: 'Writing the answer…' }
  ],

  properties: [
    {
      class: 'String',
      name: 'model',
      documentation: `A small chat model in ONNX form, downloaded once and kept in the browser's
        cache. The default is 919 MB on a GPU, with 4-bit weights, and 618 MB without one,
        where it runs on 8-bit weights.`,
      value: 'onnx-community/Qwen3-0.6B-ONNX'
    },
    {
      class: 'String',
      name: 'status',
      documentation: `What the model is doing, e.g. "Preparing the assistant… 60%" while it
        downloads, then "Writing the answer…". Empty when no answer is waiting, so a view can
        show it while a question waits on the model.`,
      transient: true
    },
    {
      class: 'String',
      name: 'text',
      documentation: `The answer so far while the model writes it, e.g. "The Getting Started"
        after three words, so a view can show it word by word. Empty when no answer is waiting.`,
      transient: true
    },
    {
      name: 'pipeline_',
      documentation: 'Runs the model in a Web Worker, so the page stays responsive while it writes.',
      transient: true,
      hidden: true,
      factory: function() {
        return this.TransformersPipeline.create({
          task:       'text-generation',
          model:      this.model,
          // 4-bit weights on the GPU: they answer in about 4 seconds, where 8-bit ones took
          // over a minute an answer
          dtype:      { gpu: 'q4', wasm: 'q8' },
          onProgress: percent => this.onProgress_(percent),
          onText:     text => { this.text += text; }
        });
      }
    }
  ],

  methods: [
    // once every byte is in, the model takes a few seconds to load: the percent is dropped then
    function onProgress_(percent) {
      this.status = percent < 100 ? this.PREPARING + ' ' + percent + '%' : this.PREPARING;
    },

    async function complete(x, request) {
      var userMsg = this.ChatMessage.create({ role: 'USER', content: request.prompt });
      return this.chat(x, this.ChatRequest.create({
        messages: [ userMsg ],
        options:  request.options
      }));
    },

    async function chat(x, request) {
      var messages = request.messages;
      var options  = request.options;

      // LLMOptions.tools: a model run in the browser has no tool calls
      if ( options && options.tools.length ) throw new Error('This model cannot call tools');

      // Build plain objects for the pipeline, prepending system from options
      var plainMsgs = [];
      if ( options && options.systemPrompt ) {
        plainMsgs.push({ role: 'system', content: options.systemPrompt });
      }
      for ( var i = 0; i < messages.length; i++ ) {
        plainMsgs.push({ role: messages[i].role.label, content: messages[i].content });
      }

      // A small model sampled at random drifts off the context, so it picks the likeliest word
      // each time unless the caller asks for a temperature
      var generation = {
        max_new_tokens:     ( options && options.maxTokens ) || 256,
        do_sample:          !! ( options && options.temperature > 0 ),
        repetition_penalty: 1.1,
        return_full_text:   false,
        // Qwen3 writes its reasoning before the answer unless told not to: enable_thinking false
        // makes its chat template open the answer with an empty <think></think> block, so all
        // of max_new_tokens go to the answer and the reply holds no reasoning
        tokenizer_encode_kwargs: { enable_thinking: false }
      };
      if ( generation.do_sample ) generation.temperature = options.temperature;

      var out;
      try {
        // inside the try: a failed download clears its "Preparing…" status
        await this.pipeline_.load();
        this.status = this.WRITING;
        out = await this.pipeline_.run(plainMsgs, generation);
      } finally {
        this.status = '';
        this.text   = '';
      }

      // With messages input, generated_text is an array; last entry is the assistant reply
      var result  = out[0]?.generated_text;
      var content = Array.isArray(result) ? (result.at(-1)?.content || '') : (result || '').trim();
      return this.LLMResponse.create({ content: content });
    }
  ]
});
