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
      name: 'NSPEC_CTX_KEY',
      type: 'String',
      value: 'NSPEC_CTX_KEY',
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
    'java.io.IOException',
    'java.io.PrintStream',

    'foam.lang.X',
    'foam.core.auth.AuthService',
    'foam.core.auth.AuthorizationException',
    'foam.core.script.BeanShellExecutor',
    'foam.core.script.JShellExecutor',
    'foam.core.script.Language'
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

  tableColumns: [ 'name', 'lazy', 'serve', 'authenticate', /*'serviceClass',*/ 'configure' ],

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
