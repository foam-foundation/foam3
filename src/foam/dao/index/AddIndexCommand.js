/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.index',
  name: 'AddIndexCommand',

  properties: [
    {
      class: 'Boolean',
      name: 'unique'
    },
    {
      class: 'Boolean',
      name: 'store'
    },
    {
      class: 'FObjectArray',
      of: 'foam.lang.Indexer',
      name: 'indexers'
    },
    {
       class: 'Object',
//       of: 'foam.dao.index.Index',
       name: 'index'
    }
  ]
});
