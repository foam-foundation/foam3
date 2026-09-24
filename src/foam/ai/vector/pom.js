/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.POM({
  name: 'vector',
  files: [
    { name: 'VectorEmbedding',  flags: 'js|java' },
    { name: 'CosineComparator', flags: 'js|java' },
    { name: 'VectorStoreDAO',   flags: 'js|java' },
    { name: 'EmbeddingService',              flags: 'js|java' },
    { name: 'ChunkerService',                flags: 'js|java' },
    { name: 'ClientMarkdownChunkerService',  flags: 'js'      }
  ],
  projects: [
    { name: 'provider/pom' }
  ]
});
