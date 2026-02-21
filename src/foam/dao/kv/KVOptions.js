/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.kv',
  name: 'KVOptions',

  properties: [
    { class: 'Int', name: 'blockSize', value: 64 * 1024, documentation: 'default to 64KB'},
  ]
})