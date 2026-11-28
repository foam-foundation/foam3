/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.test',
  name: 'TreeViewSearchJSTest',
  extends: 'foam.core.test.JSTest',

  documentation: `A TreeView given a searchPredicate shows the rows it accepts with
    their ancestors, ancestors open; a match keeps its own children, closed; rows the relationship builds from another source (Data
    Management's DAO menus) are judged too; a new search replaces the shown
    rows; clearing it shows every row and closes the rows the search opened;
    without a search every row shows; a tree that starts closed starts closed
    at every level. VerticalMenu's search box finds a menu by label or keyword, and
    MDSideNavigation's by the same rule.`,

  requires: [
    'foam.core.menu.Menu',
    'foam.core.menu.PseudoMenu',
    'foam.core.menu.VerticalMenu',
    'foam.dao.ArrayDAO',
    'foam.mlang.ExpressionsSingleton',
    'foam.u2.layout.MDSideNavigation',
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
        data: menuDAO, searchPredicate: E.EQ(M.LABEL, 'Agents'), relationship: rel, startExpanded: false, formatter: fmt
      }, mx));
      var root = tree.el_();
      x.test(await waitShown(root, [ 'admin', 'admin.data', 'admin.data.agents' ]),
        'a match shows with its parents and nothing else, got ' + JSON.stringify(shownIds(root)));
      x.test(row(root, 'admin')?.getAttribute('aria-expanded') === 'true',
        'a parent of a match opens, got ' + row(root, 'admin')?.getAttribute('aria-expanded'));

      // A new search replaces the shown rows. A matched row keeps its own
      // children, as AG Grid does: it shows closed, and one click opens it.
      tree.searchPredicate = E.EQ(M.LABEL, 'Admin');
      x.test(await waitShown(root, [ 'admin' ]),
        'a new search replaces the shown rows, got ' + JSON.stringify(shownIds(root)));
      for ( var i = 0 ; i < 30 && row(root, 'admin')?.getAttribute('aria-expanded') !== 'false' ; i++ ) await settle();
      x.test(row(root, 'admin')?.getAttribute('aria-expanded') === 'false',
        'a match with no match below it shows closed, with an arrow, got ' + row(root, 'admin')?.getAttribute('aria-expanded'));
      row(root, 'admin').click();
      x.test(await waitShown(root, [ 'admin', 'admin.data', 'admin.users', 'admin.stores' ]),
        'opening a match shows its own children, closed, got ' + JSON.stringify(shownIds(root)));
      // Closed again by hand, so the checks below start from a closed tree.
      row(root, 'admin').click();

      // A row from another source is judged by the search like any other.
      tree.searchPredicate = E.CONTAINS_IC(M.LABEL, 'report');
      x.test(await waitShown(root, [ 'admin', 'admin.stores', 'admin.stores.reports' ]),
        'a row its parent builds itself is found by the search, got ' + JSON.stringify(shownIds(root)));

      // Clearing the search shows every row again, and the rows the search
      // opened close: the tree is as it was before the search. A list screen
      // with no search passes AND(TRUE, TRUE), which counts as no search.
      tree.searchPredicate = E.AND(E.TRUE, E.TRUE);
      for ( var i = 0 ; i < 30 && row(root, 'admin')?.getAttribute('aria-expanded') !== 'false' ; i++ ) await settle();
      x.test(row(root, 'admin')?.getAttribute('aria-expanded') === 'false',
        'a row the search opened closes when the search is cleared, got ' + row(root, 'admin')?.getAttribute('aria-expanded'));
      x.test(await waitShown(root, [ 'admin', 'help' ]),
        'a cleared search shows the top rows, closed, got ' + JSON.stringify(shownIds(root)));
      tree.remove();

      // Without a search every row shows.
      var plain = await mount(this.TreeView.create({
        data: menuDAO, relationship: rel, startExpanded: true, formatter: fmt
      }, mx));
      x.test(await waitShown(plain.el_(), all),
        'without a search every row shows, got ' + JSON.stringify(shownIds(plain.el_())));
      plain.remove();

      // A tree that starts closed (the side menus) starts closed at every
      // level: opening a top row shows its children closed.
      var closed = await mount(this.TreeView.create({
        data: menuDAO, relationship: rel, startExpanded: false, formatter: fmt
      }, mx));
      row(closed.el_(), 'admin')?.click();
      x.test(await waitShown(closed.el_(), [ 'admin', 'admin.data', 'admin.users', 'admin.stores', 'help' ]),
        'opening a top row shows its children, got ' + JSON.stringify(shownIds(closed.el_())));
      x.test(row(closed.el_(), 'admin.data')?.getAttribute('aria-expanded') === 'false',
        'a child row starts closed too, got ' + row(closed.el_(), 'admin.data')?.getAttribute('aria-expanded'));
      closed.remove();

      // VerticalMenu's search box finds a menu by label or by keyword.
      var nav = this.VerticalMenu.create({}, mx.createSubContext({
        currentMenu: null, loginSuccess: true, pushMenu: () => {},
        theme: { showNavSearch: true, navigationRootMenu: '' }
      }));
      var smtp = this.Menu.create({ id: 'mail', label: 'Email Service', keywords: [ 'smtp' ] }, mx);
      nav.menuSearch = 'SMTP';
      x.test(nav.menuSearchPredicate_.f(smtp), 'the side menu search finds a menu by keyword, case ignored');
      nav.menuSearch = 'email';
      x.test(nav.menuSearchPredicate_.f(smtp), 'the side menu search finds a menu by label, case ignored');
      nav.menuSearch = 'agents';
      x.test(! nav.menuSearchPredicate_.f(smtp), 'the side menu search skips a menu that holds the text nowhere');
      nav.menuSearch = '  ';
      x.test(E.TRUE.cls_.isInstance(nav.menuSearchPredicate_), 'blank text is no search');

      // The Material side menu takes the same rule from MenuSearch.
      var md = this.MDSideNavigation.create({}, mx.createSubContext({
        auth: null, currentMenu: null, isMenuOpen: false, pushMenu: () => {},
        subject: { user: null }, theme: { navigationRootMenu: '' }
      }));
      md.menuSearch = 'SMTP';
      x.test(md.menuSearchPredicate_.f(smtp), 'the Material side menu finds a menu by keyword too');
    }
  ]
});
