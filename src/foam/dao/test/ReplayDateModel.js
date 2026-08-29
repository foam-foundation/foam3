/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

/**
 * A model with 10 date-ish properties (5 Date, 5 DateTime, plus seq), used
 * as the "date-heavy" shape in the journal-entry parse-cost shape matrix.
 */
foam.CLASS({
  package: 'foam.dao.test',
  name: 'ReplayDateModel',

  ids: ['seq'],

  properties: [
    { class: 'Long',     name: 'seq' },
    { class: 'Date',     name: 'date0' },
    { class: 'Date',     name: 'date1' },
    { class: 'Date',     name: 'date2' },
    { class: 'Date',     name: 'date3' },
    { class: 'Date',     name: 'date4' },
    { class: 'DateTime', name: 'dateTime0' },
    { class: 'DateTime', name: 'dateTime1' },
    { class: 'DateTime', name: 'dateTime2' },
    { class: 'DateTime', name: 'dateTime3' },
    { class: 'DateTime', name: 'dateTime4' }
  ]
});
