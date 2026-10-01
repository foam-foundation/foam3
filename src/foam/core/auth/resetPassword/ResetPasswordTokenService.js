/**
 * @license
 * Copyright 2018 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.auth.resetPassword',
  name: 'ResetPasswordTokenService',
  extends: 'foam.core.auth.token.AbstractTokenService',

  documentation: 'Implementation of Token Service used for reset password',

  imports: [
    'DAO tokenDAO',
    'DAO userDAO'
  ],

  javaImports: [
    'foam.comics.v2.userfeedback.UserFeedbackException',
    'foam.comics.v2.userfeedback.UserFeedback',
    'foam.comics.v2.userfeedback.UserFeedbackAlertType',
    'foam.comics.v2.userfeedback.UserFeedbackStatus',
    'foam.core.app.AppConfig',
    'foam.core.auth.LifecycleState',
    'foam.core.auth.Subject',
    'foam.core.auth.User',
    'foam.core.auth.UserNotFoundException',
    'foam.core.auth.token.Token',
    'foam.core.notification.Notification',
    'foam.core.theme.Theme',
    'foam.dao.DAO',
    'foam.lang.X',
    'foam.mlang.MLang',
    'static foam.mlang.MLang.AND',
    'static foam.mlang.MLang.EQ',
    'static foam.mlang.MLang.OR',
    'static foam.mlang.MLang.STARTS_WITH_IC',
    'foam.util.Email',
    'foam.util.Password',
    'foam.util.SafetyUtil',
    'java.util.Calendar',
    'java.util.HashMap',
    'java.util.List',
    'java.util.UUID'
  ],

  properties: [
    {
      name: 'ttl',
      value: 86400000 // 24 hours
    }
  ],

  methods: [
    {
      name: 'generateTokenWithParameters',
      javaCode: `
        String email = user.getEmail();
        if ( ! Email.isValid(email) )
          throw new RuntimeException("Invalid Email");

        String spid = null;
        Theme theme = (Theme) x.get("theme");
        if ( theme != null )
          spid = theme.getSpid();
        else {
          User anonymous = ((Subject) x.get("subject")).getUser();
          if ( anonymous != null )
            spid = anonymous.getSpid();
        }
        if ( spid == null )
          throw new RuntimeException("Invalid Email");

        User found = (User) getUserDAO().find(
          AND(
            EQ(User.LIFECYCLE_STATE, LifecycleState.ACTIVE),
            EQ(User.LOGIN_ENABLED, true),
            OR(
              EQ(User.SPID, spid),
              STARTS_WITH_IC(User.SPID, spid)
            ),
            EQ(User.EMAIL, email)
          ));
        if ( found == null )
          throw new UserNotFoundException();

        Token token = new Token();
        token.setUserId(found.getId());
        token.setExpiry(generateExpiryDate());
        token.setData(UUID.randomUUID().toString());
        token.setParameters(parameters);
        token = (Token) getTokenDAO().put(token);

        HashMap<String, Object> args = new HashMap<>();
        args.put("name", found.getLegalName());
        AppConfig appConfig = (AppConfig) x.get("appConfig");
        String url = appConfig.getUrl().replaceAll("/$", "");
        args.put("link", url +"?token=" + token.getData() + getParameter(parameters, "menu", "#reset"));
        args.put("templateSource", this.getClass().getName());
        String templateName = getParameter(parameters, "templateName", "reset-password");
        Notification notification = new Notification();
        notification.setEmailName(templateName);
        notification.setEmailArgs(args);
        notification.setBody("Password reset requested.");

        // use system context as anonymous user has no priviledges
        found.doNotify(getX(), notification);
        return true;
      `
    },
    {
      name: 'processToken',
      javaCode: `
        if ( user == null || SafetyUtil.isEmpty(user.getDesiredPassword()) ) {
          throw new RuntimeException("Password Required");
        }

        String newPassword = user.getDesiredPassword();

        Calendar calendar = Calendar.getInstance();
        DAO tokenDAO = (DAO) getTokenDAO();
        Token tokenResult = (Token) tokenDAO.find(
          MLang.AND(
            MLang.EQ(Token.PROCESSED, false),
            MLang.GT(Token.EXPIRY, calendar.getTime()),
            MLang.EQ(Token.DATA, token)
          ));
        if ( tokenResult == null )
          throw new RuntimeException("Token not found");

        // find user from token
        User userResult = (User) getUserDAO().find(tokenResult.getUserId());
        if ( userResult == null ) {
          throw new UserNotFoundException();
        }

        if ( ! Password.isValid(x, userResult, newPassword) ) {
          throw new RuntimeException("Invalid password");
        }

        // update user's password
        userResult = (User) userResult.fclone();
        userResult.setDesiredPassword(newPassword);
        user.setPasswordExpiry(null);
        userResult = (User) getUserDAO().put(userResult);

        // set token processed to true
        tokenResult = (Token) tokenResult.fclone();
        tokenResult.setProcessed(true);
        tokenDAO.put(tokenResult);

        HashMap<String, Object> args = new HashMap<>();
        args.put("name", userResult.getLegalName());
        args.put("sendTo", userResult.getEmail());
        AppConfig appConfig = (AppConfig) x.get("appConfig");
        String url = appConfig.getUrl().replaceAll("/$", "");
        args.put("link", url);
        args.put("templateSource", this.getClass().getName());
        Notification notification = new Notification();
        notification.setEmailName("password-changed");
        notification.setEmailArgs(args);
        notification.setBody("Password updated.");

        userResult.doNotify(getX(), notification);
        return true;
      `
    },
    {
      name: 'getParameter',
      type: 'String',
      args: 'Map parameters, String key, String defaultValue',
      javaCode: `
        if ( parameters != null && parameters.get(key) != null ) {
          return parameters.get(key).toString();
        }

        return defaultValue;
      `
    }
  ]
});
