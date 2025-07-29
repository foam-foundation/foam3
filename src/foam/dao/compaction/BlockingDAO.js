/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.compaction',
  name: 'BlockingDAO',
  extends: 'foam.dao.ProxyDAO',

  abstract: true,
  
  documentation: `All DAO operations will blocked while condition is true, and unblocked when a particular CMD is received.`,

  javaImports: [
    'foam.dao.DAO',
    'foam.core.pm.PM',
    'foam.core.logger.Logger',
    'foam.core.logger.Loggers',
    'java.util.concurrent.atomic.AtomicLong'
  ],

  javaCode: `
    private Object lock_ = new Object();
    private AtomicLong blocked_ = new AtomicLong();
  `,

  constants: [
    {
      documentation: 'Return number of threads currently blocked',
      name: 'BLOCKED_CMD',
      type: 'String',
      value: 'BLOCKED_CMD'
    },
    {
      documentation: 'Notify all threads',
      name: 'UNBLOCK_CMD',
      type: 'String',
      value: 'UNBLOCK_CMD'
    }
  ],

  methods: [
    {
      name: 'find_',
      javaCode: `
      // Loggers.logger(x, this).debug("find");
      block(x);
      return getDelegate().find_(x, id);
      `
    },
    {
      name: 'select_',
      javaCode: `
      // Loggers.logger(x, this).debug("select");
      block(x);
      return getDelegate().select_(x, sink, skip, limit, order, predicate);
      `
    },
    {
      name: 'put_',
      javaCode: `
      // Loggers.logger(x, this).debug("put");
      block(x);
      return getDelegate().put_(x, obj);
      `
    },
    {
      name: 'remove_',
      javaCode: `
      // Loggers.logger(x, this).debug("remove");
      block(x);
      return getDelegate().remove_(x, obj);
      `
    },
    {
      name: 'removeAll_',
      javaCode: `
      // Loggers.logger(x, this).debug("removeAll");
      block(x);
      getDelegate().removeAll_(x, skip, limit, order, predicate);
      `
    },
    {
      name: 'cmd_',
      javaCode: `
      if ( obj != null ) {
        if ( UNBLOCK_CMD.equals(obj) ) {
           /* obj.equals(getUnblockCmd()) ||*/
          ((foam.core.om.OMLogger) x.get("OMLogger")).log(obj.toString());
          Loggers.logger(x, this).info("cmd", "unblock", "received", "blocked", blocked_.get());
          unblock(x);
        }
        if ( BLOCKED_CMD.equals(obj) ) {
          ((foam.core.om.OMLogger) x.get("OMLogger")).log(obj.toString());
          return blocked_.get();
        }
      }
      return getDelegate().cmd_(x, obj);
      `
    },
    {
      name: 'block',
      args: 'Context x',
      javaCode: `
      if ( ! maybeBlock(x) ) {
        return;
      }

      synchronized ( lock_ ) {
        while ( maybeBlock(x) ) {
          PM pm = PM.create(x, this.getClass().getSimpleName(), "block", "wait");
          try {
            Logger logger = Loggers.logger(x, this);
            logger.debug("wait", blocked_.get());
            blocked_.getAndIncrement();
            lock_.wait();
            logger.debug("wake", blocked_.get());
          } catch (InterruptedException e) {
            throw new RuntimeException(e);
          } finally {
            pm.log(x);
            blocked_.getAndDecrement();
          }
        }
      }
      `
    },
    {
      name: 'unblock',
      args: 'Context x',
      javaCode: `
      if ( ! maybeBlock(x) ) {
        synchronized ( lock_ ) {
          lock_.notifyAll();
        }
      }
      `
    },
    {
      name: 'maybeBlock',
      args: 'Context x',
      type: 'Boolean',
      javaCode: `
      return false;
      `
    },
    {
      name: 'getBlockedCount',
      type: 'Long',
      javaCode: `
      return blocked_.get();
      `
    }
  ]
});
