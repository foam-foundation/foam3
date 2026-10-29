
/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.ai.vector',
  name: 'VectorEmbedding',

  properties: [
    {
      class: 'String',
      name: 'id'
    },
    {
      class: 'String',
      name: 'text'        // original chunk; omit for DAO-record embeddings
    },
    {
      documentation: `DAO key of the source record (e.g. "alpacaSampleDAO").
        Empty for text-chunk embeddings. When set, sourceId is the primary
        key of the record in that DAO.`,
      class: 'String',
      name: 'daoKey'
    },
    {
      class: 'String',
      name: 'sourceId'   // classId, doc path, flow name, or DAO record primary key
    },
    {
      class: 'String',
      name: 'kind'       // 'class' | 'property' | 'method'
    },
    {
      class: 'String',
      name: 'embeddingModel'  // e.g. 'nomic-embed-text'
    },
    {
      class: 'foam.lang.FloatArray',
      name: 'vector'
    },
    {
      // Populated by VectorStoreDAO.select_ at query time; not stored in the journal.
      class: 'Float',
      name: 'score',
      storageTransient: true
    }
  ],

  methods: [
    function toSummary() {
      return this.daoKey ? `${this.daoKey}:${this.sourceId}` : `${this.kind}:${this.sourceId}`;
    }
  ]
});
