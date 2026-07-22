/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.partition',
  name: 'AbstractPartitionedDAO',
  extends: 'foam.dao.AbstractDAO',
  abstract: true,

  javaImports: [
    'foam.core.script.BeanShellExecutor',
    'foam.dao.index.AddIndexCommand',
    'foam.dao.*',
    'foam.lang.*',
    'foam.mlang.order.Comparator',
    'foam.mlang.predicate.Predicate',
    'java.util.concurrent.ConcurrentHashMap'
  ],

  constants: [
    {
      name: 'UNLOAD_CMD',
      type: 'String',
      documentation: 'Command to cause a PartitionedDAO to unload data.',
      value: 'UNLOAD_CMD'
    },
    {
      name: 'SEPARATOR',
      type: 'String',
      documentation: 'Character used to separate sections of the primary key.',
      value: '~'
    }
  ],

  properties: [
    {
      class: 'Int',
      name: 'depth',
      javaValue: '1'
    },
    {
      class: 'String',
      name: 'dirName'
    },
    {
      class: 'foam.mlang.ExprProperty',
      name: 'partitionProperty',
      documentation: 'Name of Property to be partitioned on.'
    },
    {
      class: 'Object',
      name: 'idProperty',
      javaType: 'foam.lang.PropertyInfo',
      javaFactory: `
        return (foam.lang.PropertyInfo) getOf().getAxiomByName("id");
      `
    },
    {
      class: 'List',
      name: 'indices'
    }
  ],

  methods: [
  ],

  javaCode: `
  public void unload() {
    // NOP, implement in sub-classes
  }

  public void addIndices(DAO dao) {
    for ( Object index : getIndices() ) {
      dao.cmd(index);
    }
  }

  public Object cmd_(X x, Object cmd) {
    if ( UNLOAD_CMD.equals(cmd) ) {
      unload();
      return true;
    }

    if ( cmd instanceof AddIndexCommand ) {
      getIndices().add(cmd);
      return true;
    }

    return super.cmd_(x, cmd);
  }

  `
});
