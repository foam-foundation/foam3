/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.index',
  name: 'AndOrderRecord',

  documentation: 'Test record for the MDAO index tests in this package.',

  properties: [
    { class: 'Long', name: 'id' },
    { class: 'Long', name: 'caseId' },
    { class: 'Enum', of: 'foam.dao.index.AndOrderStatus', name: 'status' },
    { class: 'String', name: 'cb' }
  ]
});
