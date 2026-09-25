/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.POM({
  name: 'vector',
  files: [
    { name: 'MarkdownChunkerService', flags: 'js|java' }
  ],
  javaFiles: [
    { name: 'MarkdownChunkParser'         },
    { name: 'MarkdownChunkerServiceImpl' }
  ],
  projects: [
    { name: 'provider/pom' }
  ]
});
