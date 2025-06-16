/**
 * @license
 * Copyright 2016 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'Flow',

  implements: [
    'foam.core.auth.Authorizable',
    'foam.core.auth.CreatedAware',
    'foam.core.auth.CreatedByAware',
    'foam.core.auth.LastModifiedAware',
    'foam.core.auth.LastModifiedByAware',
    'foam.core.auth.ServiceProviderAware'
  ],

  javaImports: [
    'foam.core.auth.AuthorizationException',
    'foam.core.auth.AuthService',
    'foam.core.auth.Subject',
    'foam.core.auth.User',
    'foam.lang.X',
    'foam.core.auth.AuthService',
    'java.util.Arrays'
  ],

  requires: [
    'foam.core.cron.CronSchedule',
  ],

  imports: [ 'flowDAO' ],

  ids: [ 'name' ],
/*
  axioms: [
    {
      class: 'foam.comics.v2.CannedQuery',
      label: 'Public',
      predicateFactory: function(e, cls) { return e.EQ(cls.IS_PUBLIC, true); }
    },
    {
      class: 'foam.comics.v2.CannedQuery',
      label: 'Private',
      predicateFactory: function(e, cls) { return e.EQ(cls.IS_PUBLIC, false); }
    }
  ],
    */

  tableColumns: [ 'name', 'source', 'description', 'status', 'schedule', 'lastRun', /* 'isPublic', 'readOnly', */ 'reflow' ],

  searchColumns: [ 'name', 'status', 'source', 'schedule' ],

  constants: { ROLE_PERMISSION_PREFIX: '@' },

  properties: [
    {
      class: 'String',
      name: 'name',
      onKey: true
    },
    {
      class: 'String',
      name: 'description',
      width: 80
    },
    {
      class: 'String',
      name: 'status',
      width: 20
    },
    {
      class: 'String',
      name: 'source',
      width: 30
    },
    {
      class: 'String',
      name: 'notes',
      width: 80,
      view: { class: 'foam.u2.tag.TextArea', rows: 3, cols: 78 }
    },
    {
      class: 'Enum',
      of: 'foam.core.reflow.FlowAccess',
      name: 'accessLevel',
      value: foam.core.reflow.FlowAccess.PUBLIC_RW
    },
    {
      class: 'FObjectArray',
      of: 'foam.core.reflow.UserFlowAccess',
      name: 'specifiedUserAccess',
      visibility: function(accessLevel) {
        return accessLevel != foam.core.reflow.FlowAccess.SHARED ? foam.u2.DisplayMode.HIDDEN : foam.u2.DisplayMode.RW;
      }
    },
    {
      class: 'FObjectArray',
      of: 'foam.core.reflow.RoleFlowAccess',
      name: 'specifiedRoleAccess',
      visibility: function(accessLevel) {
        return accessLevel != foam.core.reflow.FlowAccess.SHARED ? foam.u2.DisplayMode.HIDDEN : foam.u2.DisplayMode.RW;
      }
    },
    {
      name: 'lastModifiedByAgent',
      hidden: true
    },
    {
      name: 'createdByAgent',
      hidden: true
    },
    {
//      class: 'FObjectArray',
//      of: 'com.google.flow.Property',
      name: 'memento',
      hidden: true,
      transient: true,
      postSet: function(_, n) {
        if ( this.feedback_ ) return;
        this.feedback_ = true;
        try {
          // TODO: should still not output empty reactions_: or children:
          var json = foam.json.Outputter.create({
            pretty: true,
            strict: true,
            formatDatesAsNumbers: false,
            outputDefaultValues: false,
            useShortNames: false,
            propertyPredicate: function(_, p) { return p.name === 'reactions_' || ( ! p.externalTransient && ! p.networkTransient ); }
          });
          //          this.mementoStr = foam.json.Short.stringify(n);
          // HACK: Console doesn't set name until after the block is added, so if we store the mementoStr
          // now it will lack the name. Just delay a bit to allow name to be set.

        } finally {
//          setTimeout(()=> {
            this.mementoStr = json.stringify(n)
            this.feedback_ = false;
//          }, 1);
        }
      }
    },
    {
      class: 'Reference',
      of: 'foam.core.auth.ServiceProvider',
      name: 'spid'
    },
    {
      class: 'Int',
      name: 'version'
    },
    {
      class: 'Int',
      name: 'revision',
      transient: true,
      xxxview: {
        class: 'foam.u2.view.DualView',
        viewa: { class: 'foam.u2.IntView' },
        viewb: { class: 'foam.u2.RangeView', onKey: true }
      }
    },
    {
      class: 'String',
      name: 'mementoStr',
      label: 'Script',
      postSet: function(_, n) {
        if ( this.feedback_ ) return;
        this.feedback_ = true;
        try {
          // console.log('*********** FLOW mementoStr change:', n);
          n = n.trim();
          if ( n ) {
            var json = JSON.parse(n);
            this.memento = foam.json.parse(json, null, this.__context__);
          } else {
            this.memento = [];
          }
        } finally {
          this.feedback_ = false;
        }
      },
      view: { class: 'foam.u2.tag.TextArea', rows: 8, cols: 78 }
    },
    {
      class: 'FObjectProperty',
      name: 'mementoMgr',
      transient: true,
      hidden: true,
      factory: function() {
        return foam.memento.MementoMgr.create({memento$: this.mementoStr$, position$: this.revision$});
      }
    },
    {
      name: 'schedule',
      class: 'FObjectProperty',
      of: 'foam.core.cron.CronSchedule',
      documentation: 'Schedule to run this flow.'
    },
    {
      class: 'DateTime',
      name: 'lastRun',
      label: 'Last Run',
      readPermissionRequired: true,
      documentation: 'Timestamp of the last execution of this flow. Works with this.schedule.'
    }
  ],

  methods: [
    function init() {
      this.SUPER();
      this.mementoMgr; // force creation
    },
    {
      name: 'authorizeOnCreate',
      javaCode: `
        // noop
      `
    },
    {
      name: 'checkBypassAuthorization',
      args: `X x`,
      type: 'boolean',
      javaCode: `
        AuthService auth = (AuthService) x.get("auth");
        return auth.check(x, "*" );
      `
    },
    {
      name: 'authorizeOnRead',
      javaCode: `
        User user = ((Subject) x.get("subject")).getUser();
        if ( getCreatedBy() == user.getId() ) return;
        if ( checkBypassAuthorization(x) ) return;

        if ( getAccessLevel() == FlowAccess.PRIVATE ) throw new AuthorizationException();

        if ( getAccessLevel() == FlowAccess.SHARED ) {
          // check user accesss
          if ( getSpecifiedUserAccess() != null ) {
            var hasUserAccess = Arrays.stream(getSpecifiedUserAccess()).anyMatch(o ->
              ((UserFlowAccess) o).getUserId() == user.getId() &&
              (
                ((UserFlowAccess) o).getAccessLevel() == foam.core.reflow.FlowAccess.PUBLIC_RO ||
                ((UserFlowAccess) o).getAccessLevel() == foam.core.reflow.FlowAccess.PUBLIC_RW
              )
            );
            if ( hasUserAccess ) return;
          }

          // check role access
          if ( getSpecifiedRoleAccess() != null ) {
            for ( int i = 0; i < getSpecifiedRoleAccess().length; i++ ) {
              var roleAccess = getSpecifiedRoleAccess()[i];
              // if its not rw/ro don't bother checking
              if ( roleAccess.getAccessLevel() != foam.core.reflow.FlowAccess.PUBLIC_RW &&
                   roleAccess.getAccessLevel() != foam.core.reflow.FlowAccess.PUBLIC_RO ) continue;
              try {
                var hasRolePermission = ((AuthService) x.get("auth")).check(x, this.ROLE_PERMISSION_PREFIX + roleAccess.getRoleId());
                if ( hasRolePermission ) return;
              } catch (AuthorizationException e) { }
            }
          }
          throw new AuthorizationException();
        }
      `
    },
    {
      name: 'authorizeOnUpdate',
      javaCode: `
        User user = ((Subject) x.get("subject")).getUser();
        if ( getCreatedBy() == user.getId() ) return;
        if ( checkBypassAuthorization(x) ) return;

        if ( getAccessLevel() == FlowAccess.PRIVATE || getAccessLevel() == FlowAccess.PUBLIC_RO ) throw new AuthorizationException();

        if ( getAccessLevel() == FlowAccess.SHARED ) {
          // check user accesss
          if ( getSpecifiedUserAccess() != null ) {
            var hasUserAccess = Arrays.stream(getSpecifiedUserAccess()).anyMatch(o ->
              ((UserFlowAccess) o).getUserId() == user.getId() && ((UserFlowAccess) o).getAccessLevel() == foam.core.reflow.FlowAccess.PUBLIC_RW
            );
            if ( hasUserAccess ) return;
          }

          // check role access
          if ( getSpecifiedRoleAccess() != null ) {
            for ( int i = 0; i < getSpecifiedRoleAccess().length; i++ ) {
              var roleAccess = getSpecifiedRoleAccess()[i];
              // if its not rw don't bother checking
              if ( roleAccess.getAccessLevel() != foam.core.reflow.FlowAccess.PUBLIC_RW ) continue;
              try {
                var hasRolePermission = ((AuthService) x.get("auth")).check(x, this.ROLE_PERMISSION_PREFIX + roleAccess.getRoleId());
                if ( hasRolePermission ) return;
              } catch (AuthorizationException e) { }
            }
          }
          throw new AuthorizationException();
        }
      `
    },
    {
      name: 'authorizeOnDelete',
      javaCode: `
        User user = ((Subject) x.get("subject")).getUser();
        if ( getCreatedBy() == user.getId() ) return;
        if ( checkBypassAuthorization(x) ) return;

        if ( getAccessLevel() == FlowAccess.PRIVATE || getAccessLevel() == FlowAccess.PUBLIC_RO ) throw new AuthorizationException();

        if ( getAccessLevel() == FlowAccess.SHARED ) {
          // check user accesss
          if ( getSpecifiedUserAccess() != null ) {
            var hasUserAccess = Arrays.stream(getSpecifiedUserAccess()).anyMatch(o ->
              ((UserFlowAccess) o).getUserId() == user.getId() && ((UserFlowAccess) o).getAccessLevel() == foam.core.reflow.FlowAccess.PUBLIC_RW
            );
            if ( hasUserAccess ) return;
          }

          // check role access
          if ( getSpecifiedRoleAccess() != null ) {
            for ( int i = 0; i < getSpecifiedRoleAccess().length; i++ ) {
              var roleAccess = getSpecifiedRoleAccess()[i];
              // if its not rw don't bother checking
              if ( roleAccess.getAccessLevel() != foam.core.reflow.FlowAccess.PUBLIC_RW ) continue;
              try {
                var hasRolePermission = ((AuthService) x.get("auth")).check(x, this.ROLE_PERMISSION_PREFIX + roleAccess.getRoleId());
                if ( hasRolePermission ) return;
              } catch (AuthorizationException e) { }
            }
          }
          throw new AuthorizationException();
        }
      `
    }
  ],

  actions: [
    {
      name: 'reflow',
      code: function(X) {
        X.routeTo('flow/' + this.name + '?flowMode=view');
      },
      isAvailable: function() {
        // Disable in Reflow, but enable in DAOController (because already in reflow)
        return ! this.__context__.flow;
      }
    }
  ]
});
