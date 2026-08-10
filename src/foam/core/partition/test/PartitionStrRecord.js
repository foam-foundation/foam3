/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.partition.test',
  name: 'PartitionStrRecord',
  documentation: 'Composite-string-id test model: id is <partition>-<seqNo>. Partitioned by `bucket` (single-level tests) or by `region` then `bucket` (multi-level tests).',
  properties: [
    { class: 'String', name: 'id' },
    { class: 'Int',    name: 'region' },
    { class: 'Int',    name: 'bucket' },
    { class: 'String', name: 'data' }
  ]
});
