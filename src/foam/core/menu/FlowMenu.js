/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.menu',
  name: 'FlowMenu',
  extends: 'foam.core.menu.LinkMenu',

  documentation: 'A menu item which routes to a flow page.',

  properties: [
    {
      class: 'Reference',
      of: 'foam.core.reflow.Flow',
      name: 'flow',
    },
    {
      name: 'link',
      expression: function(flow) {
        return '#flow/' + flow + '?flowMode=PRESENTATION';
      }
    }
  ]
});