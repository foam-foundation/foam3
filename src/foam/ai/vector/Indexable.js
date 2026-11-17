/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.INTERFACE({
  package: 'foam.ai.vector',
  name: 'Indexable',

  documentation: `
    A record that Ask AI can search: RAGIndexer embeds the text it gives, and
    an answer that used it links back to it. A Flow gives its name,
    description and markdown, and opens as the Knowledge Base opens it.
  `,

  methods: [
    {
      name: 'toIndexText',
      documentation: 'The text to embed, as plain markdown: what a reader of the record sees, without its code.',
      type: 'String',
      args: 'Context x',
      flags: ['java']
    },
    {
      name: 'openIndexed',
      documentation: 'Opens the record for a user who followed a source link of an answer.',
      args: 'Context x',
      flags: ['web']
    }
  ]
});
