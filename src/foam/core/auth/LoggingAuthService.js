/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.auth',
  name: 'LoggingAuthService',
  extends: 'foam.core.auth.ProxyAuthService',

  documentation: `
    Tool to be used to help detect which permissions are preventing a user from accessing a system feature.
    To use:
      1. use the Sessions menu to find the user's sessionId and copy it into this script:
        // To install for a particular session, set the sessionID and then run the following beanshell script:
        sessionID = "0d886833-cdad-4892-bf68-a5e85d791ea3localhost:8080";
        s = x.get("sessionDAO").find(sessionID);
        s.setApplyContext(s.getApplyContext().put("auth", new foam.core.auth.LoggingAuthService(x.get("auth"))));
      2. Run the above script as a Beanshell
      3. use the user's account to attempt the desired operation
      4. view logs and look for "FAILED PERMISSION" entries to see the failed permission checks that are
         preventing the user's access.
      5. Add the desired to the user's Group or appropriate Role until access is granted

    To disable the logging either log the user out or delete their session (which will also log them out).

    The above script is already stored in the scriptDAO as "LogUserFailedPermissionChecks".
  `,

  javaImports: [
    'foam.core.logger.Logger'
  ],

  javaCode: `
    public LoggingAuthService(AuthService delegate) {
      setDelegate(delegate);
    }
  `,

  methods: [
    {
      name: 'check',
      javaCode: `
        if ( getDelegate().check(x, permission) ) return true;

        User   user   = ((Subject) x.get("subject")).getUser();
        Logger logger = (Logger)   x.get("logger");

        logger.log(this.getClass(), "FAILED PERMISSION", user.getUserName(), permission);
        // System.err.println("FAILED PERMISSION " + user.getUserName() + " " + permission);

        return false;
      `
    }
  ]
});
