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
      name: 'DEFAULT_QUERY_CMD',
      type: 'String',
      documentation: 'Command to return AQL of default query, if present.',
      value: 'DEFAULT_QUERY_CMD'
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
    },
    {
      class: 'String',
      name: 'serviceName',
      documentation: 'Name clients correlate load-status rows with. Resolved from the CSpec in X when built by a serviceScript; EasyDAO sets it explicitly otherwise.',
      javaFactory: `
        foam.core.boot.CSpec cspec = (foam.core.boot.CSpec) getX().get(foam.core.boot.CSpec.CSPEC_CTX_KEY);
        return cspec != null ? cspec.getName() : "";
      `
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

  public long journalSize(String journalName) {
    try {
      foam.core.fs.FileSystemStorage fss = (foam.core.fs.FileSystemStorage) getX().get(foam.core.fs.FileSystemStorage.class);
      long total = 0;
      java.io.File f = fss.get(journalName);
      if ( f != null && f.isFile() ) total += f.length();
      java.io.File f0 = fss.get(journalName + ".0");
      if ( f0 != null && f0.isFile() ) total += f0.length();
      return total;
    } catch ( Throwable t ) {
      return 0;
    }
  }

  `
});
