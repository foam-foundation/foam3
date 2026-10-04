/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao',
  name: 'DDAO',
  extends: 'foam.dao.ProxyDAO',

  documentation: `DAO backed by a Database and delegating to an MDAO.
On start, Database table is copied into MDAO.
Finds are handled by MDAO,
Puts updated both DB and MDAO.
Use of COREService retains lazy loading until first context request.
`,

  implements: [ 'foam.core.COREService' ],

  javaImports: [
    'foam.core.logger.Logger',
    'foam.core.logger.Loggers',
    'foam.dao.DAO',
    'foam.lang.X'
  ],

  properties: [
    {
      class: 'foam.lang.Enum',
      of: 'foam.dao.DatabaseType',
      name: 'databaseType',
      value: 'NONE'
    },
    {
      documentationn: 'Database DAO',
      name: 'db',
      class: 'foam.dao.DAOProperty'
    },
    {
      documentation: 'Used for reporting of replay of db',
      class: 'String',
      name: 'databaseTableName'
    },
    {
      documentation: '.0 journal to replay',
      class: 'String',
      name: 'journalName'
    },
    {
      class: 'Boolean',
      name: 'initialized'
    }
  ],

  methods: [
    {
      name: 'initialize',
      javaCode: `
      synchronized ( this ) {
        if ( getDb() == null ) {
          setDb(getDBDAO(getX()));
        }
      }
      `
    },
    {
      name: 'start',
      javaCode: `
      // database is already initialized, return
      if ( getInitialized() ) {
        return;
      }

      initialize();

      // replay .0 into MDAO
      foam.dao.java.JDAO jdao = new foam.dao.java.JDAO();
      jdao.setX(getX());
      jdao.setFilename(getJournalName());
      jdao.setCluster(true); // hack to only read .0 journals
      jdao.setDelegate(getDelegate());

      // replay DB into MDAO
      Logger logger = Loggers.logger(getX(), this, getDatabaseTableName(), "replay");
      logger.info("start");
      DAOCopySink sink = new DAOCopySink(getDelegate().getOf(), getDelegate(), false);
      getDb().select(sink);
      logger.info("end", sink.getCount());
      setInitialized(true);
      `
    },
    {
      name: 'put_',
      javaCode: `
      getDb().put_(x, obj);
      return getDelegate().put_(x, obj);
      `
    },
    {
      name: 'remove_',
      javaCode: `
      getDb().remove_(x, obj);
      return getDelegate().remove_(x, obj);
      `
    },
    {
      name: 'cmd_',
      javaCode: `
      initialize();
      try {
        getDb().cmd_(x, obj);
      } catch ( Exception e ) {
        Loggers.logger(x, this).warning(getDatabaseTableName(), "cmd_", e.getMessage());
      }
      return getDelegate().cmd_(x, obj);
      `
    },
    {
      name: 'getDBDAO',
      args: 'X x',
      type: 'DAO',
      javaCode: `
      if ( getDatabaseType() == DatabaseType.MONGODB ) {
        return getMongoDAO(x);
      } else {
        Loggers.logger(x, this).error(getDatabaseTableName(), "Unsupported DatabaseType", getDatabaseType());
        throw new RuntimeException("Unsupported DatabaseType "+getDatabaseType());
      }
      `
    },
    {
      documentation: 'Refined by mongodb pom',
      name: 'getMongoDAO',
      args: 'X x',
      type: 'DAO',
      javaCode: `
      return null;
      `
    }
  ]
})
