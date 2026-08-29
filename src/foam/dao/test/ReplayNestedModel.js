/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

/**
 * A model with 3 String properties and 2 nested FObjectProperty fields of
 * ReplaySmallModel (plus seq), used as the "nested-object" shape in the
 * journal-entry parse-cost shape matrix.
 */
foam.CLASS({
  package: 'foam.dao.test',
  name: 'ReplayNestedModel',

  ids: ['seq'],

  properties: [
    { class: 'Long',   name: 'seq' },
    { class: 'String', name: 'str0' },
    { class: 'String', name: 'str1' },
    { class: 'String', name: 'str2' },
    {
      class: 'FObjectProperty',
      of: 'foam.dao.test.ReplaySmallModel',
      name: 'child1'
    },
    {
      class: 'FObjectProperty',
      of: 'foam.dao.test.ReplaySmallModel',
      name: 'child2'
    }
  ]
});
