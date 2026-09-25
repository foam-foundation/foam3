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
