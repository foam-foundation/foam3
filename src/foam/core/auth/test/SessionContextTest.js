/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.auth.test',
  name: 'SessionContextTest',
  extends: 'foam.core.test.Test',

  documentation: `A service that keeps per-session state has nowhere durable to put it.
    applyTo derives the context it returns from x and rebuilds it whenever the user
    record changes, so an entry written into applyContext is gone after the next
    rebuild. sessionContext is the layer the session owns rather than derives: applyTo
    composes it, so what a service puts there outlives a rebuild, and composes it
    underneath the derived entries, so it cannot shadow them.`,

  javaImports: [
    'foam.core.auth.LifecycleState',
    'foam.core.auth.Subject',
    'foam.core.auth.User',
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
        session.setContext(session.applyTo(x));

        // A service hangs its per-session state off the session.
        Object state = new Object();
        session.setSessionContext(session.getSessionContext().put("testServiceState", state));

        session.setContext(session.applyTo(x));
        test(session.getContext().get("testServiceState") == state,
          "a session's own entry reaches the applied context");

        // Any edit to the user row makes the next applyTo rebuild from scratch.
        user = (User) user.fclone();
        user.setLastName("after");
        userDAO.put(user);

        session.setContext(session.applyTo(x));

        User subjectUser = ((Subject) session.getContext().get("subject")).getUser();
        test("after".equals(subjectUser.getLastName()),
          "the user edit rebuilt the session context, got " + subjectUser.getLastName());

        test(session.getContext().get("testServiceState") == state,
          "the entry survives the rebuild");

        // Derived entries still win, so nothing put here can stand in for one.
        session.setSessionContext(session.getSessionContext().put("subject", null));
        session.setContext(session.applyTo(x));
        test(session.getContext().get("subject") != null,
          "a session entry does not shadow a derived one");

        userDAO.remove(user);
      `
    }
  ]
});
