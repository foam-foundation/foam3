/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.auth',
  name: 'UserLifecycleTicketSink',
  extends: 'foam.dao.AbstractSink',

  documentation: 'Desgined to be used by the UserLifecycleTicket to delete or disable user associated models',

  javaImports: [
    'foam.lang.FObject',
    'foam.lang.Identifiable',
    'foam.lang.PropertyInfo',
    'foam.lang.X',
    'foam.dao.DAO',
    'foam.dao.ProxyDAO',
    'foam.dao.Sink',
    'foam.core.logger.Logger',
    'foam.core.logger.Loggers',
    'java.util.HashMap',
    'java.util.List',
    'java.util.Map'
  ],

  javaCode: `
    public UserLifecycleTicketSink(X x, String daoKey) {
      setX(x);
      setDaoKey(daoKey);
      buildUpdatedMap(x);
    }

    public UserLifecycleTicketSink(X x, LifecycleState state, String daoKey) {
      setX(x);
      setLifecycleState(state);
      setDaoKey(daoKey);
      buildUpdatedMap(x);
    }
  `,

  properties: [
    {
      class: 'String',
      name: 'daoKey'
    },
    {
      class: 'Enum',
      of: 'foam.core.auth.LifecycleState',
      name: 'lifecycleState',
      value: 'DELETED'
    },
    {
      class: 'Map',
      name: 'updatedMap'
    }
  ],

  methods: [
    {
      name: 'put',
      javaCode: `
      X x = getX();
      Logger logger = (Logger) x.get("logger");
      Object id = obj instanceof Identifiable ? ((Identifiable) obj).getPrimaryKey() : null;
      UserLifecycleTicket ticket = x.get(UserLifecycleTicket.class);
      UserLifecycleTicketUpdate update = new UserLifecycleTicketUpdate();
      update.setDaoKey(getDaoKey());
      update.setOf(((FObject)obj).getClassInfo());
      update.setObjectId(id);
      DAO dao = (DAO) x.get(getDaoKey());
      if ( dao == null ) {
        logger.error("DAO not found", getDaoKey(), update, "not updated");
        return;
      }
    try {
      if ( obj instanceof LifecycleAware ) {
        LifecycleAware aware = ((LifecycleAware) obj);
        LifecycleState requestedState = getLifecycleState();
        if ( ticket.getRevertRelationships() ) {
          UserLifecycleTicketUpdate previous = (UserLifecycleTicketUpdate) getUpdatedMap().get(update.toKey());
          if ( previous != null &&
               previous.getPreviousState() != null ) {
            requestedState = (LifecycleState) previous.getPreviousState();
          }
        }
        if ( aware.getLifecycleState() != requestedState ) {
          aware = (LifecycleAware) ((FObject)aware).fclone();
          update.setPreviousState(aware.getLifecycleState());
          aware.setLifecycleState(requestedState);
          aware = (LifecycleAware) dao.put_(x, (FObject) aware);
          if ( aware.getLifecycleState() != requestedState ) {
            logger.error(obj.getClass().getSimpleName(), "update failed");
          }
          update.setCurrentState(aware.getLifecycleState());
          logger.debug(obj.getClass().getSimpleName(), update);
          ticket.getUpdated().add(update);
        }
      } else if ( obj instanceof EnabledAware ) {
        EnabledAware aware = (EnabledAware) obj;
        Boolean requestedEnabled = getLifecycleState() == LifecycleState.ACTIVE ? true : false;
        if ( ticket.getRevertRelationships() ) {
          UserLifecycleTicketUpdate previous = (UserLifecycleTicketUpdate) getUpdatedMap().get(update.toKey());
          if ( previous != null &&
               previous.getPreviousState() != null ) {
            requestedEnabled = (Boolean) previous.getPreviousState();
          }
        }
        aware = (EnabledAware) ((FObject)aware).fclone();
        update.setPreviousState(aware.getEnabled());
        if ( requestedEnabled &&
             ! aware.getEnabled() ) {
          aware.setEnabled(true);
        } else if ( ! requestedEnabled &&
                    aware.getEnabled() ) {
          aware.setEnabled(false);
        } else {
          return;
        }
        update.setCurrentState(aware.getEnabled());
        dao.put_(x, (FObject) aware);
        logger.debug(update);
        ticket.getUpdated().add(update);
      } else if ( getLifecycleState() == LifecycleState.DELETED ) {
        update.setPreviousState(true);
        update.setCurrentState(null);

        // TODO: Enable after testing
        // dao.remove_(x, obj);
        logger.warning("UserLifecycleTicket,DELETED,delete,disabled");
        logger.debug(update);
        ticket.getUpdated().add(update);
      }
    } catch (Throwable t) {
      logger.error(t);
      ticket.setException(t);
    }
      `
    },
    {
      name: 'buildUpdatedMap',
      args: 'X x',
      javaCode: `
      UserLifecycleTicket ticket = x.get(UserLifecycleTicket.class);
      Map map = new HashMap();
      for ( var u : ticket.getCurrent() ) {
        var updated = (UserLifecycleTicketUpdate) u;
        if ( updated.getDaoKey().equals(getDaoKey()) ) {
          map.put(updated.toKey(), updated);
        }
      }
      setUpdatedMap(map);
      `
    }
  ]
});
