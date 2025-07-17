/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// DAO: controlDAO
// Journal: controls.jrl
// Permission: control.read/write.<id>
foam.CLASS({
  package: 'foam.core.reflow',
  name: 'ToolbarControl',

  implements: [ 'foam.core.auth.Authorizable' ],

  javaImports: [
    'foam.core.auth.AuthService',
    'foam.core.auth.AuthorizationException'
  ],

  properties: [
    {
      class: 'String',
      name: 'id'
    },
    {
      class: 'String',
      name: 'toolbar',
      value: 'Standard'
    },
    {
      class: 'Int',
      name: 'order',
      documentation: 'Used to order in toolbar.',
      tableWidth: 80,
      value: 1000
    },
    {
      class: 'Boolean',
      name: 'permissionRequired'
    },
    {
      class: 'String',
      name: 'view'
    }
  ],

  methods: [
    {
      name: 'authorizeOnCreate',
      args: 'Context x',
      javaThrows: ['AuthorizationException'],
      javaCode: `
        // nop - open to write
      `
    },
    {
      name: 'authorizeOnRead',
      args: 'Context x',
      javaThrows: ['AuthorizationException'],
      javaCode: `
        if ( getPermissionRequired() ) {
          AuthService auth = (AuthService) x.get("auth");
          if ( ! auth.check(x, "control.read." + getId()) ) {
            throw new AuthorizationException();
          }
        }
      `
    },
    {
      name: 'authorizeOnUpdate',
      args: 'Context x',
      javaThrows: ['AuthorizationException'],
      javaCode: `
        AuthService auth = (AuthService) x.get("auth");
        if ( ! auth.check(x, "control.update." + getId()) ) {
          throw new AuthorizationException();
        }
      `
    },
    {
      name: 'authorizeOnDelete',
      args: 'Context x',
      javaThrows: ['AuthorizationException'],
      javaCode: `
        AuthService auth = (AuthService) x.get("auth");
        if ( ! auth.check(x, "control.remove." + getId()) ) {
          throw new AuthorizationException();
        }
      `
    },
    {
      name: 'toSummary',
      type: 'String',
      code: function() {
        return this.id;
      }
    }
  ]
});
