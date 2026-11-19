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
      // ClientEmbeddingService, the browser's stub of a server provider, answers every call with
      // a promise, and foam.lang.Stub asserts that each method it stubs is async or void
      async: true,
      type: 'String',
      documentation: `The model the vectors come from, e.g. "nomic-embed-text", as set on each
        VectorEmbedding's embeddingModel. A record whose stored chunks come from another model is
        embedded again.`
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
