/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.dock',
  name: 'DockMenu',
  extends: 'foam.core.menu.ViewMenu',

  documentation: `
    A menu that opens a view in the Dock instead of the page: the view stays on
    screen while the user moves around the app, such as the Ask AI chat. view
    is a DockItem view. The first launch creates and docks it; later launches
    find the item made from the same view spec and open it again, so the user
    gets back the same chat, and two menus with different specs get one each.
  `,

  methods: [
    // A menu normally routes to a page. This one opens a dock item and leaves the page where it is,
    // so select does the launch itself and never reaches the routing of ViewMenu.
    function select(X, menu) {
      this.launch(X, menu);
    },

    function launch(X, menu) {
      // an app without a Dock has nowhere to put the view
      if ( ! X.dock ) return;
      // Two Ask AI menus, one with daoKeys ['flowDAO'] and one with ['noteDAO'], open the same
      // view class but must not share a panel, so an item counts as this menu's only when
      // every value in the spec matches it.
      var spec = this.view;
      var cls  = X.lookup(spec.class);
      var item = X.dock.items.find(i => cls.isInstance(i) &&
        Object.keys(spec).every(k => k == 'class' || foam.util.equals(i[k], spec[k])));
      if ( ! item ) {
        item = foam.u2.ViewSpec.createView(this.view, {}, this, X);
        X.dock.dock(item);
      }
      item.open();
    }
  ]
});
