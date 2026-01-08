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
    'java.util.Arrays'
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

  tableColumns: [ 'name', 'source', 'description', 'status', 'version', /* 'isPublic', 'readOnly', */ 'reflow' ],

  searchColumns: [ 'name', 'status', 'source', 'keywords' ],

  topics: [ 'loadComplete' ],

  sections: [
    {
      name: 'general',
      title: 'General',
    },
    {
      name: 'scriptSection',
      title: 'Script',
      collapsable: true,
      permissionRequired: true, // requires foam.core.reflow.flow.section.scriptSection to access
      properties: [ 'preLoadScript', 'script', 'postLoadScript' ]
    }
  ],

  properties: [
    {
      class: 'String',
      name: 'name',
      section: 'general',
    },
    {
      class: 'String',
      name: 'limitedEditPermission',
      hidden: true,
      documentation: 'Permission id required to access limited-edit controls; hidden from standard UI.'
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
      reactive: false,
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
      autoValidate: true,
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
      reactive: false,
      section: 'general',
      readPermissionRequired: true,
      writePermissionRequired: true
    },
    {
      class: 'Int',
      name: 'version',
      visibility: 'HIDDEN',
      reactive: false,
      section: 'general'
    },
    {
      class: 'Int',
      name: 'revision',
      hidden: true,
      reactive: false,
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
      name: 'preLoadScript',
      section: 'scriptSection',
      documentation: 'Script to be run before the main script, typically used to set up classes or environment variables needed by the main script.',
      reactive: false,
      preSet: function(o, n) { return n.trim(); },
      view: { class: 'foam.u2.tag.TextArea', rows: 10, cols: 60 }
    },
    {
      class: 'String',
      name: 'postLoadScript',
      section: 'scriptSection',
      reactive: false,
      preSet: function(o, n) { return n.trim(); },
      view: { class: 'foam.u2.tag.TextArea', rows: 10, cols: 60 }
    },
    {
      class: 'String',
      name: 'script',
      section: 'scriptSection',
      reactive: false,
      value: '[\n\t\n]', // Is needed so that mementoMgr doesn't get confused on the first state
      preSet: function(o, n) { return n.trim(); },
      view: { class: 'foam.u2.tag.TextArea', rows: 10, cols: 60 }
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
          throw new AuthorizationException();
        }
      `
    }
  ],

  actions: [
    {
      name: 'reflow',
      code: function(X) {
        // 1) Allow for flowMode to be passed in
        // 2) implementation below relies on user having "menu.read.flow_" permission
        // ^ why? because we routeTo menu. Thus use "flow_" not "flow".
        // "flow" is visibile and has the ability to be granted.
        // "flow_" is not visible and used here as a view only
        var mode = X.flowMode || X.config?.flowMode || 'PRESENTATION';
        X.routeTo('flow_/' + encodeURIComponent(this.name) + '?flowMode=' + mode);
      },
      isAvailable: function() {
        // Disable in Reflow, but enable in DAOController (because already in reflow)
        return ! this.__context__.flow;
      }
    }
  ]
});
