/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.partition.test',
  name: 'RefSourceRecord',

  documentation: 'Fixture: a model holding a Reference to PartitionStrRecord, for ReferenceMigrator tests.',

  properties: [
    { class: 'Long', name: 'id' },
    {
      class: 'Reference',
      of: 'foam.core.partition.test.PartitionStrRecord',
      targetDAOKey: 'partitionRefTargetDAO',
      name: 'targetRef'
    }
  ]
});
