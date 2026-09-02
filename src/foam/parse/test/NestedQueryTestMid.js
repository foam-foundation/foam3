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
    // scalar sibling of the 'leaf' folder — so suggestions must surface the folder
    // alongside a competing scalar at the same depth (mirrors a range with both).
    { class: 'String', name: 'tag' },
    {
      class: 'FObjectProperty',
      of: 'foam.parse.test.NestedQueryTestLeaf',
      name: 'leaf'
    }
  ]
});
