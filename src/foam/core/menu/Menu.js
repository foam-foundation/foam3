/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

 foam.CLASS({
  package: 'foam.core.menu',
  name: 'Menu',

  implements: [
    'foam.core.auth.Authorizable',
    'foam.core.auth.EnabledAware'
  ],

  tableColumns: [
    'enabled',
    'id',
    'parent.id',
    'label',
    'order'
  ],

  imports: [
    'lastMenuLaunchedListener?',
    'menuListener?'
  ],

  javaImports: [
    'foam.core.auth.AuthService',
    'foam.core.auth.AuthorizationException'
  ],

  javaCode: `
    protected final static AuthorizationException ACCESS_DENIED = new AuthorizationException("You do not have permission to access this menu.", (Throwable) null, false, false);
  `,

  properties: [
    {
      class: 'String',
      name: 'id',
      required: true,
      tableWidth: 280
    },
    {
      class: 'String',
      name: 'label',
      documentation: 'Menu label.'
    },
    {
      class: 'Boolean',
      name: 'enabled',
      value: true,
      tableWidth: 80
    },
    {
      class: 'String',
      name: 'tooltip',
      documentation: 'Tooltip for menu item.'
    },
    {
      class: 'FObjectProperty',
//      of: 'foam.core.menu.AbstractMenu',
      name: 'handler',
      documentation: 'View initialized when menu is launched.',
      javaJSONParser: 'foam.lib.json.UnknownFObjectParser.instance()',
      view: {
        class: 'foam.u2.view.FObjectView',
        allowCustom: true,
        choices: [
          [ 'foam.core.menu.DAOMenu',          'DAO' ],
          [ 'foam.core.menu.DAOMenu2',         'DAO2' ],
          [ 'foam.core.menu.DocumentMenu',     'Document' ],
          [ 'foam.core.menu.DocumentFileMenu', 'External Document' ],
          [ 'foam.core.menu.LinkMenu',         'Link' ],
          [ 'foam.core.menu.ListMenu',         'List' ],
          [ 'foam.core.menu.SubMenu',          'Submenu' ],
          [ 'foam.core.menu.TabsMenu',         'Tabs' ],
          [ 'foam.core.menu.ViewMenu',         'View' ],
          [ 'foam.core.menu.SeparatorMenu',    'Separator' ],
          [ 'foam.core.menu.FlowMenu',         'Flow' ],
          [ 'foam.core.menu.LimitedEditFlowMenu', 'Flow (Limited Edit)' ]
        ]
      }
    },
    {
      class: 'Int',
      name: 'order',
      documentation: 'Used to order the menu list.',
      tableWidth: 80,
      value: 1000
    },
    {
      class: 'String',
      name: 'description',
      documentation: 'Menu item explaination.',
      displayWidth: 80
    },
    {
      class: 'String',
      name: 'icon',
      documentation: 'Icon associated to the menu item.',
      displayWidth: 80
    },
    {
      class: 'String',
      name: 'themeIcon',
      documentation: 'Theme icon associated to the menu item.',
      displayWidth: 80
    },
    {
      class: 'String',
      name: 'activeIcon',
      documentation: 'Active icon associated to the menu item.',
      displayWidth: 80
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'border',
      factory: function() { return { class: 'foam.u2.borders.NullBorder' }; }
    },
    {
      class: 'FObjectArray',
      of: 'foam.core.menu.XRegistration',
      name: 'registrations'
    },
    {
      documentation: 'Predicate providing arbitrary checks, in addition to the regular menu auth checks.',
      class: 'foam.mlang.predicate.PredicateProperty',
      name: 'readPredicate',
      view: {
        class: 'foam.u2.view.JSONTextView'
      },
      javaFactory: `
        return foam.mlang.MLang.TRUE;
      `,
    },
    {
      class: 'StringArray',
      name: 'keywords'
    },
    {
      class: 'Boolean',
      name: 'authenticate',
      value: true,
      documentation: `
        IMPORTANT! "authenticate" property is now legacy and is being proxied to
        "authorizationStatus" property on postSet to minimize menus.jrl migration.

        authenticate:true is equivalent to authorizationStatus:AUTHENTICATED and
        authenticate:false is equivalent to authorizationStatus:PUBLIC.

        AuthorizationStatus also has UNAUTHENTICATED enum that can be used.
        See. AuthorizationStatus for details.
      `,
      transient: true,
      hidden: true,
      javaPostSet: `
        setAuthorizationStatus(val ? AuthorizationStatus.AUTHENTICATED : AuthorizationStatus.PUBLIC);
      `
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'view',
      factory: function() { return 'foam.u2.view.MenuView' }
    },
    {
      class: 'String',
      name: 'analyticsMessage'
    },
    {
      class: 'Enum',
      of: 'foam.core.menu.AuthorizationStatus',
      name: 'authorizationStatus',
      documentation: 'See. AuthorizationStatus',
      value: 'AUTHENTICATED'
    },
    {
      name: 'createRowView',
      getter: function(X, menu) {
        if ( this.handler ) {
          return this.handler.createRowView;
        }
        return null;
      }
    }
  ],

  methods: [
    function launch_(X, e) {
      // Create a sub-context with per-menu X.register()-ations.
      var subX = X.createSubContext({});
      for ( var i = 0 ; i < this.registrations.length ; i++ ) {
        var r = this.registrations[i];
        subX.register(X.lookup(r.className), r.targetName);
      }

      this.lastMenuLaunchedListener && this.lastMenuLaunchedListener(X.currentMenu);
      // this.menuListener && this.menuListener(this); // ???: Why is this needed?
      return this.handler && this.handler.launch(subX, this, e);
    },
    function toE(args, X) {
      // Pass on the menu object in context to avoid breaking UI with infinite loops
      if ( foam.lang.FObject.isInstance(X) ) {
        X = X.__subContext__.createSubContext({ menu: this });
      } else {
        X = X.createSubContext({ menu: this });
      }
      return foam.u2.ViewSpec.createView(this.view, args, this, X);
    },
    {
      documentation: 'Desire to call read predicate with calling context but predicate may also need access to this menu; add the current menu as context key MENU',
      name: 'f',
      type: 'Boolean',
      args: 'Context x',
      javaCode: `
        return getReadPredicate().f(
          x.put("MENU", this)
        );
      `
    },
    {
      name: 'authorizeOnCreate',
      javaCode: `
        AuthService auth = (AuthService) x.get("auth");
        if ( ! auth.check(x, "menu.create") ) {
          throw new AuthorizationException("You do not have permission to create menus.");
        }
      `
    },
    {
      name: 'authorizeOnUpdate',
      javaCode: `
        AuthService auth = (AuthService) x.get("auth");
        if ( ! auth.check(x, "menu.update." + getId()) ) {
          throw new AuthorizationException("You do not have permission to update this menu.");
        }
      `
    },
    {
      name: 'authorizeOnDelete',
      javaCode: `
        AuthService auth = (AuthService) x.get("auth");
        if ( ! auth.check(x, "menu.remove." + getId()) ) {
          throw new AuthorizationException("You do not have permission to delete menus.");
        }
      `
    },
    {
      name: 'authorizeOnRead',
      documentation: 'See. AuthorizationStatus',
      javaCode: `
        // Check menu.readPredicate
        if ( ! f(x) )
          throw ACCESS_DENIED;

        // Check user permission to access authenticated menu
        AuthService auth = (AuthService) x.get("auth");
        if ( getAuthorizationStatus() == AuthorizationStatus.AUTHENTICATED
          && ! auth.check(x, "menu.read." + getId())
        ) {
          throw ACCESS_DENIED;
        }

        if ( getAuthorizationStatus() == AuthorizationStatus.UNAUTHENTICATED ) {
          boolean flag;

          try {
            // Check subject to access unauthenticated menu
            var subject = auth.getCurrentSubject(x);

            flag = subject != null && ! auth.isUserAnonymous(x, subject.getUser().getId());
          } catch (foam.core.auth.AuthenticationException e) {
            // ???: Why does this happen?
            // foam.core.auth.UserAndGroupAuthService.getCurrentSubject(UserAndGroupAuthService.java:369)
            // e.printStackTrace();
            return;
          }

          if ( flag )
            throw ACCESS_DENIED;
        }
      `
    }
  ],

  actions: [
    {
      name: 'launch',
      code: function(X, e) {
        return this.launch_(X, e);
      }
    }
  ]
});


foam.RELATIONSHIP({
  sourceModel: 'foam.core.menu.Menu',
  targetModel: 'foam.core.menu.Menu',
  forwardName: 'children',
  inverseName: 'parent',
  sourceProperty: {
    hidden: true
  },
  targetProperty: {
    class: 'String',
    value: '',
    view: {
      class: 'foam.u2.view.ReferenceView',
      placeholder: '--'
    }
  }
});
