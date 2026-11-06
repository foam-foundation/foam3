/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao',
  name: 'StopListeningCmd',

  documentation: `
    "Stop listening": the client sends it when it stops a listen.
    The server stops the listener with this name, on the same connection only.
  `,

  properties: [
    {
      class: 'String',
      name: 'name',
      documentation: 'The listener\'s name: the SubBox name its sink was sent under.'
    }
  ]
});
