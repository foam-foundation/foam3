/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.servlet',
  name: 'VirtualHostRoutingServlet',

  implements: [
    'foam.core.servlet.Servlet'
  ],

  javaImports: [
    'foam.lang.X',
    'foam.dao.DAO',
    'foam.core.app.AppConfig',
    'foam.core.jetty.HttpServer',
    'foam.core.logger.Logger',
    'foam.core.theme.Theme',
    'foam.core.theme.ThemeDomain',
    'foam.util.SafetyUtil',
    'java.io.IOException',
    'java.io.PrintWriter',
    'java.util.HashMap',
    'java.util.Map',
    'java.util.Map.Entry',
    'jakarta.servlet.http.HttpServletRequest',
    'jakarta.servlet.http.HttpServletResponse',
    'jakarta.servlet.ServletConfig',
    'jakarta.servlet.ServletException',
    'jakarta.servlet.ServletRequest',
    'jakarta.servlet.ServletResponse'
  ],

  properties: [
    {
      class: 'Map',
      name: 'customHostMapping',
      documentation: `Custom host mapping that will directly serve the index file for the specified virtual host.`
    },
    {
      class: 'String',
      name: 'defaultHost'
    },
    {
      class: 'Object',
      transient: true,
      javaType: 'ServletConfig',
      name: 'servletConfig'
    },
    {
      class: 'String',
      name: 'controller',
      value: 'foam.core.controller.ApplicationController'
    },
    {
      class: 'String',
      name: 'bootservices',
      value: ''
    },
    {
      class: "Boolean",
      name: 'html5',
      value: false
    },
    {
      class: 'Map',
      name: 'headerParameters'
    },
    {
      class: 'String',
      name: 'cspNonce',
      documentation: 'Content Security Policy nonce value for inline styles and scripts. Must match the nonce in CSP headers. When null, no nonce is applied.'
    }
  ],

  methods: [
    {
      name: 'destroy',
      type: 'Void',
      javaCode: '//noop'
    },
    {
      name: 'getServletInfo',
      type: 'String',
      javaCode: 'return "VirtualHostRoutingServlet";'
    },
    {
      name: 'init',
      type: 'Void',
      args: [ { name: 'config', javaType: 'ServletConfig' } ],
      javaCode: 'setServletConfig(config);',
      code: function() { }
    },
    {
      name: 'populateHead',
      type: 'Void',
      documentation: `Generates the index file's head content based on theme and prints it to the response writer.`,
      args: [
        { name: 'x',       javaType: 'X'},
        { name: 'theme',   javaType: 'Theme'},
        { name: 'logger',  javaType: 'Logger'},
        { name: 'out',     javaType: 'PrintWriter'},
        { name: 'request', javaType: 'ServletRequest' }
      ],
      javaCode: `
      HashMap    headConfig          = (HashMap)   theme.getHeadConfig();
      AppConfig  appConfig           = (AppConfig) x.get("appConfig");
      String     queryString         = ((HttpServletRequest)request).getQueryString();

      Boolean    customFavIconFailed = false;
      Boolean    customScriptsFailed = false;
      Boolean    customFontsFailed   = false;

      out.println("<meta charset=\\"utf-8\\"/>");
      out.println("<meta name=\\"viewport\\" content=\\"viewport-fit=cover, width=device-width, height=device-height, initial-scale=1.0, maximum-scale=1.0, user-scalable=no\\" />");
      out.print("<title>");
      out.print(theme.getAppName());
      out.println("</title>");

       // custom scripts
      if ( headConfig != null && headConfig.containsKey("customScripts") ) {
        try {
          String[] scriptTags = (String[]) headConfig.get("customScripts");
          for ( String tag : scriptTags ) {
            out.println(tag);
          }
        }
        catch ( Exception e ) {
          logger.error(e);
          customScriptsFailed = true;
        }
      }

      // default scripts
      if ( headConfig == null || ! headConfig.containsKey("customScripts") || customScriptsFailed ) {
        if ( x.get(foam.core.fs.Storage.class) instanceof foam.core.fs.ResourceStorage  ) {
          // running from jar file
          out.println("<script async fetchpriority='high' language='javascript' type='text/javascript' src='/foam-bin-"+appConfig.getVersion()+".js' ></script>");
        } else {
          // development
          out.println("<script language=\\"javascript\\" src=\\"" + appConfig.getFoamUrl() + "\\" project=\\"" + appConfig.getPom() + "\\" flags=\\"" + appConfig.getFlags() + "\\"></script>");
        }
      }

      // custom favicon
      if ( headConfig != null && headConfig.containsKey("customFavIcon") ) {
        try {
          String[] favIconTags = (String[]) headConfig.get("customFavIcon");
          for ( String tag : favIconTags ) {
            out.println(tag);
          }
        }
        catch ( Exception e ) {
          logger.error(e);
          customFavIconFailed = true;
        }
      }

      // default favicon
      if ( headConfig == null || ! headConfig.containsKey("customFavIcon") || customFavIconFailed ) {
        out.println("<link rel=\\"apple-touch-icon\\" sizes=\\"180x180\\" href=\\"/images/apple-touch-icon.png\\">");
        out.println("<link rel=\\"icon\\" type=\\"image/png\\" sizes=\\"32x32\\" href=\\"/images/favicon-32x32.png\\">");
        out.println("<link rel=\\"icon\\" type=\\"image/png\\" sizes=\\"16x16\\" href=\\"/images/favicon-16x16.png\\">");
        out.println("<link rel=\\"manifest\\" href=\\"/images/manifest.json\\">");
        out.println("<link rel=\\"mask-icon\\" href=\\"/images/safari-pinned-tab.svg\\" color=\\"#406dea\\">");
        out.println("<link rel=\\"shortcut icon\\" href=\\"/images/favicon.ico\\">");
        out.println("<meta name=\\"msapplication-config\\" content=\\"/images/browserconfig.xml\\">");
        out.println("<meta name=\\"theme-color\\" content=\\"#ffffff\\">");
      }

      // custom fonts
      if ( headConfig != null && headConfig.containsKey("customFonts") ) {
        try {
          String[] fontTags = (String[]) headConfig.get("customFonts");
          for ( String tag : fontTags ) {
            out.println(tag);
          }
        }
        catch ( Exception e ) {
          logger.error(e);
          customFontsFailed = true;
        }
      }
      // default fonts
      if ( headConfig == null || ! headConfig.containsKey("customFonts") || customFontsFailed ) {
        out.println("""
          <link rel="preconnect" href="https://fonts.gstatic.com/">
          <link href="https://fonts.googleapis.com/css2?family=Source+Sans+Pro:wght@400;500;600;700&display=swap" rel="preload" as="style" crossorigin="anonymous">
          <link href="https://fonts.googleapis.com/css2?family=Source+Sans+Pro:wght@400;500;600;700&display=swap" rel="stylesheet" crossorigin="anonymous">""");
      }

      // Loading screen styles
      String nonce = getCspNonce();
      if ( ! SafetyUtil.isEmpty(nonce) ) {
        out.println("<meta name=\\"csp-nonce\\" content=\\"" + nonce + "\\">");
        out.println("<style nonce=\\"" + nonce + "\\">");
      } else {
        out.println("<style>");
      }
      out.println("""
        body {
          margin: 0;
        }
        #loading-container {
          background: white;
          color: black;
          text-align: center;
          height: 100%;
          display: flex;
          vertical-align: middle;
          width: 100%;
          flex-direction: column;
          justify-content: center;
          align-items: center;
        }
        #loading-logo {
          max-width: 400px;
        }
        #loading-text {
          font-family: system-ui, sans-serif;
        }
        @media (prefers-color-scheme: dark) {
          .allowVariants#loading-container {
            background: black;
            color: white;
          }
        }
        </style>""");
      `,
    },
    {
      name: 'service',
      type: 'Void',
      args: [ { name: 'request',  javaType: 'ServletRequest' },
              { name: 'response', javaType: 'ServletResponse' } ],
      javaThrows: [ 'ServletException', 'IOException' ],
      javaCode: `
        String vhost = request.getServerName();

        if ( getCustomHostMapping().containsKey(vhost) ) {
          request.getRequestDispatcher((String) getCustomHostMapping().get(vhost)).forward(request, response);
          return;
        }

        HttpServer server         = (HttpServer) this.getServletConfig().getServletContext().getAttribute("httpServer");
        X          x              = (X)          this.getServletConfig().getServletContext().getAttribute("X");
        DAO        themeDomainDAO = (DAO)        x.get("themeDomainDAO");
        DAO        themeDAO       = (DAO)        x.get("themeDAO");
        Logger     logger         = (Logger)     x.get("logger");

        ThemeDomain themeDomain = (ThemeDomain) themeDomainDAO.find(vhost);
        if ( themeDomain == null ) {
          themeDomain = (ThemeDomain) themeDomainDAO.find(getDefaultHost());
          if ( themeDomain == null ) {
            themeDomain = (ThemeDomain) themeDomainDAO.find("localhost");
            logger.debug("No theme domain found for default host " + getDefaultHost()+". Falling back to 'localhost'");
          }
        }

        Theme theme = (Theme) themeDAO.find(themeDomain.getTheme());
        if ( theme == null ) {
          logger.error("No theme found for domain " + themeDomain);
          theme = new Theme(x);
        }

        Boolean useVariants = theme.getUseVariants();

        response.setContentType("text/html; charset=UTF-8");
        response.setCharacterEncoding("UTF-8");

        Map<String, String> params = getHeaderParameters();
        for ( Map.Entry<String, String> entry : params.entrySet() ) {
          ((HttpServletResponse) response).setHeader(entry.getKey().toString(), (String) entry.getValue().toString());
        }

        PrintWriter out = response.getWriter();
        if (getHtml5()) {
            out.println("<!DOCTYPE html>"); // strict mode
        } else {
            out.println("<!DOCTYPE>"); // quirk mode?
        }

        out.println("<html lang=\\"en\\">");
        out.println("<head>");

        this.populateHead(x, theme, logger, out, request);

        out.println("</head>");
        out.println("<body>");

        out.println("<!-- Instantiate FOAM Application Controller -->");
        out.println("<!-- App Color Scheme, Logo, & Web App Name -->");
        String controller = ! foam.util.SafetyUtil.isEmpty(theme.getAppController()) ? theme.getAppController() : getController();
        String boot = ! foam.util.SafetyUtil.isEmpty(theme.getBootservices()) ? theme.getBootservices() : getBootservices();
        out.print("<foam\\nclass=\\""+ controller +"\\"\\nid=\\"ctrl\\"\\nwebApp=\\"");
        out.print(theme.getAppName());
        out.println("\\" bootservices=\\"" + boot + "\\">");

        out.print("<div id=\\"loading-container\\"");
        if ( useVariants ) {
          out.print("class=\\"allowVariants\\"");
        }
        out.println(" >");

        out.print("<img id=\\"loading-logo\\" src=\\"");
        out.print(theme.getLargeLogo());
        out.println("\\"></img>");
        out.print("<h3 id=\\"loading-text\\">Loading....</h3>");
        out.println("</div>");
        out.println("</foam>");

        out.println("</body>");
        out.println("</html>");
      `
    }
  ]
});
