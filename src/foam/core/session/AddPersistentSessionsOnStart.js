/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.session',
  name: 'AddPersistentSessionsOnStart',

  implements: [
    'foam.lang.ContextAgent',
    'foam.core.auth.EnabledAware',
    'foam.core.COREService'
  ],

  documentation: `Copy persistent sessions to localsessiondao on start`,

  javaImports: [
    'foam.core.COREService',
    'foam.core.logger.Loggers',
    'foam.core.auth.EnabledAware',
    'foam.dao.DAO',
    'foam.dao.AbstractSink',
    'foam.lang.AgencyTimerTask',
    'foam.lang.Detachable',
    'java.util.Timer'
  ],

  properties: [
    {
      name: 'initialTimerDelay',
      class: 'Long',
      value: 60000
    }
  ],

  methods: [
    {
      name: 'start',
      javaCode: `
        Loggers.logger(getX(), this).info("start");
        Timer timer = new Timer(this.getClass().getSimpleName());
        timer.schedule(
          new AgencyTimerTask(getX(), this),
          getInitialTimerDelay());
      `
    },
    {
      name: 'execute',
      javaCode: `
        DAO localSessionDAO = (DAO) x.get("localSessionDAO");
        DAO persistentSessionDAO = (DAO) x.get("persistentSessionDAO");

        persistentSessionDAO.select(new AbstractSink() {
          @Override
          public void put(Object obj, Detachable sub) {
            localSessionDAO.put((Session) obj);
          }
        });
      `
    }
  ]
});
