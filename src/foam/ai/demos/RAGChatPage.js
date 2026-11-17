/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.ai.demos',
  name: 'RAGChatPage',
  extends: 'foam.u2.Controller',

  documentation: `Demo: index knowledge flows then chat with a local LLM using RAG.
    The page answers the chat itself (it is the chat's ragService), so the
    embedding provider picked here also embeds the question.`,

  implements: [ 'foam.ai.llm.RAGService' ],

  requires: [
    'foam.ai.llm.ChatMessage',
    'foam.ai.llm.ChatRequest',
    'foam.ai.llm.RAGAnswer',
    'foam.ai.llm.RAGSource',
    'foam.ai.vector.CosineComparator',
    'foam.ai.vector.VectorEmbedding',
    'foam.ai.vector.ClientMarkdownChunkerService',
    'foam.ai.vector.provider.TransformersEmbeddingService',
    'foam.ai.llm.ConversationalLLMService',
    'foam.ai.llm.provider.TransformersLLMService',
    'foam.ai.llm.RAGChat'
  ],

  imports: [
    'embeddingService',
    'flowDAO',
    'llmService as serverLLMService',
    'openAIEmbeddingService',
    'vectorStoreDAO'
  ],

  exports: [
    'as ragService'
  ],

  messages: [
    { name: 'NOT_INDEXED', message: 'Nothing is indexed for this provider yet. Click **Index Knowledge Flows** first.' }
  ],

  constants: [
    { name: 'CONTEXT_TOKEN_BUDGET', value: 1200 },
    { name: 'RETRIEVAL_LIMIT',      value: 10   }
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
      name: 'chunker',
      factory: function() {
        return this.ClientMarkdownChunkerService.create();
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
        return this.ConversationalLLMService.create({ delegate: this.browserLLM_ });
      }
    },
    {
      class: 'FObjectProperty',
      of: 'foam.ai.llm.LLMOptions',
      name: 'options',
      factory: function() {
        return foam.ai.llm.LLMOptions.create({
          maxTokens:    512,
          temperature:  0.2,
          systemPrompt: 'Answer using only the provided context. If the answer is not in the context, say "I don\'t know." Be brief and direct.'
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
        var self = this;
        self.indexing  = true;
        self.statusMsg = 'Loading flows…';

        try {
          var sink  = await self.flowDAO.where(self.IN(self.flowDAO.of.KEYWORDS, 'knowledge')).select();
          var flows = sink.array;
          var count = 0;

          for ( var fi = 0; fi < flows.length; fi++ ) {
            var flow = flows[fi];
            var text = self.extractText_(flow);
            if ( ! text ) continue;

            self.statusMsg = 'Indexing ' + (fi + 1) + ' / ' + flows.length + ': ' + flow.name;
            var chunks = await self.chunker.chunk(x, text);

            for ( var ci = 0; ci < chunks.length; ci++ ) {
              var embedding    = await self.embedder.embed(x, chunks[ci]);
              embedding.id       = flow.name + ':' + ci;
              embedding.sourceId = flow.name;
              embedding.kind     = 'flow';
              await self.vectorStoreDAO.put(embedding);
              count++;
            }
          }

          self.statusMsg = 'Ready — ' + count + ' chunks from ' + flows.length + ' flows';
        } catch(err) {
          console.error(err);
          self.statusMsg = 'Error: ' + err.message;
        }

        self.indexing = false;
      }
    }
  ],

  methods: [
    // RAGService, in the browser: the demo's rows carry no daoKey and its local model
    // answers in English, so daoKeys and locale are not used
    async function ask(x, question) {
      var qv   = await this.embedder.embed(x, question);
      var sink = await this.vectorStoreDAO
        .where(this.EQ(this.VectorEmbedding.EMBEDDING_MODEL, qv.embeddingModel))
        .orderBy(this.CosineComparator.create({ queryVector: qv.vector }))
        .limit(this.RETRIEVAL_LIMIT).select();

      var lines = [], sources = [], used = 0;
      for ( var i = 0; i < sink.array.length; i++ ) {
        var c    = sink.array[i];
        var t    = (c.text || '').trim();
        var cost = Math.ceil(t.length / 4);
        if ( ! t || used + cost > this.CONTEXT_TOKEN_BUDGET ) break;
        lines.push('[' + (i + 1) + '] ' + t);
        used += cost;
        if ( ! sources.some(s => s.sourceId === c.sourceId) ) {
          sources.push(this.RAGSource.create({ daoKey: 'flowDAO', sourceId: c.sourceId }));
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

    function extractText_(flow) {
      var parts = [];
      if ( flow.name        ) parts.push('# ' + flow.name);
      if ( flow.description ) parts.push(flow.description);
      if ( flow.notes       ) parts.push(flow.notes);
      if ( flow.keywords && flow.keywords.length ) {
        parts.push('Keywords: ' + flow.keywords.join(', '));
      }
      try {
        var cmds = JSON.parse(flow.script || '[]');
        for ( var cmd of cmds ) {
          if ( cmd && cmd.value && cmd.value.markdown ) parts.push(cmd.value.markdown);
        }
      } catch(e) {}
      return parts.join('\n\n');
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
          .tag(self.RAGChat, { title: 'RAG Chat', thinkingMsg$: self.modelStatus$ })
        .end();
    }
  ]
});
