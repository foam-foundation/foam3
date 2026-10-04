/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.test',
  name: 'MenuHookNamesJSTest',
  extends: 'foam.core.test.JSTest',

  documentation: `The name attribute recorders and a11y tools key on:
    OverlayActionListView triggers carry 'overlay' or 'overlay-<id>', MenuView
    buttons and SubMenuView entries carry the menu id.`,

  requires: [
    'foam.core.menu.Menu',
    'foam.core.menu.SubMenuView',
    'foam.u2.view.MenuView',
    'foam.u2.view.OverlayActionListView'
  ],

  methods: [
    async function runTest(x) {
      // MenuView and SubMenuView translate their labels; the test runner's
      // context carries no translation service, so answer with the default.
      x = x.createSubContext({
        translationService: { getTranslation: (locale, key, dflt) => dflt }
      });
      var attr = e => {
        e.write(x.document.body);
        var v = e.el_().getAttribute('name');
        e.remove();
        return v;
      };

      var plain = attr(this.OverlayActionListView.create({ data: [] }, x));
      x.test(plain === 'overlay', 'trigger with no object is named overlay, got ' + plain);

      var perRow = attr(this.OverlayActionListView.create({ data: [], id: 'row-7' }, x));
      x.test(perRow === 'overlay-row-7', 'trigger with an object id is named overlay-<id>, got ' + perRow);

      var menu = this.Menu.create({ id: 'settings', label: 'Settings' }, x);
      var mv   = attr(this.MenuView.create({ menu: menu }, x));
      x.test(mv === 'settings', 'MenuView is named after the menu id, got ' + mv);

      var child = this.Menu.create({ id: 'settings.profile', parent: 'settings', label: 'Profile', handler: foam.core.menu.ViewMenu.create({}, x) }, x);
      var parent = this.Menu.create({ id: 'settings' }, x.createSubContext({
        menuDAO: foam.dao.ArrayDAO.create({ of: this.Menu, array: [ child ] }, x)
      }));
      var sub = this.SubMenuView.create({ menu: parent }, parent.__subContext__);
      sub.write(x.document.body);
      await new Promise(r => setTimeout(r, 50));
      var entry = sub.el_().querySelector('[name="settings.profile"]');
      sub.remove();
      x.test(!! entry, 'SubMenuView entry is named after the child menu id');
    }
  ]
});
