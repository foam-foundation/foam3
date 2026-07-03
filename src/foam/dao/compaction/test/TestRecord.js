/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.compaction.test',
  name: 'TestRecord',

  documentation: 'Simple model for compaction tests. Uses only basic property types to avoid non-deterministic javaFactory issues (e.g. User.passwordHistory).',

  properties: [
    { class: 'Long', name: 'id' },
    { class: 'String', name: 'name' },
    { class: 'String', name: 'value' }
  ]
});
