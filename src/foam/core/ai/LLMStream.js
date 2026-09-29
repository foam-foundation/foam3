/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ai',
  name: 'LLMStream',

  documentation: `
    The reply of one streamed LLMService call so far, keyed by
    LLMOptions.streamId. LLMStreamWriter writes it as text arrives; the
    caller reads it by id to show the reply being written. Held in memory
    and removed shortly after the call ends. Only the user who made the call
    reads it; only the server writes it.
  `,

  implements: [
    'foam.core.auth.Authorizable'
  ],

  javaImports: [
    'foam.core.auth.AuthService',
    'foam.core.auth.AuthorizationException',
    'foam.core.auth.Subject',
    'foam.core.auth.User'
  ],

  constants: [
    { name: 'WRITE_PERMISSION', type: 'String', value: 'llmstream.write' }
  ],

  properties: [
    { class: 'String', name: 'id' },
    { class: 'Long',   name: 'owner', documentation: 'Id of the user who made the call.' },
    { class: 'String', name: 'phase', documentation: 'thinking until the first text arrives, then writing, then done.' },
    { class: 'String', name: 'text' },
    { class: 'String', name: 'error' }
  ],

  methods: [
    {
      name: 'checkWriter',
      args: 'Context x',
      javaCode: `
        if ( ! ((AuthService) x.get("auth")).check(x, WRITE_PERMISSION) ) {
          throw new AuthorizationException("Only the server writes LLM streams.");
        }
      `
    },
    {
      name: 'authorizeOnCreate',
      javaCode: 'checkWriter(x);'
    },
    {
      name: 'authorizeOnUpdate',
      javaCode: 'checkWriter(x);'
    },
    {
      name: 'authorizeOnDelete',
      javaCode: 'checkWriter(x);'
    },
    {
      name: 'authorizeOnRead',
      javaCode: `
        Subject subject = (Subject) x.get("subject");
        User    user    = subject == null ? null : subject.getUser();
        if ( user == null || user.getId() != getOwner() ) {
          throw new AuthorizationException("This stream belongs to another user.");
        }
      `
    }
  ]
});
