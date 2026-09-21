/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.auth',
  name: 'FailedLoginAuthService',
  extends: 'foam.core.auth.ProxyAuthService',

  documentation: 'Log login failures',

  implements: [
    'foam.core.auth.EnabledAware'
  ],

  javaImports: [
    'static foam.mlang.MLang.*'
  ],

  properties: [
    {
      name: 'enabled',
      class: 'Boolean',
      value: true
    }
  ],

  methods: [
    {
      name: 'login',
      javaCode: `
      try {
        return super.login(x, identifier, password);
      } catch (foam.lang.ClientRuntimeException e) {
        if ( getEnabled() ) {
          String message = e.getMessage();
          if ( foam.util.SafetyUtil.isEmpty(e.getMessage() ) ) {
            message = e.getClass().getSimpleName();
          }
          String ip = foam.net.IPSupport.instance().getRemoteIp(x);
          foam.core.logger.StdoutLogger.instance().warning("Failed login", identifier, ip, message);

          // Need to do a userDAO lookup to find the spid tied to the account the login failed on
          foam.core.auth.User user = null;
          foam.dao.DAO userDAO = (foam.dao.DAO) getX().get("userDAO");
          if ( userDAO != null ) {
            user = (foam.core.auth.User) userDAO.find(EQ(foam.core.auth.User.USER_NAME, identifier));
          } else {
            foam.core.logger.StdoutLogger.instance().warning("FailedLoginAuthService could not find userDAO");
          }

          LoginAttempt attempt = new LoginAttempt();
          attempt.setIdentifier(identifier);
          attempt.setIpAddress(ip);
          attempt.setFailureMessage(message);
          if ( user != null ) attempt.setSpid(user.getSpid()); // Defaults to "foam" if there is no user
          ((foam.dao.DAO) getX().get("loginAttemptDAO")).put_(getX(), attempt);
        }
        throw e;
      }
     `
    }
  ]
});
