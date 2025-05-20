/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.menu',
  name: 'SubMenu',
  extends: 'foam.core.menu.AbstractMenu',

  requires: [ 'foam.core.menu.SubMenuView' ],

  imports: ['currentMenu'],

  classes: [
    {
      name: 'SubMenuRouterView',
      extends: 'foam.u2.Controller',
      mixins: ['foam.u2.Router'],

      properties: [
        'menu'
      ],
      methods: [
        function init() {
          this.SUPER();
          let self = this;
          this.addClass();
          let routingFn = async function() {
            if ( self.route ) {
              let sub = (await self.menu.children.select()).array.find(v => v.id == self.menu.id + '/' + self.route)
              return await sub?.launch();
            }
          }
          this.onDetach(this.route$.sub(routingFn));
          routingFn();
        }
      ]
    }
  ],

  methods: [
    function select() {
      /** NOP **/
    },
    async function launch(X, menu) {
      // Create a small controller that can route to the children of this submenu, When menu changes, remove the controller.
      let self = this;
      let controller = this.SubMenuRouterView.create({ menu: menu }, X);
      controller.onDetach(this.currentMenu$.sub(function() {
        if ( self.currentMenu.id != menu.id )
          controller.remove();
      }));
    }
  ]
});
