/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.boot',
  name: 'CSpec',

  javaImplements: [
    'foam.core.auth.Authorizable',
    'foam.core.auth.EnabledAware'
  ],

  constants: [
    {
      name: 'CSPEC_CTX_KEY',
      type: 'String',
      value: 'CSPEC_CTX_KEY',
      documentation: 'Constant for addressing the CSpec through the context'
    }
  ],

  requires: [
    {
      path: 'foam.comics.BrowserView',
      flags: ['web']
    },
    'foam.core.script.Language'
  ],

  imports: [
    'window'
  ],

  javaImports: [
    'foam.core.auth.AuthService',
    'foam.core.auth.AuthorizationException',
    'foam.core.script.BeanShellExecutor',
    'foam.core.script.JShellExecutor',
    'foam.core.script.Language',
    'foam.lang.X',
    'foam.util.SafetyUtil',
    'java.io.IOException',
    'java.io.PrintStream'
  ],

  axioms: [
    {
      class: 'foam.comics.v2.CannedQuery',
      name: 'All',
      label: 'All',
      predicateFactory: function(e, cls) {
        return e.TRUE;
      }
    },
    {
      class: 'foam.comics.v2.CannedQuery',
      name: 'DAOS',
      label: 'DAOs',
      predicateFactory: function(e, cls) {
        return e.ENDS_WITH(cls.NAME, 'DAO');
      }
    },
    {
      class: 'foam.comics.v2.CannedQuery',
      name: 'SERVED_DAOS',
      label: 'Served DAOs',
      predicateFactory: function(e, cls) {
        return e.AND(
          e.EQ(cls.SERVE, e.True),
          e.ENDS_WITH(cls.NAME, 'DAO'));
      }
    },
    {
      class: 'foam.comics.v2.CannedQuery',
      name: 'SERVICES',
      label: 'Services',
      predicateFactory: function(e, cls) {
        return e.NOT(e.ENDS_WITH(cls.NAME, 'DAO'));
      }
    },
    {
      class: 'foam.comics.v2.CannedQuery',
      name: 'SERVED_SERVICES',
      label: 'Served Services',
      predicateFactory: function(e, cls) {
        return e.AND(
          e.EQ(cls.SERVE, e.True),
          e.NOT(e.ENDS_WITH(cls.NAME, 'DAO')));
      }
    }
  ],

  ids: [ 'name' ],

  tableColumns: [
    'name',
    'lazy',
    'serve',
    'authenticate',
    /*'serviceClass',*/
    'configure',
    'status',
    'message'
  ],

  searchColumns: [
    'lazy',
    'serve',
    'authenticate',
    'status'
  ],

  properties: [
    {
      class: 'String',
      name: 'name',
      displayWidth: '60',
      tableWidth: 460
    },
    {
      class: 'String',
      name: 'description',
      shortName: 'd',
      width: 120
    },
    {
      class: 'Boolean',
      name: 'enabled',
      value: true,
      readPermissionRequired: true,
      writePermissionRequired: true
    },
    {
      class: 'Boolean',
      name: 'lazy',
      tableWidth: 65,
      value: true
    },
    {
      class: 'Boolean',
      name: 'lazyClient',
      tableWidth: 65,
      value: true
    },
    {
      class: 'Int',
      name: 'lazyOrder',
      tableWidth: 65,
      documentation: 'Order non-lazy DAO invocation from low (0) to high.  Essential DAOs such as users, grants, ... should be low order, 0, with larger DAOs which take minutes to load should be a higher order value'
    },
    {
      class: 'Boolean',
      name: 'serve',
      tableWidth: 72,
      documentation: 'If true, this service is served over the network via boxes. If the service is a WebAgent, it will be served as a WebAgent only if this is false.'
    },
    {
      class: 'Boolean',
      name: 'authenticate',
      shortName: 'a',
      value: true
    },
    {
      class: 'Boolean',
      name: 'parameters',
      value: false
    },
    {
      class: 'Boolean',
      name: 'pm',
      value: true
    },
    {
      documentation: `When enabled, a reference to the 'built' CSpec is managed by a ThreadLocal, as to avoid the synchronization overhead associated with accessing the created singleton service.`,
      class: 'Boolean',
      name: 'threadLocalEnabled',
      value: false
    },
    {
      class: 'FObjectProperty',
      name: 'service',
      view: 'foam.u2.view.FObjectView',
      javaCloneProperty: 'set(dest, get(source));',
      readPermissionRequired:  true,
      writePermissionRequired: true
    },
    {
      class: 'String',
      name: 'serviceClass',
      shortName: 'sc',
      displayWidth: 80,
      readPermissionRequired:  true,
      writePermissionRequired: true
    },
    {
      class: 'String',
      name: 'boxClass',
      shortName: 'bc',
      displayWidth: 80,
      readPermissionRequired: true,
      writePermissionRequired: true
    },
    {
      class: 'Enum',
      of: 'foam.core.script.Language',
      name: 'language',
      value: 'BEANSHELL'
    },
    {
      class: 'Code',
      name: 'serviceScript',
      shortName: 'ss',
      readPermissionRequired: true,
      writePermissionRequired: true
    },
    {
      class: 'Code',
      name: 'client',
      shortName: 'c',
      value: '{}'
    },
    {
      class: 'String',
      name: 'documentation',
      shortName: 'doc',
      view: {
        class: 'foam.u2.view.ModeAltView',
        writeView: { class: 'foam.u2.tag.TextArea', rows: 12, cols: 140 },
        readView:  { class: 'foam.u2.view.PreView' }
      },
      readPermissionRequired:  true,
      writePermissionRequired: true
    },
    {
      class: 'String',
      name: 'authNotes',
      view: {
        class: 'foam.u2.view.ModeAltView',
        writeView: { class: 'foam.u2.tag.TextArea', rows: 12, cols: 140 },
        readView:  { class: 'foam.u2.view.PreView' }
      },
      readPermissionRequired:  true,
      writePermissionRequired: true
    },
    {
      class: 'StringArray',
      name: 'keywords',
      shortName: 'ks'
    },
    {
      class: 'String',
      name: '_choiceText_',
      transient: true,
      javaGetter: 'return getName();',
      getter: function() { return this.name; }
    },
    {
      class: 'Enum',
      of: 'foam.core.boot.CSpecStatus',
      name: 'status',
      storageTransient: true
    },
    {
      class: 'String',
      name: 'message',
      storageTransient: true,
      view: {
        class: 'foam.u2.view.ModeAltView',
        writeView: { class: 'foam.u2.tag.TextArea', rows: 12, cols: 140 },
        readView:  { class: 'foam.u2.view.PreView' }
      },
    },
    {
      class: 'foam.dao.DAOProperty',
      name: 'cSpecDAO',
      storageTransient: true,
      hidden: true,
      visibility: 'HIDDEN'
    },
    {
      class: 'String',
      name: 'threadName',
      storageTransient: true,
      hidden: true,
      visibility: 'HIDDEN'
    }
    // TODO: permissions, parent
  ],

  javaCode: `
    protected final static AuthorizationException ACCESS_DENIED = new AuthorizationException("You do not have permission to access the service.", (Throwable) null, false, false);
  `,

  methods: [
    {
      name: 'createService',
      args: 'Context x, PrintStream ps',
      javaType: 'java.lang.Object',
      javaCode: `
        if ( getService() != null ) return getService();

        if ( getServiceClass().length() > 0 )
          return Class.forName(getServiceClass()).newInstance();

        Language l = getLanguage();

        if ( l == foam.core.script.Language.JSHELL )
          return new JShellExecutor().runExecutor(x, ps, getServiceScript());

        if ( l == foam.core.script.Language.BEANSHELL )
          return new BeanShellExecutor(this).execute(x, ps, getServiceScript());

        throw new RuntimeException("Script language not supported");
      `,
      javaThrows: [
        'Exception',
        'IOException',
        'java.lang.ClassNotFoundException',
        'java.lang.IllegalAccessException',
        'java.lang.InstantiationException',
        'NoSuchFieldException',
        'SecurityException'
      ]
    },
    {
      name: 'checkAuthorization',
      type: 'Void',
      documentation: `
        Given a user's session context, throw an exception if the user doesn't
        have permission to access this service.
      `,
      args: 'Context x',
      javaCode: `
        if ( ! getAuthenticate() ) return;

        AuthService auth = (AuthService) x.get("auth");
        if ( ! auth.check(x, "service." + getName()) ) {
          throw ACCESS_DENIED;
        }
      `,
    },
    {
      name: 'authorizeOnCreate',
      args: [
        { name: 'x', type: 'Context' }
      ],
      type: 'Void',
      javaThrows: ['AuthorizationException'],
      javaCode: `
        String permission = "nspec.create";
        AuthService auth = (AuthService) x.get("auth");

        if ( ! auth.check(x, permission) ) {
          ((foam.core.logger.Logger) x.get("logger")).debug("AuthorizableAuthorizer", "Permission denied.", permission);
          throw new AuthorizationException("Permission denied: Cannot create CSpec.");
        }
      `
    },
    {
      name: 'authorizeOnRead',
      args: 'Context x',
      type: 'Void',
      javaThrows: ['AuthorizationException'],
      javaCode: 'checkAuthorization(x);'
    },
    {
      name: 'authorizeOnUpdate',
      args: [
        { name: 'x', type: 'Context' },
        { name: 'oldObj', type: 'foam.lang.FObject' }
      ],
      type: 'Void',
      javaThrows: ['AuthorizationException'],
      javaCode: `

      String permission = "nspec.update." + getId();
      AuthService auth = (AuthService) x.get("auth");

      if ( ! auth.check(x, permission) ) {
        ((foam.core.logger.Logger) x.get("logger")).debug("AuthorizableAuthorizer", "Permission denied.", permission);
        throw new AuthorizationException("Permission denied: Cannot update this CSpec.");
      }
      `
    },
    {
      name: 'authorizeOnDelete',
      args: 'Context x',
      type: 'Void',
      javaThrows: ['AuthorizationException'],
      javaCode: `
        String permission  = "nspec.remove." + getId();
        AuthService auth = (AuthService) x.get("auth");

        if ( ! auth.check(x, permission) ) {
          ((foam.core.logger.Logger) x.get("logger")).debug("AuthorizableAuthorizer", "Permission denied.", permission);
          throw new AuthorizationException("Permission denied: Cannot delete this CSpec.");
        }
      `
    },
    {
      name: 'updateStatus',
      args: 'Object... vargs',
      javaCode: `
        foam.core.logger.Logger logger = foam.core.logger.StdoutLogger.instance();
        Throwable t = null;
        CSpecStatus status = null;
        StringBuilder sb = new StringBuilder();
        StringBuilder msgSb = new StringBuilder();
        for ( Object o : vargs ) {
          if ( o == null )
            continue;
          if ( o instanceof CSpecStatus )
            status = (CSpecStatus) o;
          else if ( o instanceof Throwable )
            t = (Throwable) o;
          else {
            if ( sb.length() == 0 ) {
              // Existing log output format
              sb.append(o.toString());
              sb.append(" Service,");
              sb.append(getName());
            } else {
              sb.append(",");
              sb.append(o.toString());
              if ( msgSb.length() > 0 )
                msgSb.append(",");
              msgSb.append(o.toString());
            }
          }
        }
        if ( t != null ) {
          if ( sb.length() > 0)
            sb.append(",");
          sb.append(t.getMessage());
          if ( msgSb.length() > 0)
            msgSb.append(",");
          msgSb.append(t.getMessage());
          status = CSpecStatus.ERROR;
        }

        if ( ! "cSpecDAO".equals(getId()) &&
             ! "logger".equals(getId()) &&
             ! "PM".equals(getId()) ) {
          X x = getX();
          foam.dao.DAO cSpecDAO = getCSpecDAO();
          if ( cSpecDAO == null ) {
            logger.debug("CSPec.updateStatus,cSpecDAO not found,cSpec", getId());
          } else {
            CSpec cs = (CSpec) cSpecDAO.find_(x, getId());
            if ( cs == null ) {
              logger.debug("CSPec.updateStatus,CSpec not found", getId());
            } else {
              cs = (CSpec) cs.fclone();
              CSpecStatus oldStatus = cs.getStatus();
              cs.setStatus(status);
              if ( ! SafetyUtil.isEmpty(cs.getMessage()) )
                cs.setMessage(cs.getMessage() + "\\n");
              cs.setMessage(cs.getMessage() + msgSb.toString());
              cs.setThreadName(Thread.currentThread().getName());
              if ( cs.getStatus() == CSpecStatus.INITIAL )
                cs.setStatus(CSpecStatus.INITIALIZING);
              cs = (CSpec) cSpecDAO.put_(x, cs);
            }
          }
        }
        if ( t == null )
          logger.info(sb.toString());
        else
          logger.error(sb.toString(), t);
      `
    }
  ],

  actions: [
    {
      // Let user configure this service. Is hard-coded to work with DAO's
      // for now, but should get the config object from the CSpec itself
      // to be extensible.
      name: 'configure',
      isAvailable: function(boxClass, serve) {
        return serve && ! boxClass;
//        return foam.dao.DAO.isInstance(this.__context__[this.name]);
      },
      code: function() {
        var service = this.__context__[this.name];
        if ( foam.dao.DAO.isInstance(service) ) {
          this.window.location = `#admin.data/${this.name}`;
        }
      }
    }
  ]
});
