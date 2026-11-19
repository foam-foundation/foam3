/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ai.vector.test',
  name: 'RAGNote',
  implements: [ 'foam.ai.vector.EmbeddingAware' ],

  documentation: `
    A note for RAGTest: its title and body are what is embedded, a draft is
    not embedded, and pinned is a property no embedding depends on.
  `,

  properties: [
    { class: 'String',  name: 'id' },
    { class: 'String',  name: 'title' },
    { class: 'String',  name: 'body' },
    { class: 'Boolean', name: 'draft' },
    { class: 'Boolean', name: 'pinned' }
  ],

  javaCode: `
    /** The id of a record whose toIndexText throws, to test a record that cannot be read; null for none. */
    public static volatile String explodeOn;
  `,

  methods: [
    {
      name: 'toIndexText',
      code: function(x) { return '# ' + this.title + '\n\n' + this.body; },
      javaCode: `
        if ( getId().equals(explodeOn) ) throw new RuntimeException("cannot build the text of " + getId());
        return "# " + getTitle() + "\\n\\n" + getBody();
      `
    },
    {
      name: 'isEmbeddable',
      code: function(x) { return ! this.draft; },
      javaCode: 'return ! getDraft();'
    }
  ]
});
