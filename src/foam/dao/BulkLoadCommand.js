/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao',
  name: 'BulkLoadCommand',

  documentation: `Store every row of a load at once, rather than one put per row.

    Sent down cmd_ so each decorator does its own per-row work on the batch -
    SequenceNumberDAO numbers it, the MDAO at the bottom builds its indexes from
    the finished set - which a caller reaching past the chain would skip.

    Only for a store that is still empty and that nobody else can reach yet: the
    index is built from scratch, and the rows are frozen rather than copied. The
    MDAO answers false when it already holds rows, so a caller that cannot know
    can fall back to putting them.`,

  properties: [
    {
      class: 'FObjectArray',
      of: 'foam.lang.FObject',
      name: 'rows'
    }
  ]
});
