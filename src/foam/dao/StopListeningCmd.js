/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao',
  name: 'StopListeningCmd',

  documentation: `Sent by a client DAO (dao.cmd) when the sub of a remote listen is detached.
    The server's SessionDAOSkeleton stops the listener the client exported under that name on
    the same connection (RemoteListeners). A name of another connection is never found.`,

  properties: [
    {
      class: 'String',
      name: 'name',
      documentation: 'The name the listen\'s sink was exported under (its SubBox name).'
    }
  ]
});
