/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'FlowHistoryRecord',

  documentation: `One saved edit of a Flow. Lives in flowHistoryDAO, a
    PartitionedDAO partitioned on objectId (the flow name), so opening one
    flow's history replays only that flow's journal. The partition layer
    stamps id as <flowName>~<seqNo>. An empty updates array marks the create.

    Readable by whoever can read the flow it belongs to; never writable from a
    client, the flowDAO rule writes it through localFlowHistoryDAO.`,

  implements: [ 'foam.core.auth.Authorizable' ],

  javaImports: [
    'foam.core.auth.AuthorizationException',
    'foam.dao.DAO'
  ],

  properties: [
    {
      class: 'String',
      name: 'id'
    },
    {
      class: 'String',
      name: 'objectId',
      documentation: 'Name of the edited flow; the partition key.'
    },
    {
      class: 'DateTime',
      name: 'timestamp'
    },
    {
      class: 'String',
      name: 'user',
      documentation: 'Summary of the user who saved the flow.'
    },
    {
      class: 'FObjectArray',
      of: 'foam.dao.history.PropertyUpdate',
      name: 'updates',
      documentation: 'Storage properties that changed, with old and new values.'
    }
  ],

  methods: [
    {
      name: 'authorizeOnRead',
      javaCode: `
        DAO flowDAO = (DAO) x.get("flowDAO");
        if ( flowDAO == null || flowDAO.inX(x).find(getObjectId()) == null ) {
          throw new AuthorizationException("No access to flow " + getObjectId());
        }
      `
    },
    {
      name: 'authorizeOnCreate',
      javaCode: `throw new AuthorizationException("Flow history is written by the flowDAO rule only.");`
    },
    {
      name: 'authorizeOnUpdate',
      javaCode: `throw new AuthorizationException("Flow history is read-only.");`
    },
    {
      name: 'authorizeOnDelete',
      javaCode: `throw new AuthorizationException("Flow history is read-only.");`
    }
  ]
});
