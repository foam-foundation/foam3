/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.session',
  name: 'Session',

  implements: [
    'foam.core.auth.CreatedAware',
    'foam.core.auth.CreatedByAware',
    'foam.core.medusa.Clusterable'
  ],

  javaImports: [
    'foam.lang.OrX',
    'foam.lang.X',
    'foam.dao.DAO',
    'foam.log.LogLevel',
    'foam.core.app.AppConfig',
    'foam.core.auth.*',
    'foam.core.auth.Subject',
    'foam.core.boot.CSpec',
    'foam.core.crunch.ServerCrunchService',
    'foam.core.er.EventRecord',
    'foam.core.logger.Logger',
    'foam.core.logger.Loggers',
    'foam.core.logger.PrefixLogger',
    'foam.core.pm.PM',
    'foam.core.theme.Theme',
    'foam.core.theme.ThemeDomain',
    'foam.core.theme.Themes',
    'foam.util.SafetyUtil',
    'java.util.Date',
    'jakarta.servlet.http.HttpServletRequest',
    'org.eclipse.jetty.server.Request',
    'static foam.mlang.MLang.*'
  ],

  tableColumns: [
    'userId',
    'agentId',
    'created',
    'lastUsed',
    'ttl',
    'uses',
    'remoteHost'
  ],

  properties: [
    {
      class: 'String',
      name: 'id',
      includeInDigest: true,
      visibility: 'RO'
    },
    {
      class: 'Reference',
      of: 'foam.core.auth.User',
      name: 'userId',
      // user being acted as for authorization purposes, may be different than
      // the real-user (set in agentId)
      includeInDigest: true,
      tableCellFormatter: function(value, obj) {
        this.add(value);
        this.__context__.userDAO.find(value).then(function(user) {
          this.add(' ', user && user.toSummary());
        }.bind(this));
      },
      required: true,
      updateVisibility: 'RO'
    },
    {
      class: 'Reference',
      of: 'foam.core.auth.User',
      name: 'agentId',
      // real user
      includeInDigest: true,
      tableCellFormatter: function(value, obj) {
        if ( ! value ) return;
        this.add(value);
        this.__context__.userDAO.find(value).then(function(user) {
          this.add(' ', user.toSummary());
        }.bind(this));
      },
      visibility: 'RO'
    },
    {
      class: 'DateTime',
      name: 'created',
      visibility: 'RO',
      storageOptional: true
    },
    {
      class: 'Reference',
      of: 'foam.core.auth.User',
      name: 'createdBy',
      visibility: 'RO',
      storageOptional: true
    },
    {
      class: 'Reference',
      of: 'foam.core.auth.User',
      name: 'createdByAgent',
      visibility: 'RO',
      storageOptional: true
    },
    {
      class: 'DateTime',
      name: 'lastUsed',
      visibility: 'RO',
      storageTransient: true,
      clusterTransient: true
    },
    {
      class: 'Duration',
      name: 'ttl',
      label: 'TTL',
      documentation: 'The "time to live" of the session. The amount of time in milliseconds that the session should be kept alive after its last use before being destroyed. Must be a positive value or zero.',
      value: 28800000, // 1000 * 60 * 60 * 8 = number of milliseconds in 8 hours
      includeInDigest: true,
      tableWidth: 70,
      validationPredicates: [
        {
          query: 'ttl>=0',
          errorString: 'TTL must be 0 or greater.'
        }
      ]
    },
    {
      class: 'Long',
      name: 'uses',
      tableWidth: 70,
      storageTransient: true,
      clusterTransient: true
    },
    {
      class: 'String',
      name: 'remoteHost',
      includeInDigest: true,
      visibility: 'RO',
      tableWidth: 120
    },
    {
      documentation: `Restrict access to long TTL session to particular IP address range.

@see https://en.wikipedia.org/wiki/Classless_Inter-Domain_Routing
List entries are of the form: 172.0.0.0/24 - this would restrict logins to the 172 network.`,
      class: 'FObjectArray',
      of: 'foam.net.CIDR',
      name: 'cidrWhiteList',
      includeInDigest: true
    },
    {
      class: 'Object',
      name: 'applyContext',
      javaType: 'foam.lang.X',
      visibility: 'HIDDEN',
      javaCompare: 'return 0;',
      transient: true,
      networkTransient: true,
      clusterTransient: true
    },
    {
      class: 'Object',
      name: 'context',
      javaType: 'foam.lang.X',
      javaFactory: 'return reset(getX());',
      visibility: 'HIDDEN',
      javaCompare: 'return 0;',
      transient: true,
      networkTransient: true,
      clusterTransient: true
    },
    {
      class: 'Boolean',
      name: 'twoFactorSuccess',
      visibility: 'HIDDEN',
      value: false,
      networkTransient: true
    },
    {
      class: 'Boolean',
      name: 'clusterable',
      value: true,
      visibility: 'HIDDEN',
      storageTransient: true,
      clusterTransient: true
    }
  ],

  methods: [
    // Disable freezing so that Sessions can be mutated while
    // in the SessionDAO. Do not disable cloning else sessions
    // are not saved/clustered.
    {
      name: 'freeze',
      type: 'foam.lang.FObject',
      javaCode: ' return this; '
    },
    {
      name: 'touch',
      documentation: 'Called when session used to track usage statistics.',
      javaCode: `
        synchronized ( this ) {
          setLastUsed(new Date());
          setUses(getUses()+1);
        }
      `
    },
    {
      name: 'validateRemoteHost',
      args: 'Context x',
      javaThrows: ['foam.lang.ValidationException'],
      javaCode: `
      String remoteIp = foam.net.IPSupport.instance().getRemoteIp(x);
      foam.net.CIDR[] cidrs = getCidrWhiteList();
      if ( remoteIp == null ||
           SafetyUtil.isEmpty(getRemoteHost()) ||
           SafetyUtil.equals(getRemoteHost(), remoteIp) ||
           cidrs == null ||
           cidrs.length == 0 ) {
        return;
      }

      // Check whitelisted IP addresses
      for ( foam.net.CIDR cidr : cidrs ) {
        try {
          if ( cidr.inRange(x, remoteIp) ) {
            return;
          }
        } catch (java.net.UnknownHostException e) {
          ((foam.core.logger.Logger) x.get("logger")).warning(this.getClass().getSimpleName(), "validateRemoteHost", remoteIp, e.getMessage());
        }
      }

      // Do not allow IP to change if not in whitelist
      if ( ! SafetyUtil.isEmpty(getRemoteHost()) &&
           ! SafetyUtil.equals(getRemoteHost(), remoteIp) ) {
        User user = findUserId(x);
        ((DAO) x.get("eventRecordDAO")).put(new EventRecord(x, "Session", "IP change detected", (user != null ? user.getLegalName() : ""), null, getRemoteHost()+" -> "+remoteIp, LogLevel.WARN, null));
        throw new foam.lang.ValidationException("IP changed");
      }
      `
    },
    {
      name: 'reset',
      type: 'Context',
      args: 'Context x',
      documentation: `
        Return a subcontext of the given context where the security-relevant
        entries have been reset to their empty default values.
      `,
      javaCode: `
      Subject subject = new Subject.Builder(x).setUser(null).build();
        return x
          .put(Session.class,      this)
          .put("spid",             null)
          .put("subject",          subject)
          .put("group",            null)
          .put("twoFactorSuccess", false)
          .put("ip",               null)
          .put("userAgent",        null);
      `
    },
    {
      name: 'applyTo',
      type: 'Context',
      args: 'Context x',
      documentation: `
        Returns a subcontext of the given context with the user, group, and
        other information relevant to this session filled in if it's appropriate
        to do so.
      `,
      javaCode: `
      AppConfig appConfig = (AppConfig) ((AppConfig) x.get("appConfig")).fclone();

      // We null out the security-relevant entries in the context since we
      // don't want whatever was there before to leak through, especially
      // since the system context (which has full admin privileges) is often
      // used as the argument to this method.
      if ( getUserId() <= 1 ) {
        X rtn = reset(x);

        HttpServletRequest req = x.get(HttpServletRequest.class);
        if ( req == null ) {
          // null during test runs
          return rtn;
        }

        Theme theme = ((Themes) x.get("themes")).findTheme(x);
        rtn = rtn.put("theme", theme);

        // if there is no user, set spid to the theme spid so that spid restrictions can be applied
        rtn = rtn.put("spid", theme.getSpid());

        AppConfig themeAppConfig = theme.getAppConfig();
        if ( themeAppConfig != null ) {
          appConfig.copyFrom(themeAppConfig);
        }
        appConfig = appConfig.configure(rtn, null);

        rtn = rtn.put("appConfig", appConfig);
        rtn = rtn.put(foam.core.auth.LocaleSupport.CONTEXT_KEY, foam.core.auth.LocaleSupport.instance().findLanguageLocale(rtn));
        rtn = rtn.put("logger", foam.core.logger.Loggers.logger(new OrX(x, rtn), true));

        return rtn;
      }

      X rtn = getApplyContext();

      validate(x);

      DAO localUserDAO  = (DAO) x.get("localUserDAO");
      DAO localGroupDAO = (DAO) x.get("localGroupDAO");
      AuthService auth  = (AuthService) x.get("auth");
      User user         = getUserId() == 0 ? null : (User) localUserDAO.find(getUserId());
      if ( getUserId() > 0 ) checkUserEnabled(x, user);
      User agent        = getAgentId() == 0 ? null : (User) localUserDAO.find(getAgentId());
      if ( getAgentId() > 0 ) checkUserEnabled(x, agent);

      User subjectUser  = null;
      User subjectAgent = null;
      if ( rtn != null ) {
        Subject subject = (Subject) rtn.get("subject");
        if ( subject != null ) {
          subjectUser  = subject.getUser();
          subjectAgent = subject.getRealUser();
        }
      }
      if ( rtn == null ||
           user == null ||
           ( subjectUser != null &&
             subjectUser.getId() != user.getId() ) ||
           ( agent != null && subjectAgent != null &&
             subjectAgent.getId() != agent.getId() ) ||
           ( subjectUser != null &&
             ! user.equals(subjectUser) ||
             agent != null && subjectAgent != null &&
             ! agent.equals(subjectAgent) ) ) {

        PM pm = PM.create(x, "Session", "applyTo", "create");

        // create a temp session with the user/agent from the old session context to check if it was an anonymous session
        // and set the wasAnonymous boolean accordingly
        boolean wasAnonymous = false;
        if ( subjectUser != null ) {
          ServiceProvider sp = (ServiceProvider) subjectUser.findSpid(x);
          wasAnonymous = sp != null && sp.getAnonymousUser() == subjectUser.getId();
        }

        rtn = new OrX(reset(x));

        Subject subject = null;
        if ( user != null || agent != null ) {
          subject = new Subject();
          subject.setUser(agent);
          subject.setUser(user);
          rtn = rtn
            .put("subject", subject)
            .put("spid",    subject.getUser().getSpid());
        }

        // if the context was anonymous, do not reuse outdated entries
        rtn = ! wasAnonymous ? rtn
          .put("twoFactorSuccess", getContext().get("twoFactorSuccess"))
          .put(ServerCrunchService.CACHE_KEY, getContext().get(ServerCrunchService.CACHE_KEY))
          : rtn.put(ServerCrunchService.CACHE_KEY, null);

        // We need to do this after the user and agent have been put since
        // 'getCurrentGroup' depends on them being in the context.
        Group group = auth.getCurrentGroup(rtn);

        if ( group != null ) {
          rtn = rtn.put("group", group);
        }
        Theme theme = (Theme) ((Themes) x.get("themes")).findTheme(rtn);
        rtn = rtn.put("theme", theme);
        if ( subject == null &&
             theme != null && ! SafetyUtil.isEmpty(theme.getSpid()) ) {
          rtn = rtn.put("spid", theme.getSpid());
        }

        AppConfig themeAppConfig = theme.getAppConfig();
        if ( themeAppConfig != null ) {
          appConfig.copyFrom(themeAppConfig);
        }
        if ( group != null ) {
          appConfig = group.getAppConfig(rtn.put("appConfig", appConfig));
        }
        appConfig = appConfig.configure(rtn, null);
        rtn = rtn.put("appConfig", appConfig);

        rtn = rtn.put(foam.core.auth.LocaleSupport.CONTEXT_KEY, foam.core.auth.LocaleSupport.instance().findLanguageLocale(rtn));

        rtn = rtn.put("localLocalSettingDAO", new foam.dao.MDAO(foam.core.session.LocalSetting.getOwnClassInfo()));

        rtn = rtn.put("logger",
          new foam.core.logger.PrefixLogger(
            new Object[] { "session", getId().split("-")[0] },
            foam.core.logger.Loggers.logger(rtn, true)
          ));

        // Record IP and UserAgent in the context
        var req = x.get(HttpServletRequest.class);
        if ( req != null ) {
          rtn = rtn.put("ip",        foam.net.IPSupport.instance().getRemoteIp(rtn));
          rtn = rtn.put("userAgent", req.getHeader("User-Agent"));
        }

        // Cache the context changes of applyTo
        setApplyContext(((OrX) rtn).getX());
        pm.log(x);
      } else {
        rtn = new OrX(reset(x), rtn);
      }
      return rtn;
      `
    },
    {
      name: 'validate',
      args: 'Context x',
      javaCode: `
        if ( getUserId() < 0 ) {
          throw new IllegalStateException("User id is invalid.");
        }

        if ( getAgentId() < 0 && getUserId() != getAgentId() ) {
          throw new IllegalStateException("Agent id is invalid.");
        }
      `
    },
    {
      name: 'checkUserEnabled',
      args: 'Context x, User user',
      javaCode: `
        if ( user == null ) {
          Loggers.logger(x, this).warning("User not found, user null");
          throw new foam.core.auth.UserNotFoundException();
        }

        if ( user instanceof LifecycleAware &&
            ((LifecycleAware)user).getLifecycleState() == LifecycleState.DELETED ) {
          Loggers.logger(x, this).warning("User deleted", user.getId());
          throw new foam.core.auth.UserNotFoundException();
        }

        // Testing 'id' allows internal session setup, used for capability checks,
        // for users in any state.
        if ( user.getLifecycleState() != foam.core.auth.LifecycleState.ACTIVE &&
             ! SafetyUtil.isEmpty(getId()) ) {
          Loggers.logger(x, this).warning("User disabled", user.getId());
          throw new foam.core.auth.AccountDisabledException();
        }
      `
    }
  ]
});
