/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.theme',
  name: 'Themes',

  documentation: 'Support methods for Theme',

  implements: [
    'foam.mlang.Expressions',
    'foam.core.theme.ThemeService'
  ],

  requires: [
    'foam.core.theme.ThemeDomain'
  ],

  imports: [
    'themeDAO',
    'themeDomainDAO'
  ],

  javaImports: [
    'foam.dao.DAO',
    'foam.mlang.MLang',
    'foam.core.app.AppConfig',
    'foam.core.auth.Group',
    'foam.core.auth.Subject',
    'foam.core.auth.User',
    'foam.core.logger.Logger',
    'foam.util.SafetyUtil',
    'foam.util.Arrays',
    'jakarta.servlet.http.HttpServletRequest',
    'org.eclipse.jetty.util.URIUtil'
  ],

  methods: [
    {
      documentation: `Acquire theme through users spid.
Later themes:
1. domain
2. group
3. user`,
      name: 'findTheme',
      type: 'foam.core.theme.Theme',
      args: 'Context x',
      async: true,
      code: async function(x) {
        var theme;
        var themeDomain;
        var domain = window && window.location.hostname || 'localhost';
        var user = x.subject.user;
        if ( domain ) {
          themeDomain = await this.themeDomainDAO.find(domain);
          if ( ! themeDomain && 'localhost' != domain ) {
            themeDomain = await this.themeDomainDAO.find('localhost');
          }
          if ( themeDomain ) {
            var predicate = this.AND(
              this.EQ(foam.core.theme.Theme.ID, themeDomain.theme),
              this.EQ(foam.core.theme.Theme.ENABLED, true)
            );
            theme = await this.themeDAO.find(predicate);
          }
        }

        if ( user && ( ! theme || domain !== themeDomain.id || user.spid !== theme.spid ) ) {
          var spid = user.spid;
          while ( spid ) {
            theme = await this.themeDAO.find(
              this.AND(
                this.EQ(foam.core.theme.Theme.SPID, spid),
                this.EQ(foam.core.theme.Theme.ENABLED, true)));
            if ( theme ) break;

            var pos = spid.lastIndexOf('.');
            spid = spid.substring(0, pos > 0 ? pos : 0);
          }
        }

        if ( ! theme ) {
          console && console.warn('Theme not found', domain);
        }

        var group = x.group;
        // Turn off group theme merging until fixed
        if ( false && user && group ) { // non-null when logged in.
          group           = group || await user.group$find;
          var defaultMenu = group && group.defaultMenu;
          while ( group ) {
            var groupTheme = await group.theme$find;
            if ( groupTheme ) {
              if ( theme && ! foam.util.equals(theme, groupTheme) ) {
                theme = theme.merge(groupTheme);
              } else {
                theme = groupTheme;
              }
              break;
            }
            group = await group.parent$find;
          }

          if ( defaultMenu ) {
            theme.defaultMenu = defaultMenu.concat(theme.defaultMenu);
          }

          var userTheme = await user.theme$find;
          if ( userTheme && ! foam.util.equals(theme, userTheme) ) {
            theme = theme && theme.merge(userTheme) || userTheme;
          }
        }

        if ( theme ) {
          if ( theme.customRefinement ) await x.__subContext__.classloader.load(theme.customRefinement, []);
          if ( theme.registrations ) {
            theme.registrations.forEach(r => {
              x.__subContext__.register(this.__subContext__.lookup(r.className), r.targetName);
            });
          }
          return theme;
        }

        return foam.core.theme.Theme.create({name: 'foam', appName: 'FOAM'});
      },
      javaCode: `
      // TODO:  cache domain/theme and update on ThemeDAO changes.
      Logger             logger   = (Logger) x.get("logger");
      DAO                themeDAO = ((DAO) x.get("themeDAO"));
      Theme              theme    = null;
      ThemeDomain        td       = null;
      String             domain   = null;
      User               user     = ((Subject) x.get("subject")).getUser();
      HttpServletRequest req      = x.get(HttpServletRequest.class);
      final boolean      DEBUG    = false;

      if ( req != null ) {
        domain = req.getServerName();
        if ( DEBUG ) logger.debug("Themes", "domain", domain);
      }

      // Find theme from themeDomain via domain
      if ( domain != null ) {
        var themeDomainDAO = (DAO) x.get("themeDomainDAO");

        td = (ThemeDomain) themeDomainDAO.find(domain);
        if ( DEBUG && td == null ) {
           logger.debug("Themes", "ThemeDomain not found", domain);
        }
        if ( td == null && ! "localhost".equals(domain) ) {
          td = (ThemeDomain) themeDomainDAO.find("localhost");
          if ( DEBUG && td == null ) {
            logger.debug("Themes", "ThemeDomain not found", "localhost");
          }
        }
        if ( td != null ) {
          if ( DEBUG ) logger.debug("Themes", "ThemeDomain found", domain, td.getId());
          theme = (Theme) themeDAO.find(
            MLang.AND(
              MLang.EQ(Theme.ID, td.getTheme()),
              MLang.EQ(Theme.ENABLED, true)
            ));
          if ( DEBUG && theme == null ) {
            logger.debug("Themes", "Theme not found", td.getTheme());
          }
          if ( theme != null ) {
            if ( DEBUG ) logger.debug("Themes", "Theme found", domain, theme.getId());
            theme = (Theme) theme.fclone();
          }
        }
      }

      Theme originalTheme = theme;

      // Find theme from user via SPID
      if ( user != null &&
           user.getId() != User.SYSTEM_USER_ID &&
           ( theme == null || ! td.getId().equals(domain) || ! user.getSpid().equals(theme.getSpid()) )
      ) {
        var spid = user.getSpid();

        while ( ! SafetyUtil.isEmpty(spid) ) {
          if ( DEBUG ) logger.debug("Themes", "Finding theme by spid", spid);

          theme = (Theme) themeDAO.find(
            MLang.AND(
              MLang.EQ(Theme.SPID,    spid),
              MLang.EQ(Theme.ENABLED, true)
            )
          );
          if ( theme != null ) {
            if ( DEBUG ) logger.debug("Themes", "Found for spid", spid);
            theme = (Theme) theme.fclone();
            break;
          }

          var pos = spid.lastIndexOf(".");
          spid = spid.substring(0, pos > 0 ? pos : 0);
        }
      }

      if ( theme == null ) theme = originalTheme;

      if ( theme == null ) {
        if ( DEBUG ) logger.debug("Themes", "fallback");
        theme = (Theme) themeDAO.find(
          MLang.AND(
            MLang.EQ(Theme.NAME, "foam")
          ));
        if ( theme == null ) {
          theme = new Theme.Builder(x).setName("foam").setAppName("FOAM").build();
        }
        if ( theme != null ) {
          theme = (Theme) theme.fclone();
        }
      }

      // Merge the theme with group and user themes
      // Turn off group theme merging until fixed
      Group group = null;
      if ( false && user != null ) {
        DAO groupDAO = (DAO) x.get("groupDAO");
        group = user.findGroup(x);
        String[] defaultMenu = group != null ? group.getDefaultMenu() : null;
        while ( group != null ) {
          Theme groupTheme = group.findTheme(x);
          if ( groupTheme != null && ! SafetyUtil.equals(theme, groupTheme) ) {
            theme = theme.merge(groupTheme);
            break;
          }
          group = (Group) groupDAO.find(group.getParent());
        }

        // Use default menu from user group if present
        if ( defaultMenu != null && defaultMenu.length != 0 ) {
          String[] bothDefaults = Arrays.append(defaultMenu, theme.getDefaultMenu());
          theme.setDefaultMenu(bothDefaults);
        }

        Theme userTheme = user.findTheme(x);
        if ( userTheme != null && ! SafetyUtil.equals(theme, userTheme) ) {
          theme = theme.merge(userTheme);
        }
      }

      // test appConfig url, if not default, set to domain
      AppConfig appConfig = theme.getAppConfig();
      if ( appConfig == null ) {
        appConfig = new AppConfig();
        theme.setAppConfig(appConfig);
      }

      if ( ! AppConfig.URL.isSet(appConfig) ||
           // isDefaultValue does not test the models default property
           // AppConfig.URL.isDefaultValue(appConfig) )  {
           SafetyUtil.compare(appConfig.getUrl(), "http://localhost") == 0 ) {
        if ( req != null ) {
          appConfig.setUrl(URIUtil.newURIBuilder(req.getScheme(), req.getServerName(), req.getServerPort()).toString());
        } else if ( ! SafetyUtil.isEmpty(domain) ) {
          appConfig.setUrl("https://"+domain);
        }
      }

      if ( DEBUG ) logger.debug("Themes", "domain", domain, "user", (user != null ? user.getId() : "null"), "group", (group != null ? group.getId() : "null") , "theme", theme.getId());

      return theme;
      `
    }
  ]
});
