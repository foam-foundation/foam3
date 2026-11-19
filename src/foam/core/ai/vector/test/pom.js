/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.POM({
  name: 'test',
  files: [
    { name: 'VectorStoreDAOTest',         flags: 'js&test|java&test' },
    { name: 'VectorStoreMemoryBenchmark', flags: 'js&test|java&test' },
    { name: 'VectorStoreSearchBenchmark', flags: 'js&test|java&test' }
  ]
});
