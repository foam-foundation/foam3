/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.ai.demos',
  name: 'RAGChatPage',
  extends: 'foam.u2.Controller',

  documentation: 'Demo: index knowledge flows then chat with a local LLM using RAG.',

  requires: [
    'foam.ai.vector.ClientMarkdownChunkerService',
    'foam.ai.vector.provider.TransformersEmbeddingService',
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
    'embedder',
    'llmService'
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
        return this.browserEmbedder_;
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
      name: 'browserEmbedder_',
      factory: function() { return this.TransformersEmbeddingService.create(); }
    },
    { name: 'chat_', hidden: true, transient: true },
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

            // the chunks are documents: embedAll, since embed is for a search question
            var embeddings = await self.embedder.embedAll(x, chunks);
            for ( var ci = 0; ci < embeddings.length; ci++ ) {
              var embedding    = embeddings[ci];
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

  listeners: [
    {
      name: 'tuneChat_',
      documentation: `5 passages and a short answer keep the small browser model on the context.
        Any other provider gets RAGChat's own defaults back.`,
      code: function() {
        var chat = this.chat_;
        if ( ! chat ) return;
        if ( this.provider === 'transformers' ) {
          chat.retrievalLimit = 5;
          chat.options = foam.ai.llm.LLMOptions.create({
            maxTokens:    256,
            systemPrompt: 'Answer the question using only the numbered context passages. Answer in two to four plain sentences, with no headings, lists or conclusion. Use the names exactly as the context spells them. If the context does not hold the answer, reply only: I don\'t know.'
          });
        } else {
          chat.clearProperty('retrievalLimit');
          chat.clearProperty('options');
        }
      }
    }
  ],

  methods: [
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
      self.onDetach(self.provider$.sub(self.tuneChat_));
      // the workers hold the models in memory: end them with the page
      self.onDetach(() => {
        self.browserEmbedder_.terminate();
        self.browserLLM_.terminate();
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
          .tag(self.RAGChat, { thinkingMsg$: self.modelStatus$, partial$: self.browserLLM_.text$ }, self.chat_$)
        .end();
      self.tuneChat_();
    }
  ]
});
