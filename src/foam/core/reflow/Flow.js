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

  searchColumns: [ 'name', 'status', 'source', 'keywords' ],

  constants: { ROLE_PERMISSION_PREFIX: '@' },

  sections: [
    {
      name: 'general',
      title: 'General',
    },
    {
      name: 'scriptSection',
      title: 'Script',
      collapsable: true
    },
    {
      name: 'scheduleSection',
      title: 'Schedule',
      collapsable: true
    }
  ],

  properties: [
    {
      class: 'String',
      name: 'name',
      section: 'general',
      onKey: true
    },
    {
      class: 'String',
      name: 'description',
      section: 'general',
      width: 80
    },
    {
      class: 'String',
      name: 'status',
      section: 'general',
      tableCellFormatter: function(value, obj) {
        if ( value.startsWith('PASSED') ) {
          this.style({color: 'green'});
        } else if ( value.startsWith('FAILED') ) {
          this.style({color: 'red'});
        }
        this.add(value);
      },
      width: 20
    },
    {
      class: 'String',
      name: 'source',
      section: 'general',
      width: 30
    },
    {
      class: 'StringArray',
      section: 'general',
      name: 'keywords'
    },
    {
      class: 'String',
      section: 'general',
      name: 'notes',
      section: 'general',
      width: 80,
      view: { class: 'foam.u2.tag.TextArea', rows: 3, cols: 78 }
    },
    {
      class: 'Enum',
      of: 'foam.core.reflow.FlowAccess',
      name: 'accessLevel',
      section: 'general',
      label: 'Access',
      value: foam.core.reflow.FlowAccess.PUBLIC_RW
    },
    {
      class: 'FObjectArray',
      of: 'foam.core.reflow.UserFlowAccess',
      name: 'specifiedUserAccess',
      section: 'general',
      visibility: function(accessLevel) {
        return accessLevel != foam.core.reflow.FlowAccess.SHARED ? foam.u2.DisplayMode.HIDDEN : foam.u2.DisplayMode.RW;
      }
    },
    {
      class: 'FObjectArray',
      of: 'foam.core.reflow.RoleFlowAccess',
      name: 'specifiedRoleAccess',
      section: 'general',
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
      class: 'Reference',
      of: 'foam.core.auth.ServiceProvider',
      name: 'spid',
      section: 'general',
      readPermissionRequired: true,
      writePermissionRequired: true
    },
    {
      class: 'Int',
      name: 'version',
      section: 'general'
    },
    {
      class: 'Int',
      name: 'revision',
      section: 'general',
      transient: true,
      xxxview: {
        class: 'foam.u2.view.DualView',
        viewa: { class: 'foam.u2.IntView' },
        viewb: { class: 'foam.u2.RangeView', onKey: true }
      }
    },
    {
      class: 'String',
      name: 'script',
      label: '',
      columnLabel:'Script',
      section: 'scriptSection',
      reactive: false,
      value: '[\n\t\n]', // Is needed so that mementoMgr doesn't get confused on the first state
      preSet: function(o, n) { return n.trim(); },
      view: { class: 'foam.u2.tag.TextArea', rows: 10, cols: 60 }
    },
    {
      class: 'DateTime',
      name: 'lastRun',
      section: 'scheduleSection',
      readPermissionRequired: true,
      factory: function() { return new Date(); },
      documentation: 'Timestamp of the last execution of this flow. Works with this.schedule.'
    },
    {
      class: 'DateTime',
      name: 'nextRun',
      section: 'scheduleSection',
      visibility: 'RO'
    },
    {
      name: 'schedule',
      section: 'scheduleSection',
      class: 'FObjectProperty',
      of: 'foam.core.cron.CronSchedule',
      section: 'scheduleSection',
      documentation: 'Schedule to run this flow.'
    }
  ],

  methods: [
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
