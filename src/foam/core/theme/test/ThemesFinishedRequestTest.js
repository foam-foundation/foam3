/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.theme.test',
  name: 'ThemesFinishedRequestTest',
  extends: 'foam.core.test.Test',

  documentation: `
  Background work started from a web request (an intake run) keeps the
  HttpServletRequest in its context after the response is sent. Jetty 12 ee11
  throws a NullPointerException from getServerName() on such a finished
  request, which crashed Themes.findTheme when the work switched user.
  findTheme must treat that request as absent and still return a theme.
  `,

  javaImports: [
    'foam.core.auth.Subject',
    'foam.core.theme.Theme',
    'foam.core.theme.ThemeDomain',
    'foam.core.theme.Themes',
    'foam.dao.DAO',
    'foam.dao.MDAO',
    'foam.lang.X',
    'jakarta.servlet.http.HttpServletRequest',
    'java.lang.reflect.Proxy'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        DAO themeDAO  = new MDAO(Theme.getOwnClassInfo());
        DAO domainDAO = new MDAO(ThemeDomain.getOwnClassInfo());
        themeDAO.put(new Theme.Builder(x).setId("custom").setName("custom").build());
        domainDAO.put(new ThemeDomain.Builder(x).setId("localhost").setTheme("custom").build());

        X base = x
          .put("themeDAO", themeDAO)
          .put("themeDomainDAO", domainDAO)
          .put("subject", new Subject());

        // No request: no domain, so the fallback "foam" theme.
        Theme noRequest = new Themes().findTheme(base);
        test(noRequest != null, "theme found without a request");
        expect(noRequest.getName(), "foam", "no request falls back to the foam theme");

        // Finished request: every read throws, as on Jetty 12 ee11.
        HttpServletRequest finished = (HttpServletRequest) Proxy.newProxyInstance(
          HttpServletRequest.class.getClassLoader(),
          new Class[] { HttpServletRequest.class },
          (proxy, method, args) -> { throw new NullPointerException("finished request: " + method.getName()); });
        Theme afterFinished = null;
        try {
          afterFinished = new Themes().findTheme(base.put(HttpServletRequest.class, finished));
        } catch ( Throwable t ) {
          test(false, "findTheme must not throw for a finished request: " + t);
        }
        test(afterFinished != null, "theme found for a finished request");
        if ( afterFinished != null ) expect(afterFinished.getName(), noRequest.getName(), "finished request gives the same theme as no request");

        // Live request: unchanged path, the domain picks its theme.
        HttpServletRequest live = (HttpServletRequest) Proxy.newProxyInstance(
          HttpServletRequest.class.getClassLoader(),
          new Class[] { HttpServletRequest.class },
          (proxy, method, args) -> {
            switch ( method.getName() ) {
              case "getServerName": return "localhost";
              case "getScheme":     return "http";
              case "getServerPort": return 8080;
              default:              return null;
            }
          });
        Theme liveTheme = new Themes().findTheme(base.put(HttpServletRequest.class, live));
        test(liveTheme != null, "theme found for a live request");
        if ( liveTheme != null ) expect(liveTheme.getName(), "custom", "live request resolves the theme of its domain");
      `
    }
  ]
});
