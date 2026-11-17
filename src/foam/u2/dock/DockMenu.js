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
    find it in the Dock and open it again, so the user gets back the same chat.
  `,

  methods: [
    function select(X, menu) {
      this.launch(X, menu);
    },

    function launch(X, menu) {
      var cls  = X.lookup(this.view.class);
      var item = X.dock.items.find(i => cls.isInstance(i));
      if ( ! item ) {
        item = foam.u2.ViewSpec.createView(this.view, {}, this, X);
        X.dock.dock(item);
      }
      item.open();
    }
  ]
});
