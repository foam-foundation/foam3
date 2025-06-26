/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'SinkAgent',

  implements: [ 'foam.core.auth.Authorizable' ],

  javaImports: [
    'foam.core.auth.AuthService',
    'foam.core.auth.AuthorizationException'
  ],

  properties: [
    {
      class: 'Long',
      name: 'id',
      hidden: true
    },
    {
      class: 'String',
      name: 'label'
    },
    {
      class: 'String',
      name: 'value'
    },
    {
      class: 'Boolean',
      name: 'sink'
    },
    {
      class: 'String',
      name: 'type'
    },
    {
      class: 'Boolean',
      name: 'permissionRequired'
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
          if ( ! auth.check(x, "agent.read." + getId()) ) {
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
        if ( ! auth.check(x, "agent.update." + getId()) ) {
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
        if ( ! auth.check(x, "agent.remove." + getId()) ) {
          throw new AuthorizationException();
        }
      `
    },
    {
      name: 'toSummary',
      type: 'String',
      code: function() {
        return this.label;
      }
    }
  ]
});
