foam.CLASS({
  package: 'foam.core.auth',
  name: 'LoginService',
  documentation: 'Server only service for signing a session into a particular user',
  imports: [
    'foam.dao.DAO localSessionDAO',
    'foam.core.auth.AuthService auth'
  ],
  methods: [
    {
      name: 'login',
      documentation: `Helper function to reduce duplicated code.`,
      type: 'User',
      args: 'Context x, foam.core.auth.User user',
      javaThrows: ['foam.core.auth.AuthenticationException'],
      javaCode: `
      try {
        if ( user == null ) {
          throw new foam.core.auth.UserNotFoundException();
        }
        user.validateAuth(x);

        // check if group enabled
        foam.lang.X userX = x.put("subject", new foam.core.auth.Subject.Builder(x).setUser(user).build());
        foam.core.auth.Group group = user.findGroup(userX);
        if ( group != null && ! group.getEnabled() ) {
          throw new foam.core.auth.AccessDeniedException();
        }
        try {
          group.validateCidrWhiteList(x);
        } catch (foam.lang.ValidationException e) {
          throw new foam.core.auth.AccessDeniedException(e);
        }

        foam.core.session.Session session = x.get(foam.core.session.Session.class);
        // check for two-factor authentication
        if ( user.getTwoFactorEnabled() && ! session.getTwoFactorSuccess() ) {
          throw new foam.core.auth.AuthenticationException("User requires two-factor authentication");
        }
        // Re use the session context if the current session context's user id matches the id of the user trying to log in
        if ( session.getUserId() == user.getId() ) {
          return user;
        }

        // Freeze user
        user = (foam.core.auth.User) user.fclone();
        user.freeze();
        session.setUserId(user.getId());
        if ( getAuth().check(userX, "*") ) {
          String msg = "Admin login for " + user.getId() + " succeeded on " + System.getProperty("hostname", "localhost");
          ((foam.core.logger.Logger) x.get("logger")).warning(msg);
        }
        getLocalSessionDAO().inX(x).put(session);
        // Rebuild the session context from x, the caller's context, rather than
        // session.getContext(). The saved context can belong to a request that has
        // already finished. E.g., an OAuth sign-in starts when the login page loads
        // and completes on the provider's redirect, a second request. Reading a header
        // from the finished request throws, so code that uses the session context
        // after sign-in needs one built from the current request.
        session.setContext(session.applyTo(x));
        return user;
      } catch ( foam.core.auth.AuthenticationException e ) {
        if ( user != null &&
             (getAuth().check(x.put("subject", new Subject.Builder(x).setUser(user).build()), "*") ) ) {
          String msg = "Admin login for " + user.getId() + " failed on " + System.getProperty("hostname", "localhost");
          ((foam.core.logger.Logger) x.get("logger")).warning(msg);
        }
        throw e;
      }
      `
    }
  ]
});
