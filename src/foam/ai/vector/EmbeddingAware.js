/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.ENUM({
  package: 'foam.ai.vector',
  name: 'EmbeddingStatus',

  documentation: `
    Whether the chunks in vectorStoreDAO still match an EmbeddingAware
    record. EmbeddingAwareDAO sets it on each save, with no AI call, and
    EmbeddingSync embeds the records it marks, e.g. a note whose body was
    edited is DIRTY until the next sync embeds its new text.
  `,

  values: [
    { name: 'NEW',       label: 'New',       documentation: 'Never embedded since it was created or the server started.' },
    { name: 'EMBEDDED',  label: 'Embedded',  documentation: 'Its chunks hold its current text.' },
    { name: 'DIRTY',     label: 'Dirty',     documentation: 'Its text changed since its chunks were made.' },
    { name: 'DISCARDED', label: 'Discarded', documentation: 'It does not want to be searched, so it has no chunks.' }
  ]
});


foam.INTERFACE({
  package: 'foam.ai.vector',
  name: 'EmbeddingAware',

  documentation: `
    A record that Ask AI can search. A model opts in by implementing this
    interface and writing toIndexText; nothing else. EasyDAO then adds
    EmbeddingAwareDAO to its DAO, which marks each saved record NEW or
    DIRTY, and EmbeddingSync embeds the marked records in the background.
    E.g. a Note with a title and a body returns "# " + title + "\\n\\n" + body,
    and an edit of its body is searchable after the next sync.
  `,

  properties: [
    {
      class: 'Enum',
      of: 'foam.ai.vector.EmbeddingStatus',
      name: 'embeddingStatus',
      documentation: `
        Kept in memory only, so marking a record embedded writes no journal
        line and no history. After a restart every record is NEW again, and
        the first sync finds its chunks unchanged and makes no AI call.
      `,
      storageTransient: true,
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO',
      readVisibility: 'RO'
    }
  ],

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
        Whether this record should be searchable at all, e.g. only the flows
        tagged as documentation. A record that turns false loses its chunks.
        A browser model that leaves it out counts as true: an interface gives
        Java a default method but gives JavaScript none.
      `,
      type: 'Boolean',
      args: 'Context x',
      javaCode: 'return true;'
    },
    {
      name: 'openIndexed',
      documentation: 'Opens the record for a user who followed a source link of an answer.',
      args: 'Context x',
      flags: ['web']
    }
  ]
});
