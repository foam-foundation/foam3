/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.index',
  name: 'IndexKeyRecord',

  documentation: `Test record for MDAOIndexKeyTest. Carries one property per
    index-key shape that behaves differently: a primitive-backed Long, a
    reference-backed String, a nullable Date, an Enum, and a self-reference so a
    Dot indexer over an unset intermediate can be exercised.`,

  properties: [
    { class: 'Long', name: 'id' },
    { class: 'Long', name: 'groupId' },
    { class: 'String', name: 'name' },
    { class: 'Date', name: 'when' },
    { class: 'Enum', of: 'foam.dao.index.AndOrderStatus', name: 'status' },
    { class: 'FObjectProperty', of: 'foam.dao.index.IndexKeyRecord', name: 'ref' }
  ]
});
