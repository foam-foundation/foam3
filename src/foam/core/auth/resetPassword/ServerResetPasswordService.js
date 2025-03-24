/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.auth.resetPassword',
  name: 'ServerResetPasswordService',
  implements: [ 'foam.core.auth.resetPassword.ResetPasswordService' ],

  javaImports: [
    'foam.dao.ArraySink',
    'foam.dao.DAO',
    'foam.core.auth.AuthorizationException',
    'foam.core.auth.DuplicateEmailException',
    'foam.core.auth.LifecycleState',
    'foam.core.auth.email.EmailVerificationService',
    'foam.core.auth.Subject',
    'foam.core.auth.User',
    'foam.core.auth.UserNotFoundException',
    'foam.core.auth.UserPasswordHashingDAO',
    'foam.core.logger.Logger',
    'foam.mlang.predicate.Predicate',
    'foam.util.SafetyUtil',
    'java.util.List',
    'static foam.mlang.MLang.*'
  ],

  methods: [
    {
      name: 'resetPasswordByCode',
      args: 'Context x, String identifier, String userName',
      javaCode: `
        EmailVerificationService service = (EmailVerificationService) x.get("emailVerificationService");
        service.verifyByCode(x, identifier, userName, "resetPasswordByCode");
      `
    },
    {
      name: 'findUser',
      args: 'Context x, String identifier, String userName',
      type: 'foam.core.auth.User',
      javaCode: `
        Predicate identifierPredicate = SafetyUtil.isEmpty(userName) ? 
          OR(EQ(User.EMAIL, identifier), EQ(User.USER_NAME, identifier)) :
          AND(EQ(User.EMAIL, identifier), EQ(User.USER_NAME, userName));
        DAO userDAO = ((DAO) x.get("localUserDAO")).where(
          AND(
            identifierPredicate,
            EQ(User.LIFECYCLE_STATE, LifecycleState.ACTIVE),
            EQ(User.LOGIN_ENABLED, true),
            EQ(User.SPID, x.get("spid"))
          ))
          .limit(2);
        List list = ((ArraySink) userDAO.select(new ArraySink())).getArray();
        if ( list == null || list.size() == 0 ) {
          throw new UserNotFoundException();
        }

        if ( list.size() > 1 ) {
          ((Logger) x.get("logger")).warning(this.getClass().getSimpleName(), "verifyByCode", "multiple valid users found for", identifier);

          if ( SafetyUtil.isEmpty(userName) ) throw new DuplicateEmailException();

          list = ((ArraySink) userDAO
            .where(EQ(User.USER_NAME, userName))
            .select(new ArraySink()))
            .getArray();
          if ( list == null || list.size() == 0 ) {
            throw new UserNotFoundException();
          }
        }
        return (User) list.get(0);
      `
    },
    {
      name: 'resetPassword',
      javaCode: `
        EmailVerificationService service = (EmailVerificationService) x.get("emailVerificationService");
        if ( service.verifyUserEmail(x, newPasswordObj.getEmail(), newPasswordObj.getUserName(), newPasswordObj.getResetPasswordCode(), false) ) {
          String desiredPassword = newPasswordObj.getNewPassword();

          User systemUser = ((Subject) getX().get("subject")).getUser();
          Subject subject = new Subject.Builder(x).setUser(systemUser).build();
          x = x.put("subject", subject);

          User user = findUser(x, newPasswordObj.getEmail(), newPasswordObj.getUserName());
          user = (User) user.fclone();
          user.setDesiredPassword(desiredPassword);
          ((DAO) x.get("localUserDAO")).put_(x, user);
        } else {
          throw new AuthorizationException("Email verification failed");
        }
      `
    }
  ]
});
