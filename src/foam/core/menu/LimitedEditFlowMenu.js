/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.menu',
  name: 'LimitedEditFlowMenu',
  extends: 'foam.core.menu.ViewMenu',

  documentation: 'Menu item that opens a flow in limited-edit mode (presentation with edit affordance).',

  imports: [
    'currentMenu?'
  ],

  properties: [
    {
      class: 'Reference',
      of: 'foam.core.reflow.Flow',
      name: 'flow',
    }
  ],

  methods: [
    function select(X, menu) {
      /** Include flowMode in route to enable limited edit presentation. **/
      if ( this.currentMenu?.id === menu.id ) return;
      X.routeTo(menu.id + '?flowMode=LIMIT_EDIT');
    },
    function createView(X) {
      return {
        class: "foam.core.reflow.Console",
        route: this.flow,
        flowMode: "LIMIT_EDIT"
      };
    }
  ]
});
