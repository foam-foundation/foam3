/**
* @license
* Copyright 2023 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.core.menu',
  name: 'PseudoMenuView',
  extends: 'foam.u2.view.OverlayActionListView',
  documentation: 'View for PseudoMenus, sets children and labels for OverlayActionListView',
  imports: [
    'menu'
  ],
  properties: [
    {
      // Menu id in place of the generic OverlayActionListView name.
      name: 'name',
      expression: function(menu) { return ( menu && menu.id ) || ''; }
    },
    {
      name: 'label',
      factory: function() { return this.menu?.label ?? ''; }
    },
    {
      name: 'data',
      expression: function(menu$children) {
        return menu$children;
      }
    }
  ],
  methods: [
    function init() {
      this.menu.children.select().then(v => { this.data = v.array });
    }
  ]
});
