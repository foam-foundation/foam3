/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.INTERFACE({
  package: 'foam.parse',
  name: 'JSPStream',

  documentation: "PStream Interface that is specific to JavaScript code.",

  properties: [
    {
      name: 'head',
      class: 'String',
      documentation: 'The current position in the stream.'
    },
    {
      name: 'tail',
      class: 'FObjectProperty',
      of: 'foam.parse.JSPStream',
      documentation: 'The rest of the stream after the head.'
    },
    {
      name: 'valid',
      class: 'Boolean',
      documentation: 'True if the stream has not reached the end.'
    },
    {
      name: 'value',
      // any object
      documentation: 'The value associated with the current head.'
    }
  ],

  methods: [
    {
      name: 'setValue',
      type: 'foam.parse.JSPStream',
      documentation: 'Sets the value associated with the current head.',
      args: [
        {
          name: 'value',
          type: 'Any'
        }
      ]
    },
    {
      name: 'substring',
      type: 'String',
      documentation: 'Returns the substring from the current head to the end argument.',
      args: [
        {
          name: 'end',
          type: 'foam.parse.JSPStream'
        }
      ]
    },
    {
      name: 'apply', // feed the parser the stream
      type: 'foam.parse.JSPStream',
      documentation: 'Applies the given parser to this stream.',
      args: [
        {
          name: 'p',
          type: 'foam.parse.JSParser'
        },
        {
          name: 'grammar',
          type :'foam.parse.Grammar'
        }
      ]
    }
  ]
});
