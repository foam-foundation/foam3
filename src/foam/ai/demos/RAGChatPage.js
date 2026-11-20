/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.ai.demos',
  name: 'RAGChatPage',
  extends: 'foam.u2.Controller',

  implements: [ 'foam.ai.llm.RAGService' ],

  documentation: `Demo: chat with a local LLM over the knowledge flows, with no server-side index.
    Index Knowledge Flows chunks the knowledge flows and embeds them, with the provider picked
    here, into a store in this page. The page answers the chat itself (it is the chat's
    ragService), so that provider also embeds the question.`,

  requires: [
    'foam.ai.llm.ChatMessage',
    'foam.ai.llm.ChatRequest',
    'foam.ai.llm.ConversationalLLMService',
    'foam.ai.llm.RAGAnswer',
    'foam.ai.llm.RAGChat',
    'foam.ai.llm.RAGSource',
    'foam.ai.llm.provider.TransformersLLMService',
    'foam.ai.vector.CosineComparator',
    'foam.ai.vector.VectorEmbedding',
    'foam.ai.vector.provider.TransformersEmbeddingService',
    'foam.ai.vector.ClientMarkdownChunkerService',
    'foam.core.reflow.Flow',
    'foam.dao.MDAO'
  ],

  imports: [
    'embeddingService',
    'flowDAO',
    'llmService as serverLLMService',
    'openAIEmbeddingService'
  ],

  exports: [
    'as ragService',
    'embedder as embeddingService',
    'store as vectorStoreDAO'
  ],

  messages: [
    { name: 'LOADING',     message: 'Loading…' },
    { name: 'EMBEDDED',    message: 'flows embedded' },
    { name: 'NO_FLOWS',    message: 'There are no knowledge flows to index.' },
    { name: 'STOPPED',     message: 'Embedding stopped before every flow was embedded. See the browser console, then try again.' },
    { name: 'FAILED',      message: 'The documents could not be loaded. Try again.' },
    { name: 'NOT_INDEXED', message: 'Nothing is indexed for this provider yet. Click **Index Knowledge Flows**, then ask again once the flows are embedded.' }
  ],

  constants: [
    { name: 'CONTEXT_TOKEN_BUDGET', value: 1200 }
  ],

  css: `
    << {
      align-items: center;
      background: $grey50;
      border: 1px solid #d0d0d0;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      display: flex;
      flex-direction: column;
      gap: 24px;
      padding: 40px 48px 48px;
    }
    <<toolbar {
      align-items: center;
      display: flex;
      gap: 12px;
    }
    <<status {
      color: #666;
      font-style: italic;
    }
    <<chat {
      width: 700px;
      height: 620px;
    }
  `,

  properties: [
    {
      name: 'store',
      documentation: `The chunks, in this page only. A plain MDAO: VectorStoreDAO's index runs only
        on a server, and a few hundred chunks sort by CosineComparator fast enough here.`,
      factory: function() { return this.MDAO.create({ of: this.VectorEmbedding }); }
    },
    {
      name: 'chunker',
      factory: function() { return this.ClientMarkdownChunkerService.create(); }
    },
    {
      class: 'String',
      name: 'provider',
      label: 'Embedding Provider',
      value: 'transformers',
      view: {
        class: 'foam.u2.view.ChoiceView',
        choices: [
          ['transformers',     'Transformers (browser)'],
          ['openai',           'OpenAI (api)'],
          ['embeddingService', 'Embedding Service (server)']
        ]
      }
    },
    {
      name: 'embedder',
      expression: function(provider) {
        if ( provider === 'openai'           ) return this.openAIEmbeddingService;
        if ( provider === 'embeddingService' ) return this.embeddingService;
        return this.browserEmbedder_;
      }
    },
    {
      name: 'llmService',
      expression: function(provider) {
        if ( provider === 'openai' || provider === 'embeddingService' ) return this.serverLLMService;
        return this.browserChat_;
      }
    },
    {
      class: 'Int',
      name: 'retrievalLimit',
      documentation: `How many passages go with each question. The small browser model answers
        better from 5; a server model takes more.`,
      expression: function(provider) { return provider === 'transformers' ? 5 : 10; }
    },
    {
      class: 'FObjectProperty',
      of: 'foam.ai.llm.LLMOptions',
      name: 'options',
      expression: function(provider) {
        if ( provider === 'transformers' ) {
          return foam.ai.llm.LLMOptions.create({
            maxTokens:    256,
            systemPrompt: 'Answer the question using only the numbered context passages. Answer in two to four plain sentences, with no headings, lists or conclusion. Use the names exactly as the context spells them. If the context does not hold the answer, reply only: I don\'t know.'
          });
        }
        // A server model has no ServerRAGService here to hold the grounding prompt: the page
        // builds the prompt itself, so it states the rules the service would.
        return foam.ai.llm.LLMOptions.create({
          maxTokens:    512,
          temperature:  0.2,
          systemPrompt: 'Answer using only the provided context. If the answer is not in the context, say "I don\'t know." Be brief and direct.'
        });
      }
    },
    {
      name: 'browserEmbedder_',
      factory: function() { return this.TransformersEmbeddingService.create(); }
    },
    {
      name: 'browserLLM_',
      factory: function() { return this.TransformersLLMService.create(); }
    },
    {
      name: 'browserChat_',
      documentation: `The browser model with the conversation so far, so a follow-up such as "and its
        limits?" knows what "its" is. The browser model keeps no cache between calls, so the
        history is cut every turn (maxOverflow 0), ask sends the passages in the system prompt of
        each call, the history keeps only questions and answers, and the small model's prompt
        stays short. 6 messages is the last 3 questions with their answers.`,
      factory: function() {
        return this.ConversationalLLMService.create({ delegate: this.browserLLM_, maxHistory: 6, maxOverflow: 0 });
      }
    },
    {
      class: 'Boolean',
      name: 'detached_',
      hidden: true,
      transient: true
    },
    {
      class: 'String',
      name: 'modelStatus',
      documentation: 'A browser model downloading, shown while indexing or answering waits on it.',
      expression: function(embedder$status, browserLLM_$status) { return embedder$status || browserLLM_$status || ''; }
    },
    {
      class: 'Boolean',
      name: 'indexing'
    },
    {
      class: 'String',
      name: 'statusMsg'
    }
  ],

  actions: [
    {
      name: 'index',
      label: 'Index Knowledge Flows',
      isEnabled: function(indexing) { return ! indexing; },
      code: async function(x) {
        this.indexing  = true;
        this.statusMsg = this.LOADING;
        var flows;
        try {
          flows = ( await this.flowDAO.where(this.IN(this.Flow.KEYWORDS, 'knowledge')).select() ).array;
          if ( ! flows.length ) this.statusMsg = this.NO_FLOWS;
        } catch ( err ) {
          console.error(err);
          this.statusMsg = this.FAILED;
          flows = [];
        }
        try {
          // counted as they are embedded, e.g. "40 of 132 flows embedded"
          for ( var i = 0 ; i < flows.length && ! this.detached_ ; i++ ) {
            await this.embedFlow_(x, flows[i]);
            this.statusMsg = ( i + 1 ) + ' of ' + flows.length + ' ' + this.EMBEDDED;
          }
        } catch ( err ) {
          console.error(err);
          this.statusMsg = this.STOPPED;
        }
        this.indexing = false;
      }
    }
  ],

  methods: [
    // A flow's chunks carry daoKey flowDAO and its name as sourceId, so a source link
    // opens the flow from the app's own flowDAO
    async function embedFlow_(x, flow) {
      var text = [ flow.name, flow.description ].filter(t => t);
      try {
        JSON.parse(flow.script || '[]').forEach(b => { if ( b && b.value && b.value.markdown ) text.push(b.value.markdown); });
      } catch ( e ) {}
      var chunks     = await this.chunker.chunk(x, text.join('\n\n'));
      // the chunks are documents: embedAll, since embed is for a search question
      var embeddings = await this.embedder.embedAll(x, chunks);
      for ( var i = 0 ; i < embeddings.length ; i++ ) {
        var e = embeddings[i];
        e.id       = 'flowDAO:' + flow.name + ':' + i;
        e.daoKey   = 'flowDAO';
        e.sourceId = flow.name;
        await this.store.put(e);
      }
    },

    // RAGService, in the browser: it searches this page's own store, and its local model
    // answers in English, so daoKeys and locale are not used
    async function ask(x, question) {
      var qv   = await this.embedder.embed(x, question);
      var sink = await this.store
        .where(this.EQ(this.VectorEmbedding.EMBEDDING_MODEL, qv.embeddingModel))
        .orderBy(this.CosineComparator.create({ queryVector: qv.vector }))
        .limit(this.retrievalLimit).select();

      var lines = [], sources = [], used = 0;
      for ( var i = 0 ; i < sink.array.length ; i++ ) {
        var c    = sink.array[i];
        var t    = (c.text || '').trim();
        var cost = Math.ceil(t.length / 4);
        if ( ! t || used + cost > this.CONTEXT_TOKEN_BUDGET ) break;
        lines.push('[' + (i + 1) + '] ' + t);
        used += cost;
        if ( ! sources.some(s => s.sourceId === c.sourceId) ) {
          sources.push(this.RAGSource.create({ daoKey: c.daoKey, sourceId: c.sourceId }));
        }
      }
      // no row of this model at all: the flows were not indexed with the picked provider yet
      if ( ! sink.array.length ) return this.RAGAnswer.create({ answered: true, answer: this.NOT_INDEXED });
      if ( ! lines.length ) return this.RAGAnswer.create();

      // A server model caches the start of its prompt, so the passages go in the message and the
      // system prompt stays the same on every call. The browser model reruns the whole prompt each
      // time, so they go in this call's system prompt and its history holds only the questions.
      var context = 'Context:\n' + lines.join('\n\n');
      var options = this.options;
      var message = context + '\n\nQuestion: ' + question;
      if ( this.llmService === this.browserChat_ ) {
        options = this.options.clone();
        options.systemPrompt = this.options.systemPrompt + '\n\n' + context;
        message = question;
      }
      var response = await this.llmService.chat(x, this.ChatRequest.create({
        messages: [ this.ChatMessage.create({ role: 'USER', content: message }) ],
        options:  options
      }));
      return this.RAGAnswer.create({ answered: true, answer: response.content, sources: sources });
    },

    function render() {
      var self = this;
      self.SUPER();
      // the workers hold the models in memory: end the ones this page started with it
      self.onDetach(() => {
        self.detached_ = true;
        if ( self.hasOwnProperty('browserEmbedder_') ) self.browserEmbedder_.terminate();
        if ( self.hasOwnProperty('browserLLM_') ) self.browserLLM_.terminate();
      });
      self
        .addClass()
        .start('h2').add('RAG Chat').end()

        .start().addClass(self.myClass('toolbar'))
          .tag(self.PROVIDER)
          .tag(self.INDEX)
          .start('span').addClass(self.myClass('status')).add(self.slot(function(modelStatus, statusMsg) { return modelStatus || statusMsg; })).end()
        .end()

        .start().addClass(self.myClass('chat'))
          // the browser model's answer shows word by word as it writes it
          .tag(self.RAGChat, { title: 'RAG Chat', thinkingMsg$: self.modelStatus$, partial$: self.browserLLM_.text$ })
        .end();
    }
  ]
});
