/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.partition',
  name: 'AllPartitions',
  extends: 'foam.mlang.predicate.Unary',

  implements: [ 'foam.lang.Serializable' ],

  documentation: `Routing directive rather than a filter: tells a PartitionedDAO
    partitioned on arg1 to select from every partition it has on disk, instead
    of the single one an EQ on that property would route to.

    Only the level partitioned on arg1 expands. Other levels of a chained
    PartitionedDAO keep resolving from the rest of the predicate, so
    AND(AllPartitions(PROGRAM_ID), GTE(DATE, from), LT(DATE, to)) visits every
    program but only the date partitions in that range.

    Extends Unary, not Binary, deliberately: DatePartitionedDAO's range
    extraction and TreeIndex both dispatch on 'instanceof Binary', so a Unary
    term passes through them untouched and needs no special case in either.

    f() returns true because the predicate is handed to the sub-selects
    unchanged and so always reaches a leaf DAO. Returning true makes it a no-op
    filter there. An EQ against a marker value would instead compare the
    record's real property to the marker and reject every record.`,

  methods: [
    {
      name: 'f',
      code: function() { return true; },
      javaCode: 'return true;'
    },
    {
      name: 'partialEval',
      documentation: `Never fold this away -- it carries routing information,
        not a testable condition.`,
      code: function() { return this; },
      javaCode: 'return this;'
    },
    {
      name: 'toIndex',
      flags: [ 'js' ],
      documentation: `Unary.toIndex forwards to arg1, which would offer this up
        as an indexable condition. It is not one.`,
      code: function() { }
    }
  ]
});
