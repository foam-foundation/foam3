/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.index',
  name: 'StoredTreeNode',
  implements: [ 'foam.dao.store.Stored' ],

  javaImports: [
    'foam.dao.store.FileStore',
    'foam.dao.store.Stored'
  ],

  properties: [
    {
      name: 'key',
      class: 'Object',
      shortName: 'k'
    },
    {
      name: 'size',
      class: 'Long',
      shortName: 's'
    },
    {
      name: 'level',
      class: 'Int',
      shortName: 'l'
    },
    {
      name: 'value',
      class: 'FObjectProperty',
      of: 'foam.dao.store.Stored',
      shortName: 'v'
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
    },
    {
      name: 'store',
      class: 'FObjectProperty',
      of: 'foam.dao.store.FileStore',
      visibility: 'HIDDEN',
      transient: true
    }
  ],

  methods: [
    {
      name: 'loadLeft',
      javaType: 'TreeNode',
      javaCode: `
      TreeNode node = StoredTreeNode.Load(getStore(), getLeft());
      setLeft(null);
      return node;
      `
    },
    {
      name: 'loadRight',
      javaType: 'TreeNode',
      javaCode: `
      TreeNode node = StoredTreeNode.Load(getStore(), getRight());
      setRight(null);
      return node;
      `
    }
  ],
  javaCode: `
  public static TreeNode Load(FileStore store, Stored stored) {
    if ( store == null )
      return null;

    stored = store.load(stored);
    if ( stored == null ) {
      return null;
    }

    StoredTreeNode stn = (StoredTreeNode) stored.get();
    stn.setStore(store);
    TreeNode node = new TreeNode(
                                 stn.getKey(),
                                 store.load(stn.getValue()).get(),
                                 stn.getSize(),
                                 (byte) stn.getLevel(),
                                 null,
                                 null,
                                 stn
                                 );
    stn.setValue(null);
    return node;
  }
  `
});
