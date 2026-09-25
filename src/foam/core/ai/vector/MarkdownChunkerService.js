/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.ENUM({
  package: 'foam.core.ai.vector',
  name: 'SourceType',
  values: [
    { name: 'TEXT', label: 'Raw text'  },
    { name: 'FILE', label: 'File path' }
  ]
});


foam.CLASS({
  package: 'foam.core.ai.vector',
  name: 'MarkdownChunkerService',
  abstract: true,
  implements: ['foam.ai.vector.ChunkerService'],

  properties: [
    {
      class: 'Int',
      name: 'maxChunkChars',
      value: 2000
    },
    {
      class: 'Enum',
      of: 'foam.core.ai.vector.SourceType',
      name: 'sourceType',
      value: 'TEXT'
    }
  ]
});
