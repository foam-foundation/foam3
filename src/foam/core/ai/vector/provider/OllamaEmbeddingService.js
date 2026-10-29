/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ai.vector.provider',
  name: 'OllamaEmbeddingService',
  abstract: true,
  implements: ['foam.ai.vector.EmbeddingService'],

  properties: [
    {
      class: 'String',
      name: 'endpoint',
      value: 'http://localhost:11434/api/embed'
    },
    {
      class: 'String',
      name: 'model',
      value: 'qwen3-embedding'
    }
  ]
});
