/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.auth',
  name: 'PreventDuplicateEmailLoginService',
  extends: 'foam.core.auth.ProxyUniqueUserService',
  flags: ['java'],

  documentation: 'Prevent users from logging in with duplicate email',

  javaImports: [
    'foam.dao.ArraySink',
    'foam.dao.DAO',
    'foam.mlang.predicate.Predicate',
    'foam.mlang.sink.Count',
    'foam.core.auth.User',
    'foam.core.auth.DuplicateEmailException',
    'foam.core.auth.LifecycleState',
    'foam.core.theme.Theme',
    'foam.core.theme.Themes',
    'static foam.mlang.MLang.*'
  ],

  methods: [
    {
      name: 'getUser',
      javaCode: `
        DAO userDAO = ((DAO) getX().get("localUserUserDAO")).where(
          AND(
            OR(
              EQ(User.EMAIL, identifier.toLowerCase()),
              EQ(User.USER_NAME, identifier)
            ),
            NEQ(User.LIFECYCLE_STATE, LifecycleState.DELETED)
          )
        );

        // TODO: this needs to be predicate on the capability which imposes unique emails.

        // Here, we check to see if there exists one and only one user under the given identifier
        // under the theme spid. If so, simply return the user.
        // If there is more then one user, it is wrong and we return null
        String themeSpid = ((Theme) ((Themes) x.get("themes")).findTheme(x)).getSpid();
        Predicate spidPredicate = EQ(User.SPID, themeSpid);
        long userCount = ((Count) userDAO.where(spidPredicate).select(new Count())).getValue();
        if ( userCount > 1 ) {
          var duplicateEmailException = new DuplicateEmailException();
          duplicateEmailException.setExceptionMessage("Please enter username");
          throw duplicateEmailException;
        }
        if ( userCount == 1 ) return (User) userDAO.find(spidPredicate);

        // Here, we check if there is a user under the given identifier under the superspid since the
        // localuseruserdao given here should be filtered by spid == themeSpid || spid == superspid and we did not
        // find a user under the theme spid.
        // this check is needed to fix the issue where having two users under the same identifier belonging to different spids
        // where one of those spid is a superspid results in the system mistaking it as a duplicate user due to the filter on
        // localuseruserdao. So we check each case separately
        userCount = ((Count) userDAO.select(new Count())).getValue();
        if ( userCount != 1 ) return null;
        return (User) userDAO.find(TRUE);
      `
    }
  ]
});
