/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.test',
  name: 'NestedQueryTestLeaf',

  documentation: 'Test-only leaf model for AQL nested FObjectProperty tests.',

  properties: [
    { class: 'String', name: 'value' },
    { class: 'Int', name: 'code' }
  ]
});
