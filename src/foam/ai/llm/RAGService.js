/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.ai.llm',
  name: 'RAGSource',
  documentation: 'A record an answer was built from: its DAO and its id, e.g. flowDAO and "Treasury Control Guide".',

  properties: [
    { class: 'String', name: 'daoKey'   },
    { class: 'String', name: 'sourceId' }
  ]
});


foam.CLASS({
  package: 'foam.ai.llm',
  name: 'RAGAnswer',

  properties: [
    {
      class: 'String',
      name: 'answer'
    },
    {
      class: 'Boolean',
      name: 'answered',
      documentation: `False when the records the user can read hold no answer:
        the screen then says so in the user's language, answer is empty, and sources
        are the closest records found, up to 3, or none.`
    },
    {
      class: 'FObjectArray',
      of: 'foam.ai.llm.RAGSource',
      name: 'sources',
      documentation: 'The records the answer names, or every record it was given when it names none; with no answer, the closest ones.'
    }
  ]
});


foam.INTERFACE({
  package: 'foam.ai.llm',
  name: 'RAGService',

  documentation: `
    Answers a question from the indexed records of some DAOs, e.g. the
    Knowledge Base docs of flowDAO. Only records the caller can read are
    searched, and the answer lists the ones it used. The browser gets this
    service only: the prompt, the search and the model call stay on the server.
  `,

  skeleton: true,
  client:   true,

  methods: [
    {
      name:  'ask',
      async: true,
      type:  'foam.ai.llm.RAGAnswer',
      args:  'Context x, String question, StringArray daoKeys, String locale',
      documentation: 'locale is the language of the user\'s screens, e.g. fr: the answer is written in it.'
    }
  ]
});
