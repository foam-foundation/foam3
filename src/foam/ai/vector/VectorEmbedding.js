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
      name: 'text'        // original chunk
    },
    {
      class: 'String',
      name: 'sourceId'   // classId, doc path, etc.
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
      name: 'vector',
      networkTransient: true  // large; server-only, never sent to client
    }
  ],

  methods: [
    function toSummary() {
      return `${this.kind}:${this.sourceId}`;
    }
  ]
});
