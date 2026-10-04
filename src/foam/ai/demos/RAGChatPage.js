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
    'foam.ai.llm.ConversationalLLMService',
    'foam.ai.llm.provider.TransformersLLMService',
    'foam.ai.llm.RAGChat'
  ],

  imports: [
    'flowDAO',
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
      name: 'embedder',
      factory: function() {
        return this.TransformersEmbeddingService.create();
      }
    },
    {
      name: 'llmService',
      factory: function() {
        return this.ConversationalLLMService.create({
          delegate: this.TransformersLLMService.create()
        });
      }
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
          .tag(self.INDEX)
          .start('span').addClass(self.myClass('status')).add(self.statusMsg$).end()
        .end()

        .start().addClass(self.myClass('chat'))
          .tag(self.RAGChat)
        .end();
    }
  ]
});
