/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.INTERFACE({
  package: 'foam.ai.vector',
  name: 'EmbeddingService',

  skeleton: true,
  client:   true,

  methods: [
    {
      name: 'getModel',
      type: 'String',
      documentation: `The model the vectors come from, e.g. "nomic-embed-text", as set on each
        VectorEmbedding's embeddingModel. A vector is only compared with vectors of the same model.`
    },
    {
      name:  'embed',
      async: true,
      type:  'foam.ai.vector.VectorEmbedding',
      args:  'Context x, String text'
    },
    {
      name:     'embedAll',
      async:    true,
      type:     'FObjectArray',
      javaType: 'foam.ai.vector.VectorEmbedding[]',
      args:     'Context x, StringArray texts'
    }
  ]
});
