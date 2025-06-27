/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.index',
  name: 'TreeNodeStored',
  implements: [ 'foam.dao.store.Stored' ],

  properties: [
    {
      name: 'key',
      class: 'Object'
    },
    {
      name: 'size',
      class: 'Long'
    },
    {
      name: 'level',
      class: 'Int'
    },
    {
      name: 'value',
      class: 'FObjectProperty',
      of: 'foam.dao.store.Stored'
    },
    {
      name: 'left',
      class: 'FObjectProperty',
      of: 'foam.dao.store.Stored'
    },
    {
      name: 'right',
      class: 'FObjectProperty',
      of: 'foam.dao.store.Stored'
    }
  ]
});
