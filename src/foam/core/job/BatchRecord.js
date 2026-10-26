/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.job',
  name: 'BatchRecord',

  documentation: `Checkpoint record for a BatchJob item.
    Composite key (runKey, itemId) — presence in batchRecordDAO means the item completed.
    Query by runKey to inspect or clear a specific run.`,

  ids: [ 'runKey', 'itemId' ],

  tableColumns: [ 'runKey', 'batchNumber', 'itemId' ],

  searchColumns: [ 'runKey' ],

  properties: [
    {
      class: 'String',
      name: 'runKey'
    },
    {
      class: 'String',
      name: 'itemId'
    },
    {
      class: 'Int',
      name: 'batchNumber',
      documentation: '1-based position of this item in the run.',
      value: 0
    }
  ]
});
