/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.auth.test',
  name: 'ServiceProviderAuthorizerTest',
  extends: 'foam.core.test.Test',

  javaImports: [
    'foam.lang.X',
    'foam.dao.DAO',
    'foam.core.auth.AuthorizationException',
    'foam.core.auth.User',
    'foam.core.session.Session',
    'foam.core.auth.ServiceProvider'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        User nonAdminUser = new User();
        nonAdminUser.setGroup("test");
        nonAdminUser.setSpid("test");
        nonAdminUser.setUserName(this.getClass().getSimpleName());
        nonAdminUser.setFirstName(nonAdminUser.getUserName());
        nonAdminUser.setLastName(nonAdminUser.getUserName());
        nonAdminUser.setEmail(nonAdminUser.getUserName()+"@test.com");

        DAO userDAO = (DAO) x.get("localUserDAO");
        DAO serviceProviderDAO = (DAO) x.get("serviceProviderDAO");
        ServiceProvider serviceProvider = new ServiceProvider.Builder(x).setId("testspid").build();
        boolean threw;

        nonAdminUser = (User) userDAO.put(nonAdminUser);

        Session nonAdminUserSession = new Session.Builder(x)
          .setUserId(nonAdminUser.getId())
          .build();

        X nonAdminUserContext = nonAdminUserSession.applyTo(x);

        threw = false;
        try {
          serviceProvider = (ServiceProvider) serviceProviderDAO.inX(x).put(serviceProvider);
        } catch ( AuthorizationException e ) {
          threw = true;
        }
        test(! threw, "Admin user can add serviceProvider");

        threw = false;
        try {
           serviceProviderDAO.inX(x).find(serviceProvider);
        } catch ( AuthorizationException e ) {
           threw = true;
        }
        test(! threw, "Admin user can view serviceProvider");

        threw = false;
        try {
          serviceProviderDAO.inX(x).put(serviceProvider);
        } catch ( AuthorizationException e ) {
          threw = true;
        }
        test(! threw, "Admin user can update serviceProvider");

        threw = false;
        try {
          serviceProviderDAO.inX(x).remove(serviceProvider);
        } catch ( AuthorizationException e ) {
          threw = true;
        }
        test(! threw, "Admin user can remove serviceProvider");

        serviceProvider = (ServiceProvider) serviceProviderDAO.inX(x).put(serviceProvider);

        threw = false;
        try {
          serviceProviderDAO.inX(nonAdminUserContext).put(serviceProvider);
        } catch ( AuthorizationException e ) {
          threw = true;
        }
        test(threw, "Non admin user can't add serviceProvider");

        test(serviceProviderDAO.inX(nonAdminUserContext).find(serviceProvider) == null, "Non admin user can't view serviceProvider");

        threw = false;
        try {
          serviceProviderDAO.inX(nonAdminUserContext).put(serviceProvider);
        } catch ( AuthorizationException e ) {
          threw = true;
        }
        test(threw, "Non admin user can't update serviceProvider");

        threw = false;
        try {
          serviceProviderDAO.inX(nonAdminUserContext).remove(serviceProvider);
        } catch ( AuthorizationException e ) {
          threw = true;
        }
        test(threw, "Non admin user can't remove serviceProvider");

        serviceProviderDAO.inX(x).remove(serviceProvider);
      `
    }
  ]
})
