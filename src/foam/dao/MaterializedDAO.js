/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao',
  name: 'MaterializedDAO',
  extends: 'foam.dao.ReadOnlyDAO',

  javaImplements: [
    'Runnable',
    'foam.core.COREService'
  ],

  constants: [
    { type: 'String', name: 'PUT',        value: 'PUT' },
    { type: 'String', name: 'REMOVE',     value: 'REMOVE' },
    { type: 'String', name: 'REMOVE_ALL', value: 'REMOVE_ALL' }
  ],

  javaImports: [
    'foam.lang.Detachable',
    'foam.lang.FObject',
    'foam.dao.index.AddIndexCommand',
    'foam.mlang.sink.Count',
    'foam.mlang.predicate.Predicate',
    'foam.mlang.predicate.True',
    'foam.core.logger.Logger',
    'foam.core.logger.Loggers',
    'foam.core.pm.PM',
    'java.util.concurrent.TimeUnit',
    'foam.util.concurrent.AbstractAssembly',
    'foam.util.concurrent.AssemblyLine',
    'foam.util.concurrent.AsyncAssemblyLine'
  ],

  documentation: `
    Create a Materialized View from a source DAO.

    Uses a dedicated daemon Thread to process updates (put, remove, removeAll)
    instead of handling immediately because the index updates happen under
    the MDAO writeLock_. Filtering and adapting objects can take a long time
    and we don't want to hold the lock while we're performing this work otherwise
    we would block the source day to updates.

    The queue property is used to communicate to the processing Thread.
    Object arrays of size 2 are used with the first element being the command,
    either PUT, REMOVE, or REMOVE_ALL and the second being the FObject being
    processed in the case of PUT and REMOVE.

    REMOVE_ALL clear()'s the queue to avoid unnecessary work.
  `,

  properties: [
    {
      documentation: 'When true, DAO will be initialized (loaded) immediately on startup of the system, rather than wait for first user request.',
      class: 'Boolean',
      name: 'autoStart'
    },
    {
      class: 'Object',
      name: 'queue',
      javaType: 'java.util.concurrent.BlockingQueue',
      javaFactory: 'return new java.util.concurrent.LinkedBlockingQueue();'
    },
    {
      documentation: 'true after maybeInit has started the worker thread',
      class: 'Boolean',
      name: 'initialized'
    },
    {
      class: 'Object',
      javaType: 'foam.mlang.predicate.Predicate',
      generateJava: true,
      name: 'predicate',
      javaValue: 'foam.mlang.MLang.TRUE'
    },
    {
      class: 'FObjectProperty',
      name: 'adapter',
      javaType: 'foam.dao.MaterializedAdapter',
      javaFactory: 'return new CopyAdapter(getOf());'
    },
    {
      class: 'foam.dao.DAOProperty',
      name: 'sourceDAO',
      required: true
    },
    {
      name: 'of',
      required: true
//      javaFactory: 'return getSourceDAO().getOf();'
    },
    {
      class: 'Boolean',
      name: 'pm'
    },
    {
      documentation: 'Decorate with a ServiceProviderAwareDAO',
      name: 'serviceProviderAware',
      class: 'Boolean',
      javaFactory: 'return foam.core.auth.ServiceProviderAware.class.isAssignableFrom(getSourceDAO().getOf().getObjClass());'
    },
    {
      documentation: 'Enable authorization',
      class: 'Boolean',
      name: 'authorize',
      value: true
    },
    {
      class: 'Object',
      type: 'foam.core.auth.Authorizer',
      name: 'authorizer',
      documentation: `
        Checks read access to the sourceDAO.
        If the class of the materializedDAO is Authorizable, use its custom authorization
        logic to check access to objects in the materializedDAO.
        Otherwise, use a StandardAuthorizer to explicitly check the read permission of the
        sourceDAO objects.
      `,
      javaFactory: `
      if ( foam.core.auth.Authorizable.class.isAssignableFrom(getOf().getObjClass()) ) {
        return new foam.core.auth.AuthorizableAuthorizer(getPermissionPrefix());
      }
      return new foam.core.auth.StandardAuthorizer(getPermissionPrefix());
      `
    },
    {
      class: 'String',
      name: 'permissionPrefix',
      javaFactory: `
      return getSourceDAO().getOf().getObjClass().getSimpleName().toLowerCase();
     `
    },
    {
      name: 'delegate',
      javaPreSet: `
        if ( getServiceProviderAware() ) {
          val = new foam.core.auth.ServiceProviderAwareDAO.Builder(getX())
            .setDelegate(val)
            .build();
        }

        if ( getAuthorize() ) {
          val = new foam.core.auth.AuthorizationDAO.Builder(getX())
            .setDelegate(val)
            .setAuthorizer(getAuthorizer())
            .build();
        }

        /* TODO: get suitable CSpec
        if ( getPm() )
          val = new foam.dao.PMDAO.Builder(getX()).setCSpec(getCSpec()).setDelegate(val).build();
        */
      `,
      javaFactory: 'return new foam.dao.MDAO(getOf());'
    },
    {
      class: 'Array',
      of: 'String',
      name: 'observedDAOs',
      documentation: 'A list of DAOs that will be listened to',
      javaFactory: 'return getAdapter().getObservedDAOs();'
    }
  ],

  methods: [
    {
      name: 'maybeInit',
      javaType: 'void',
      synchronized: true,
      javaCode: `
        if ( getInitialized() ) return;

        Logger logger = Loggers.logger(getX(), this, getSourceDAO().getOf().getObjClass().getSimpleName(), "start");
        logger.info("initializing");

        setInitialized(true);

        Thread t = new Thread(this);
        t.setName("MaterializedDAO Processor: " + getDelegate());
        t.setDaemon(true);
        t.start();

        // Could take a long time
        PM pm = new PM("MaterializedDAO", "initializing", getSourceDAO().getOf().getObjClass().getSimpleName());
        AddIndexCommand cmd = new AddIndexCommand();
        cmd.setIndex(new MaterializedDAOIndex(this));
        getSourceDAO().cmd(cmd);
        pm.log(getX());
        logger.info("initialized");

        String[] daoKeys = getObservedDAOs();
        if ( daoKeys.length != 0 ) {
          for ( String daoKey : daoKeys ) {
            DAO dao = (DAO) getX().get(daoKey);
            var self = this;
            if ( dao != null ) dao.listen(new AbstractSink() {
              public void put(Object obj, Detachable sub) {
                getAdapter().onObservedDAOUpdate(self, daoKey, obj);
              }
            }, foam.mlang.MLang.TRUE);
          }
        }
      `
    },
    {
      name: 'find_',
      javaCode: 'maybeInit(); return getDelegate().find_(x, id);'
    },
    {
      name: 'select_',
      javaCode: 'maybeInit(); return getDelegate().select_(x, sink, skip, limit, order, predicate);'
    },
    {
      name: 'adapt',
      args: 'FObject value',
      type: 'FObject',
      documentation: 'Template method for adapting from source to target model.',
      javaCode: 'return getAdapter().adapt(value);'
    },

    // Implement Index
    {
      name: 'indexPut',
      type: 'Object',
      args: 'Object state, FObject value',
      javaCode: `
        try {
          getQueue().put(new Object[] { PUT, value });
        } catch (InterruptedException e) {
        }
        return this;
      `
    },

    {
      name: 'indexRemove',
      type: 'Object',
      args: 'Object state, FObject value',
      javaCode: `
        try {
          getQueue().put(new Object[] { REMOVE, value });
        } catch (InterruptedException e) {
        }
        return this;
      `
    },

    {
      name: 'indexRemoveAll',
      type: 'Object',
      javaCode: `
        getQueue().clear();
        try {
          getQueue().put(new Object[] { REMOVE_ALL });
        } catch (InterruptedException e) {
        }
        return this;
      `
    },
    {
      name: 'run',
      type: 'void',
      javaCode: `
        foam.lang.XLocator.set(getX());
        while ( true ) {
          try {
            Object[] ret = (Object[]) getQueue().poll(10, TimeUnit.SECONDS);
            if ( ret != null ) {
              process(ret);
            }
          } catch (InterruptedException e) {
            //NOOP
          } catch ( Throwable t ) {
            Loggers.logger(getX(), this).error("MaterializedDAO fails to consume", t);
          }
        }
      `
    },
    {
      name: 'process',
      args: 'Object[] cmd',
      javaCode: `
        FObject  value;
        if ( cmd[0] == PUT ) {
          value = (FObject) cmd[1];

          if ( getPredicate().f(value) ) {
            var obj = adapt(value);
            if ( obj != null )
              getDelegate().put(obj);
          }
        } else if ( cmd[0] == REMOVE ) {
          value = (FObject) cmd[1];

          if ( getPredicate().f(value) ) {
            var obj = getAdapter().fastAdapt(value);
            if ( obj != null )
              getDelegate().remove(obj);
          }
        } else /* removeAll */ {
          getDelegate().removeAll();
        }
      `
    },
    {
      name: 'start',
      javaCode: 'if ( getAutoStart() ) maybeInit();'
    }
  ]
});
