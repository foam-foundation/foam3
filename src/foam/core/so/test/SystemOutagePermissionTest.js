/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.so.test',
  name: 'SystemOutageSystemNotificationThemeTest',
  extends: 'foam.core.test.Test',

  documentation: '',

  javaImports: [
    'foam.lang.X',
    'foam.dao.DAO',
    'foam.core.so.*',
    'foam.core.theme.Theme'
  ],

  methods: [
    {
      name: 'setup',
      args: 'X x',
      javaCode: `
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
      task.setThemes(new String[] {"foam"});
      so.getTasks(x).put(task);

      SystemNotificationService service = (SystemNotificationService) x.get("systemNotificationService");

      SystemNotification[] notes = service.getSystemNotifications(x, null);

      test ( notes == null || notes.length == 0, "SystemNotification (x) not found");

      X y = x.put("theme", new Theme.Builder(x).setId("foam").build());
      notes = service.getSystemNotifications(y, null);

      test ( notes.length == 1, "SystemNotification (theme) found");

      task = new SystemNotificationTask();
      note = new SystemNotification();
      note.setKey("test");
      task.setSystemNotification(note);
      so.getTasks(x).put(task);

      notes = service.getSystemNotifications(y, "test");
      test ( notes.length == 1 && notes[0].getKey().equals("test"), "SystemNotification (key) found");
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
