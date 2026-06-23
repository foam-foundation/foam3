/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.index',
  name: 'AddIndexService',
  implements: [
    'foam.core.COREService'
  ],

  documentation: `Post DAO setup, add additional indexes.
Intended to add indexes to global DAO cspec.
NOTE: this invokes the ContextFactory, so any lazy: true
services will be replayed.
No JS support

Example use:
p({
  "class": "foam.core.boot.CSpec",
  "name": "someDAOIndexes",
  "lazy": false,
  "lazyOrder": 100,
  "serviceScript": """
    return new foam.dao.index.AddIndexService.Builder(x)
      .setCSpec("someDAO")
      .build()
      .addIndex(new foam.lang.PropertyInfo[] { com.foo.SomeDAO.ACTIVITY_TYPE });
   """
})

`,

  javaImports: [
    'foam.core.logger.Logger',
    'foam.core.logger.Loggers',
    'foam.dao.DAO',
    'foam.dao.index.AddIndexCommand',
    'foam.lang.Indexer',
    'foam.lang.PropertyInfo',
    'foam.lang.X',
    'java.util.Arrays',
    'java.util.List'
  ],

  properties: [
    {
      name: 'cSpec',
      class: 'Reference',
      of: 'foam.core.boot.CSpec'
    },
    {
      name: 'indexes',
      class: 'List'
    }
  ],

  methods: [
    {
      name: 'addIndex',
      args: 'foam.lang.PropertyInfo[] indexer',
      type: 'AddIndexService',
      javaCode: `
        getIndexes().add(indexer);
        return this;
      `
    },
    {
      name: 'start',
      javaCode: `
        X x = getX();
        Logger logger = Loggers.logger(x, this, getCSpec());

        DAO dao = (DAO) x.get(getCSpec());
        if ( dao == null ) {
          logger.error("DAO not found");
          return;
        }

        for ( Object index : getIndexes() ) {
          AddIndexCommand cmd = new AddIndexCommand();
          cmd.setIndexers((Indexer[]) index);
          Object result = dao.cmd_(x, cmd);
          if ( result == null ||
               ! ( result instanceof Boolean ) ||
            ((Boolean) result).booleanValue() != true ) {
            logger.warning("Index not added, no access to MDAO", Arrays.toString((PropertyInfo[])index));
            return;
          }
          logger.info("Index added", Arrays.toString((PropertyInfo[])index));
        }
      `
    },
    {
      name: 'stop',
      javaCode: `
        // nop
      `
    }
  ]
});
