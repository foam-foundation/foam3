/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'RoleFlowAccess',
  implements: [ 'foam.mlang.Expressions' ],

  imports: [
    'groupDAO'
  ],

  requires: [
    'foam.core.auth.Group',
    'foam.core.reflow.FlowAccess'
  ],

  constants: {
    ROLE_PREFIX: 'Role'
  },

  properties: [
    {
      class: 'Reference',
      of: 'foam.core.auth.Group',
      name: 'roleId',
      required: true,
      view: function(_, X) {
        var self = X.data;
        var rolesDAO = self.groupDAO.where(self.CONTAINS(self.Group.ID, self.ROLE_PREFIX));
        return {
          class: 'foam.u2.view.RichChoiceView',
          search: true,
          sections: [
            {
              heading: 'Roles',
              dao: rolesDAO
            }
          ]
        };
      }
    },
    {
      class: 'Enum',
      of: 'foam.core.reflow.FlowAccess',
      name: 'accessLevel',
      required: true,
      view: function(_, X) {
        debugger
        return {
          class: 'foam.u2.view.RadioView',
          isHorizontal: true,
          choices: [
            [ X.data.FlowAccess.PUBLIC_RO, X.data.FlowAccess.PUBLIC_RO.label ],
            [ X.data.FlowAccess.PUBLIC_RW, X.data.FlowAccess.PUBLIC_RW.label ],
          ]
        }
      }
    }
  ]
});
