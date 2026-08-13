/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.partition.test',
  name: 'UnloadableDecoratedRecord',
  documentation: 'Long-id test model for UnloadableDecoratedDAOTest. A Long id (rather than PartitionStrRecord\'s String id) is required so SequenceNumberDAO can stamp it.',
  properties: [
    { class: 'Long',   name: 'id' },
    { class: 'String', name: 'data' }
  ]
});
