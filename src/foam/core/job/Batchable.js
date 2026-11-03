/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.INTERFACE({
  package: 'foam.core.job',
  name: 'Batchable',

  documentation: `
    Implemented by objects that can be driven by BatchDecorator.
    collectBatches() returns the ordered work list; processBatch() handles one item.
    The implementor owns the domain logic; BatchDecorator owns the job lifecycle
    and checkpointing.
  `,

  methods: [
    {
      name: 'collectBatches',
      type: 'List',
      args: 'Context x',
      documentation: 'Return the ordered list of item ids to process.'
    },
    {
      name: 'processBatch',
      args: 'Context x, String item',
      documentation: 'Process one item. Called only when the item has no checkpoint record.'
    }
  ]
});
