/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

/**
 * A small 5-property model (2 String, 1 Date, 1 Long, plus seq) used as the
 * "small model" shape in the journal-entry parse-cost shape matrix, and as
 * the nested type for ReplayNestedModel's FObjectProperty fields.
 */
foam.CLASS({
  package: 'foam.dao.test',
  name: 'ReplaySmallModel',

  ids: ['seq'],

  properties: [
    { class: 'Long',   name: 'seq' },
    { class: 'String', name: 'name' },
    { class: 'String', name: 'code' },
    { class: 'Date',   name: 'createdDate' },
    { class: 'Long',   name: 'count' }
  ]
});
