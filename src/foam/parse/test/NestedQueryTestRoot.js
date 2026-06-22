/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.test',
  name: 'NestedQueryTestRoot',

  documentation: 'Test-only root model for AQL nested FObjectProperty tests.',

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.parse.test.NestedQueryTestMid',
      name: 'mid'
    },
    { class: 'String', name: 'name' }
  ]
});
