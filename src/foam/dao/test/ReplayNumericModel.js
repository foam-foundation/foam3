/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

/**
 * A model with 20 numeric properties (10 Long, 10 Double, plus seq), used as
 * the "numeric-heavy" shape in the journal-entry parse-cost shape matrix.
 */
foam.CLASS({
  package: 'foam.dao.test',
  name: 'ReplayNumericModel',

  ids: ['seq'],

  properties: [
    { class: 'Long',   name: 'seq' },
    { class: 'Long',   name: 'long0' },
    { class: 'Long',   name: 'long1' },
    { class: 'Long',   name: 'long2' },
    { class: 'Long',   name: 'long3' },
    { class: 'Long',   name: 'long4' },
    { class: 'Long',   name: 'long5' },
    { class: 'Long',   name: 'long6' },
    { class: 'Long',   name: 'long7' },
    { class: 'Long',   name: 'long8' },
    { class: 'Long',   name: 'long9' },
    { class: 'Double', name: 'dbl0' },
    { class: 'Double', name: 'dbl1' },
    { class: 'Double', name: 'dbl2' },
    { class: 'Double', name: 'dbl3' },
    { class: 'Double', name: 'dbl4' },
    { class: 'Double', name: 'dbl5' },
    { class: 'Double', name: 'dbl6' },
    { class: 'Double', name: 'dbl7' },
    { class: 'Double', name: 'dbl8' },
    { class: 'Double', name: 'dbl9' }
  ]
});
