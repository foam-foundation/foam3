/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.INTERFACE({
  package: 'foam.ai.vector',
  name: 'ChunkerService',

  skeleton: true,
  client:   true,

  methods: [
    {
      name:  'chunk',
      async: true,
      type:  'StringArray',
      args:  'Context x, String source'
    }
  ]
});
