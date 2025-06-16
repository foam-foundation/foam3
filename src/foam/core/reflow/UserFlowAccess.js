/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'UserFlowAccess',
  requires: [
    'foam.core.reflow.FlowAccess'
  ],

  properties: [
    {
      class: 'Reference',
      of: 'foam.core.auth.User',
      name: 'userId'
    },
    {
      class: 'Enum',
      of: 'foam.core.reflow.FlowAccess',
      name: 'accessLevel',
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
