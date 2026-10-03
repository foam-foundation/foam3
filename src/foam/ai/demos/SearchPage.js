/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.ai.demos',
  name: 'SearchPage',
  extends: 'foam.u2.Controller',

  requires: [
    'foam.ai.vector.ClientMarkdownChunkerService',
    'foam.ai.vector.CosineComparator',
    'foam.ai.vector.VectorEmbedding',
    'foam.ai.vector.provider.TransformersEmbeddingService',
    'foam.dao.ArraySink'
  ],

  imports: [
    'flowDAO',
    'vectorStoreDAO'
  ],

  css: `
    ^ {
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
    ^toolbar {
      align-items: center;
      display: flex;
      gap: 12px;
    }
    ^status {
      color: #666;
      font-style: italic;
    }
    ^search-row {
      display: flex;
      gap: 8px;
    }
    ^results table {
      border-collapse: collapse;
      min-width: 700px;
    }
    ^results th, ^results td {
      border-bottom: 1px solid #ddd;
      padding: 6px 10px;
      text-align: left;
      vertical-align: top;
    }
    ^results th {
      background: #f5f5f5;
      font-weight: 600;
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
      class: 'Boolean',
      name: 'indexing'
    },
    {
      class: 'String',
      name: 'statusMsg'
    },
    {
      class: 'String',
      name: 'prompt',
      view: {
        class: 'foam.u2.TextField',
        onKey: false,
        placeholder: 'Ask a question…',
        size: 60
      }
    },
    {
      name: 'results',
      factory: function() { return []; }
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
        self.results   = [];

        try {
          var sink  = await self.flowDAO.where(self.IN(self.flowDAO.of.KEYWORDS, 'knowledge')).select();
          var flows = sink.array;
          var count = 0;

          for ( var fi = 0; fi < flows.length; fi++ ) {
            var flow   = flows[fi];
            var text   = self.extractText_(flow);
            if ( ! text ) continue;

            self.statusMsg = 'Indexing ' + (fi + 1) + ' / ' + flows.length + ': ' + flow.name;
            var chunks = await self.chunker.chunk(x, text);

            for ( var ci = 0; ci < chunks.length; ci++ ) {
              var embedding = await self.embedder.embed(x, chunks[ci]);
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
    },
    {
      name: 'search',
      label: 'Search',
      isEnabled: function(indexing) { return ! indexing; },
      code: async function(x) {
        var self = this;
        var q    = self.prompt.trim();
        if ( ! q ) { self.results = []; return; }

        self.statusMsg = 'Embedding query…';
        var qv   = await self.embedder.embed(x, q);
        var cc   = self.CosineComparator.create({ queryVector: qv.vector });
        var sink = await self.vectorStoreDAO
          .where(self.EQ(self.VectorEmbedding.EMBEDDING_MODEL, qv.embeddingModel))
          .orderBy(cc).limit(10).select(self.ArraySink.create());
        self.results = sink.array;
        self.statusMsg = 'Showing top ' + self.results.length + ' results';
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
        .start('h2').add('Similarity Search').end()

        .start().addClass(self.myClass('toolbar'))
          .tag(self.INDEX)
          .start('span').addClass(self.myClass('status')).add(self.statusMsg$).end()
        .end()

        .start().addClass(self.myClass('search-row'))
          .tag(self.PROMPT)
          .tag(self.SEARCH)
        .end()

        .start().addClass(self.myClass('results'))
          .add(self.dynamic(function(results) {
            if ( ! results.length ) return;
            var table = this.start('table');
            table.start('tr')
              .start('th').add('Score').end()
              .start('th').add('Flow').end()
              .start('th').add('Chunk').end()
            .end();
            for ( var i = 0; i < results.length; i++ ) {
              var r       = results[i];
              var preview = r.text ? r.text.slice(0, 200) + (r.text.length > 200 ? '…' : '') : '';
              table.start('tr')
                .start('td').add((r.score * 100).toFixed(1) + '%').end()
                .start('td').add(r.sourceId).end()
                .start('td').add(preview).end()
              .end();
            }
          }))
        .end();
    }
  ]
});
