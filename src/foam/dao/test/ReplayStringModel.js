/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

/**
 * A model with 20 String properties (plus seq), used as the "string-heavy"
 * shape in the journal-entry parse-cost shape matrix. Run in the default
 * cell as well as the unique/long/escapes string-generation cells.
 */
foam.CLASS({
  package: 'foam.dao.test',
  name: 'ReplayStringModel',

  ids: ['seq'],

  properties: [
    { class: 'Long',   name: 'seq' },
    { class: 'String', name: 'str0' },
    { class: 'String', name: 'str1' },
    { class: 'String', name: 'str2' },
    { class: 'String', name: 'str3' },
    { class: 'String', name: 'str4' },
    { class: 'String', name: 'str5' },
    { class: 'String', name: 'str6' },
    { class: 'String', name: 'str7' },
    { class: 'String', name: 'str8' },
    { class: 'String', name: 'str9' },
    { class: 'String', name: 'str10' },
    { class: 'String', name: 'str11' },
    { class: 'String', name: 'str12' },
    { class: 'String', name: 'str13' },
    { class: 'String', name: 'str14' },
    { class: 'String', name: 'str15' },
    { class: 'String', name: 'str16' },
    { class: 'String', name: 'str17' },
    { class: 'String', name: 'str18' },
    { class: 'String', name: 'str19' }
  ]
});
