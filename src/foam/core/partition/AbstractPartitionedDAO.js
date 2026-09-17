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

  implements: [ 'foam.core.boot.CSpecAware' ],

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
      documentation: `Name clients correlate load-status rows with. Read from
        the cSpec that CSpecFactory.initService stamps while walking the
        service's delegate chain (CSpecAware) -- the construction-time X can't
        be used, initService replaces it. EasyDAO/DDAO set it explicitly for
        DAOs built outside a CSpec.`,
      javaFactory: `
        return getCSpec() != null ? getCSpec().getName() : "";
      `
    }
  ],

  methods: [
  ],

  javaCode: `
  public void unload() {
    // NOP, implement in sub-classes
  }

  /** Partition-load lifecycle hooks: getDelegate() implementations fire them
      around createDAO() (journal replay); cache hits never fire them.
      Override to add partition-implementation-specific handling (loading
      sets, status rows, metrics). */
  public void loadingStarted(String part) {
    // NOP, implement in sub-classes
  }

  public void loadingEnded(String part) {
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
      if ( total > 0 ) return total;

      // FileSystemStorage has no bytes for this name -- journals can be
      // served read-only from a resource jar (resource.journals.dir). The
      // read Storage may be a ResourceStorage, whose get() throws for jar
      // entries, so size it off the stream it hands back instead.
      foam.core.fs.Storage rs = (foam.core.fs.Storage) getX().get(foam.core.fs.Storage.class);
      if ( rs != null && rs != fss ) {
        total += streamSize(rs, journalName);
        total += streamSize(rs, journalName + ".0");
      }
      return total;
    } catch ( Throwable t ) {
      return 0;
    }
  }

  protected long streamSize(foam.core.fs.Storage storage, String name) {
    try ( java.io.InputStream is = storage.getInputStream(name) ) {
      return is != null ? is.available() : 0;
    } catch ( Throwable t ) {
      return 0;
    }
  }

  `
});
