/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.partition',
  name: 'PartitionIndexEntry',

  documentation: `One row of a PartitionIndexDAO index: an indexed value and
    one leaf partition holding rows with that value. One entry per distinct
    (value, leaf) pair, never per row. The id is
    "<bucket>~<value>|<leafPath>" so the index's own PartitionedDAO routes it
    by the bucket segment.`,

  properties: [
    {
      class: 'String',
      name: 'id'
    },
    {
      class: 'Int',
      name: 'bucket',
      shortName: 'b',
      documentation: 'floorMod(value.hashCode(), buckets); the partition of the index itself.'
    },
    {
      class: 'String',
      name: 'value',
      shortName: 'v',
      documentation: 'String form of the indexed value.'
    },
    {
      class: 'FObjectProperty',
      name: 'key',
      shortName: 'k',
      documentation: `A blank row of the indexed model carrying only its
        partition-key properties (PartitionedDAO.partitionKey), from which the
        routing predicate is rebuilt at query time.`
    }
  ]
});
