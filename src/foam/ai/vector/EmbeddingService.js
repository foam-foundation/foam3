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
        VectorEmbedding's embeddingModel. A vector is only compared with vectors of the same model.`
    },
    {
      name:  'embed',
      async: true,
      documentation: `Embeds one text that searches, e.g. a question, to compare with documents
        embedded by embedAll. A provider whose model wants an instruction before a question,
        e.g. "Represent this sentence for searching relevant passages: ", adds it here only.`,
      type:  'foam.ai.vector.VectorEmbedding',
      args:  'Context x, String text'
    },
    {
      name:     'embedAll',
      async:    true,
      documentation: 'Embeds the texts to be searched, e.g. the chunks of a document being indexed, in as few calls as the provider allows.',
      type:     'FObjectArray',
      javaType: 'foam.ai.vector.VectorEmbedding[]',
      args:     'Context x, StringArray texts'
    }
  ]
});
