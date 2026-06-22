/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.test',
  name: 'NestedQueryTestMid',

  documentation: 'Test-only mid model for AQL nested FObjectProperty tests.',

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.parse.test.NestedQueryTestLeaf',
      name: 'leaf'
    }
  ]
});
