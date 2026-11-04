/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.auth.test',
  name: 'SessionFinishedRequestTest',
  extends: 'foam.core.test.Test',

  documentation: `
  Background work started from a web request keeps the
  HttpServletRequest in its context after the response is sent. Jetty 12 ee11
  throws a NullPointerException on every read of such a finished request.
  Auth.sudo must still return a context, as if there were no request.
  `,

  javaImports: [
    'foam.core.auth.User',
    'foam.dao.DAO',
    'foam.lang.X',
    'foam.util.Auth',
    'jakarta.servlet.http.HttpServletRequest',
    'java.lang.reflect.Proxy'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        DAO userDAO = (DAO) x.get("userDAO");
        User user = new User();
        user.setUserName("SessionFinishedRequestTest");
        user.setFirstName("Finished");
        user.setLastName("Request");
        user.setSpid("test");
        user.setGroup("test");
        user.setEmail("sessionfinishedrequest@foamdev.com");
        user.setEmailVerified(true);
        user.setLoginEnabled(true);
        user = (User) userDAO.put(user);

        // Every read throws, as on a finished request under Jetty 12 ee11.
        HttpServletRequest finished = (HttpServletRequest) Proxy.newProxyInstance(
          HttpServletRequest.class.getClassLoader(),
          new Class[] { HttpServletRequest.class },
          (proxy, method, args) -> { throw new NullPointerException("finished request: " + method.getName()); });

        X result = null;
        try {
          result = Auth.sudo(x.put(HttpServletRequest.class, finished), user);
        } catch ( Throwable t ) {
          test(false, "Auth.sudo must not throw for a finished request: " + t);
        }
        test(result != null, "Auth.sudo returns a context for a finished request");
      `
    }
  ]
});
