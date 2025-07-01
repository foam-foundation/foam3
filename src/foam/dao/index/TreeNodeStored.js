/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.index',
  name: 'TreeNodeStored',
  implements: [ 'foam.dao.store.Stored' ],

  javaImports: [
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
      name: 'leftLoaded',
      class: 'Boolean',
      transient: true
    },
    {
      name: 'right',
      class: 'FObjectProperty',
      of: 'foam.dao.store.Stored'
    },
    {
      name: 'rightLoaded',
      class: 'Boolean',
      transient: true
    }
  ],

  methods: [
    {
      name: 'loadLeft',
      javaType: 'TreeNode',
      javaCode: `
      if ( getLeft() == null ) return null;
      if ( getLeftLoaded() ) return null;
      TreeNode node = load(getLeft());
      setLeftLoaded(true);
      return node;
      `
    },
    {
      name: 'loadRight',
      javaType: 'TreeNode',
      javaCode: `
      if ( getRight() == null ) return null;
      if ( getRightLoaded() ) return null;
      TreeNode node = load(getRight());
      setRightLoaded(true);
      return node;
      `
    },
    {
      // FIXME: this only works if TreeNodeStored has access to store_
      name: 'load',
      args: 'Stored stored',
      javaType: 'TreeNode',
      javaCode: `
      TreeNodeStored tns = null;
      if ( stored == null ) {
        tns = this;
      } else {
        tns = (TreeNodeStored) stored.get();
      }
      TreeNode node = new TreeNode(
                                   tns.getKey(),
// FIXME: need access to store_ here or FileStored.store
                                   tns.getValue().get(),
                                   tns.getSize(),
                                   (byte) tns.getLevel(),
                                   null,
                                   null,
                                   this
                                   );
      this.setValue(null);
      return node;
      `
    }
  ]
});
