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
    stamps id as <flowName>~<seqNo>. An empty updates array marks the create.`,

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
  ]
});
