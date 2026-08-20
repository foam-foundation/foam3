/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.auth.test',
  name: 'SessionLocalSettingTest',
  extends: 'foam.core.test.Test',

  documentation: `localLocalSettingDAO holds a user's LocalSettings for the life of
    their session, and localSettingDAO is served on top of it. Session.applyTo
    rebuilds the session context whenever the user record changes, so the entry has
    to survive that rebuild - otherwise any edit to the user row silently empties
    the settings they had stored.`,

  javaImports: [
    'foam.core.auth.LifecycleState',
    'foam.core.auth.Subject',
    'foam.core.auth.User',
    'foam.core.session.LocalSetting',
    'foam.core.session.Session',
    'foam.dao.DAO',
    'foam.lang.X'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        DAO userDAO = (DAO) x.get("localUserDAO");

        User user = new User();
        user.setGroup("test");
        user.setSpid("test");
        user.setUserName(this.getClass().getSimpleName());
        user.setFirstName(user.getUserName());
        user.setLastName("before");
        user.setEmail(user.getUserName() + "@test.com");
        user.setLifecycleState(LifecycleState.ACTIVE);
        user = (User) userDAO.put(user);

        Session session = new Session.Builder(x).setUserId(user.getId()).build();

        // One request: applyTo derives the context, the box stores it on the session.
        session.setContext(session.applyTo(x));

        DAO settings = (DAO) session.getContext().get("localLocalSettingDAO");
        test(settings != null, "the session context carries a localLocalSettingDAO");

        settings.put(new LocalSetting.Builder(x)
          .setId("homeDenomination")
          .setValue("CAD")
          .build());
        test(settings.find("homeDenomination") != null,
          "a setting written through it is readable");

        // Any edit to the user row makes the next applyTo rebuild rather than
        // reuse its cached context.
        user = (User) user.fclone();
        user.setLastName("after");
        userDAO.put(user);

        session.setContext(session.applyTo(x));

        User subjectUser = ((Subject) session.getContext().get("subject")).getUser();
        test("after".equals(subjectUser.getLastName()),
          "the user edit rebuilt the session context, got " + subjectUser.getLastName());

        DAO rebuilt = (DAO) session.getContext().get("localLocalSettingDAO");
        test(rebuilt != null, "the rebuilt context still carries a localLocalSettingDAO");
        test(rebuilt != null && rebuilt.find("homeDenomination") != null,
          "a setting stored before the rebuild is still there after it");

        userDAO.remove(user);
      `
    }
  ]
});
