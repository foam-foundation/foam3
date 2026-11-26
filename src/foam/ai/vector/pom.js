/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.POM({
  name: 'vector',
  files: [
    { name: 'Float32Quantizer', flags: 'js|java' },
    { name: 'Fp16Quantizer',    flags: 'js|java' },
    { name: 'Int8Quantizer',    flags: 'js|java' },
    { name: 'Quantizer',        flags: 'js|java' },
    { name: 'Quantizers',       flags: 'js|java' },
    { name: 'VectorEmbedding',  flags: 'js|java' },
    { name: 'CosineComparator', flags: 'js|java' },
    { name: 'VectorStoreDAO',   flags: 'js|java' },
    { name: 'EmbeddingService',              flags: 'js|java' },
    { name: 'ChunkerService',                flags: 'js|java' },
    { name: 'MarkdownChunkParser',            flags: 'js'      },
    { name: 'ClientMarkdownChunkerService',  flags: 'js'      }
  ],
  javaFiles: [
    { name: 'VectorIndex' }
  ],
  projects: [
    { name: 'provider/pom' },
    { name: 'test/pom',     flags: 'test' }
  ]
});
