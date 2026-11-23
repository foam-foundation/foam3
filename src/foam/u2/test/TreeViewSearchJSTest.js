/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.test',
  name: 'TreeViewSearchJSTest',
  extends: 'foam.core.test.JSTest',

  documentation: `A TreeView given a filter shows the rows it accepts with
    their ancestors, ancestors open; a match's hidden children leave it no
    open/close arrow; rows the relationship builds from another source (Data
    Management's DAO menus) are judged too; a new filter replaces the shown
    rows; clearing it shows every row and closes the rows the search opened;
    without a filter every row shows.`,

  requires: [
    'foam.core.menu.Menu',
    'foam.core.menu.PseudoMenu',
    'foam.dao.ArrayDAO',
    'foam.mlang.ExpressionsSingleton',
    'foam.u2.view.TreeView'
  ],

  methods: [
    async function runTest(x) {
      x = x.createSubContext({
        translationService: { getTranslation: (locale, key, dflt) => dflt }
      });
      var settle = () => new Promise(r => setTimeout(r, 100));
      var mount  = async e => { e.write(x.document.body); await settle(); return e; };
      var shown  = el => {
        for ( var e = el ; e ; e = e.parentElement ) {
          if ( x.window.getComputedStyle(e).display === 'none' ) return false;
        }
        return true;
      };
      var row = (root, id) => root.querySelector('[name="' + id + '"]');
      // Waits up to 3s for the rows on screen to be exactly `ids`.
      var shownIds = root => Array.from(root.querySelectorAll('button[name]'))
        .filter(shown).map(b => b.getAttribute('name')).sort();
      var waitShown = async (root, ids) => {
        var want = ids.slice().sort().join(',');
        for ( var i = 0 ; i < 30 ; i++ ) {
          if ( shownIds(root).join(',') === want ) return true;
          await settle();
        }
        return false;
      };

      // Menu.children reads menuDAO from the menu's own context, so the menus
      // are created in the context that carries the DAO.
      var menuDAO = this.ArrayDAO.create({ of: this.Menu }, x);
      var mx = x.createSubContext({ menuDAO: menuDAO });
      // Like Data Management: a menu that builds its own children, which are
      // in no DAO the tree's caller holds.
      var stores = this.PseudoMenu.create({ id: 'admin.stores', parent: 'admin', label: 'Stores' }, mx);
      stores.children_.put(this.Menu.create({ id: 'admin.stores.reports', parent: 'admin.stores', label: 'Report DAO' }, mx));
      menuDAO.put(this.Menu.create({ id: 'admin', label: 'Admin' }, mx));
      menuDAO.put(this.Menu.create({ id: 'admin.data', parent: 'admin', label: 'Data' }, mx));
      menuDAO.put(this.Menu.create({ id: 'admin.data.agents', parent: 'admin.data', label: 'Agents' }, mx));
      menuDAO.put(this.Menu.create({ id: 'admin.users', parent: 'admin', label: 'Users' }, mx));
      menuDAO.put(stores);
      menuDAO.put(this.Menu.create({ id: 'help', label: 'Help' }, mx));
      var M   = this.Menu;
      var E   = this.ExpressionsSingleton.create();
      var rel = foam.core.menu.MenuMenuChildrenRelationship;
      var fmt = function(data) { this.add(data.label); };
      var all = [ 'admin', 'admin.data', 'admin.data.agents', 'admin.users', 'admin.stores', 'admin.stores.reports', 'help' ];

      // A match two levels down shows with its parents, and they open.
      var tree = await mount(this.TreeView.create({
        data: menuDAO, filter: E.EQ(M.LABEL, 'Agents'), relationship: rel, startExpanded: false, formatter: fmt
      }, mx));
      var root = tree.el_();
      x.test(await waitShown(root, [ 'admin', 'admin.data', 'admin.data.agents' ]),
        'a match shows with its parents and nothing else, got ' + JSON.stringify(shownIds(root)));
      x.test(row(root, 'admin')?.getAttribute('aria-expanded') === 'true',
        'a parent of a match opens, got ' + row(root, 'admin')?.getAttribute('aria-expanded'));

      // A new filter replaces the shown rows; a matched row whose children are
      // all hidden draws no open/close arrow.
      tree.filter = E.EQ(M.LABEL, 'Admin');
      x.test(await waitShown(root, [ 'admin' ]),
        'a new filter replaces the shown rows, got ' + JSON.stringify(shownIds(root)));
      x.test(! row(root, 'admin')?.hasAttribute('aria-expanded'),
        'a match whose children are all hidden has no open/close state, got ' + row(root, 'admin')?.getAttribute('aria-expanded'));

      // A row from another source is judged by the filter like any other.
      tree.filter = E.CONTAINS_IC(M.LABEL, 'report');
      x.test(await waitShown(root, [ 'admin', 'admin.stores', 'admin.stores.reports' ]),
        'a row its parent builds itself is found by the filter, got ' + JSON.stringify(shownIds(root)));

      // Clearing the filter shows every row again, and the rows the search
      // opened close: the tree is as it was before the search. A list screen
      // with no search passes AND(TRUE, TRUE), which counts as no search.
      tree.filter = E.AND(E.TRUE, E.TRUE);
      for ( var i = 0 ; i < 30 && row(root, 'admin')?.getAttribute('aria-expanded') !== 'false' ; i++ ) await settle();
      x.test(row(root, 'admin')?.getAttribute('aria-expanded') === 'false',
        'a row the search opened closes when the search is cleared, got ' + row(root, 'admin')?.getAttribute('aria-expanded'));
      x.test(await waitShown(root, [ 'admin', 'help' ]),
        'a cleared filter shows the top rows, closed, got ' + JSON.stringify(shownIds(root)));
      tree.remove();

      // Without a filter every row shows.
      var plain = await mount(this.TreeView.create({
        data: menuDAO, relationship: rel, startExpanded: true, formatter: fmt
      }, mx));
      x.test(await waitShown(plain.el_(), all),
        'without a filter every row shows, got ' + JSON.stringify(shownIds(plain.el_())));
      plain.remove();

    }
  ]
});
