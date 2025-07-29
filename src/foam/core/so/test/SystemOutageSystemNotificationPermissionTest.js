/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.so.test',
  name: 'SystemOutageSystemNotificationPermissionTest',
  extends: 'foam.core.test.Test',

  documentation: '',

  javaImports: [
    'foam.core.auth.User',
    'foam.core.so.*',
    'foam.dao.DAO',
    'foam.lang.X',
    'foam.util.Auth'
  ],

  properties: [
    {
      class: 'Long',
      name: 'userId'
    }
  ],

  methods: [
    {
      name: 'setup',
      args: 'X x',
      javaCode: `
      ((DAO) x.get("systemOutageTaskDAO")).removeAll();
      ((DAO) x.get("systemOutageDAO")).removeAll();
      `
    },
    {
      name: 'runTest',
      javaCode: `
    setup(x);

    try {
      DAO soDAO = (DAO) x.get("systemOutageDAO");

      SystemOutage so = new SystemOutage(x);
      so.setName(this.getClass().getSimpleName());
      so.setEnabled(true);
      so.setActive(true);
      so = (SystemOutage) soDAO.put(so).fclone();

      SystemNotificationTask task = new SystemNotificationTask();
      SystemNotification note = new SystemNotification();
      task.setSystemNotification(note);
      task.setPermissions(new String[] {"so.testpermission"});
      so.getTasks(x).put(task);

      SystemNotificationService service = (SystemNotificationService) x.get("systemNotificationService");

      SystemNotification[] notes = service.getSystemNotifications(x, null);
      test ( notes.length == 1, "SystemNotification (admin) found");

      X userX = Auth.sudo(x, 82777842L); // api-test
      notes = service.getSystemNotifications(userX, null);
      test ( notes.length == 0, "SystemNotification (test-api) not found");

      userX = Auth.sudo(x, 112256012L); // so-test
      notes = service.getSystemNotifications(userX, null);
      test ( notes.length == 1, "SystemNotification (test) found "+notes.length);
    } finally {
      teardown(x);
    }
      `
    },
    {
      name: 'teardown',
      args: 'X x',
      javaCode: `
      `
    },
  ]
})
