/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.INTERFACE({
  package: 'foam.ai.vector',
  name: 'EmbeddingAware',

  documentation: `
    A record that is searched by meaning. A model opts in by implementing this
    interface and writing toIndexText; nothing else. EasyDAO then adds
    EmbeddingAwareDAO to its DAO, which embeds each saved record into
    vectorStoreDAO in the background.
    E.g. a Note with a title and a body returns "# " + title + "\\n\\n" + body,
    and an edit of its body is searchable a moment after the save.
  `,

  methods: [
    {
      name: 'toIndexText',
      documentation: 'The text to embed, as plain markdown: what a reader of the record sees, without its code.',
      type: 'String',
      args: 'Context x'
    },
    {
      name: 'isEmbeddable',
      documentation: `
        Whether this record should be searchable at all, e.g. only the notes
        that are not drafts. A record that turns false loses its chunks.
        A browser model that leaves it out counts as true: an interface gives
        Java a default method but gives JavaScript none.
      `,
      type: 'Boolean',
      args: 'Context x',
      javaCode: 'return true;'
    }
  ]
});
