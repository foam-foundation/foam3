/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.partition.test',
  name: 'PartitionTestRecord',

  documentation: 'Minimal model for testing SingleToPartitionMigrator. Partitions on `bucket`.',

  properties: [
    { class: 'Long',   name: 'id' },
    { class: 'Int',    name: 'bucket' },
    { class: 'String', name: 'data' }
  ]
});
