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
    Index Knowledge Flows copies the flows into a DAO in this page; Flow is EmbeddingAware, so
    that DAO marks each copy NEW and the page's EmbeddingSync embeds it a moment later into a
    store in this page, with the provider picked here. The page answers the chat itself (it is
    the chat's ragService), so that provider also embeds the question.`,

  requires: [
    'foam.ai.llm.ChatMessage',
    'foam.ai.llm.ChatRequest',
    'foam.ai.llm.RAGAnswer',
    'foam.ai.llm.RAGChat',
    'foam.ai.llm.RAGSource',
    'foam.ai.llm.provider.TransformersLLMService',
    'foam.ai.vector.CosineComparator',
    'foam.ai.vector.EmbeddingStatus',
    'foam.ai.vector.EmbeddingSync',
    'foam.ai.vector.VectorEmbedding',
    'foam.ai.vector.provider.TransformersEmbeddingService',
    'foam.core.reflow.Flow',
    'foam.dao.EasyDAO',
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
    'embeddingSync',
    'store as vectorStoreDAO'
  ],

  messages: [
    { name: 'LOADING',     message: 'Loading…' },
    { name: 'READING',     message: 'Reading the documents…' },
    { name: 'READY',       message: 'Ready' },
    { name: 'FAILED',      message: 'The documents could not be loaded. Try again.' },
    { name: 'NOT_INDEXED', message: 'Nothing is indexed for this provider yet. Click **Index Knowledge Flows**, then ask again once the flows are embedded.' }
  ],

  constants: [
    { name: 'CONTEXT_TOKEN_BUDGET', value: 1200 },
    // How many passages go with each question. With the browser model, 5 kept every answer
    // right; 10 doubled the time and listed sources off the topic; 3 left some answers thin,
    // e.g. how to schedule a job
    { name: 'RETRIEVAL_LIMIT',      value: 5    }
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
      name: 'embeddingSync',
      documentation: 'Embeds the flows docDAO marks, with the picked provider.',
      factory: function() { return this.EmbeddingSync.create(); }
    },
    {
      name: 'store',
      documentation: `The chunks, in this page only. A plain MDAO: VectorStoreDAO's index runs only
        on a server, and a few hundred chunks sort by CosineComparator fast enough here.`,
      factory: function() { return this.MDAO.create({ of: this.VectorEmbedding }); }
    },
    {
      name: 'docDAO',
      documentation: `The knowledge flows, copied into this page. Named flowDAO, so a chunk's source
        link opens the flow from the app's own flowDAO.`,
      factory: function() {
        var dao = this.EasyDAO.create({ of: this.Flow, daoType: 'MDAO', name: 'flowDAO' });
        dao.on.sub(this.onDocsChange);
        return dao;
      }
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
        return this.TransformersEmbeddingService.create();
      }
    },
    {
      name: 'llmService',
      expression: function(provider) {
        if ( provider === 'openai' || provider === 'embeddingService' ) return this.serverLLMService;
        // no conversation history: each question carries its own passages, so earlier turns
        // only make the small model's prompt longer
        return this.browserLLM_;
      }
    },
    {
      class: 'FObjectProperty',
      of: 'foam.ai.llm.LLMOptions',
      name: 'options',
      factory: function() {
        return foam.ai.llm.LLMOptions.create({
          maxTokens:    256,
          systemPrompt: 'Answer the question using only the numbered context passages. Answer in two to four plain sentences, with no headings, lists or conclusion. Use the names exactly as the context spells them. If the context does not hold the answer, reply only: I don\'t know.'
        });
      }
    },
    {
      name: 'browserLLM_',
      factory: function() { return this.TransformersLLMService.create(); }
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
        try {
          // emptied first: a provider picked since the last click embeds every flow again
          await this.docDAO.removeAll();
          await this.flowDAO.where(this.IN(this.Flow.KEYWORDS, 'knowledge')).select(this.docDAO);
        } catch ( err ) {
          console.error(err);
          this.statusMsg = this.FAILED;
        }
        this.indexing = false;
      }
    }
  ],

  listeners: [
    {
      name: 'onDocsChange',
      documentation: `Shows how far the background embedding has got, e.g. "Reading the
        documents… 40 / 132", since each flow turns EMBEDDED in docDAO once its chunks are stored.`,
      isMerged: true,
      mergeDelay: 500,
      code: async function() {
        var docs = ( await this.docDAO.select() ).array;
        if ( ! docs.length ) return;
        var S    = this.EmbeddingStatus;
        var done = docs.filter(d => d.embeddingStatus !== S.NEW && d.embeddingStatus !== S.DIRTY).length;
        this.statusMsg = done < docs.length ? this.READING + ' ' + done + ' / ' + docs.length : this.READY;
      }
    }
  ],

  methods: [
    // RAGService, in the browser: it searches this page's own store, and its local model
    // answers in English, so daoKeys and locale are not used
    async function ask(x, question) {
      var qv   = await this.embedder.embed(x, question);
      var sink = await this.store
        .where(this.EQ(this.VectorEmbedding.EMBEDDING_MODEL, qv.embeddingModel))
        .orderBy(this.CosineComparator.create({ queryVector: qv.vector }))
        .limit(this.RETRIEVAL_LIMIT).select();

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

      var response = await this.llmService.chat(x, this.ChatRequest.create({
        messages: [ this.ChatMessage.create({ role: 'USER', content: 'Context:\n' + lines.join('\n\n') + '\n\nQuestion: ' + question }) ],
        options:  this.options
      }));
      return this.RAGAnswer.create({ answered: true, answer: response.content, sources: sources });
    },

    function render() {
      var self = this;
      self.SUPER();
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
