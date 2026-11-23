/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.test',
  name: 'TreeViewSearchJSTest',
  extends: 'foam.core.test.JSTest',

  documentation: `A TreeView given treeDAO (the whole tree) and data (a search's
    matches) shows the matches with their ancestors, ancestors open; a match's
    hidden children leave it no open/close arrow; a parent outside treeDAO
    stops the climb; a child outside treeDAO follows its parent; a new search
    replaces the shown rows; without treeDAO every row shows, as before.`,

  requires: [
    'foam.core.menu.Menu',
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
      menuDAO.put(this.Menu.create({ id: 'admin', label: 'Admin' }, mx));
      menuDAO.put(this.Menu.create({ id: 'admin.data', parent: 'admin', label: 'Data' }, mx));
      menuDAO.put(this.Menu.create({ id: 'admin.data.agents', parent: 'admin.data', label: 'Agents' }, mx));
      menuDAO.put(this.Menu.create({ id: 'admin.users', parent: 'admin', label: 'Users' }, mx));
      menuDAO.put(this.Menu.create({ id: 'help', label: 'Help' }, mx));
      var M   = this.Menu;
      var E   = this.ExpressionsSingleton.create();
      var rel = foam.core.menu.MenuMenuChildrenRelationship;
      var fmt = function(data) { this.add(data.label); };
      var search = label => menuDAO.where(E.EQ(M.LABEL, label));

      // A match two levels down shows with its parents, and they open.
      var tree = await mount(this.TreeView.create({
        data: search('Agents'), treeDAO: menuDAO, relationship: rel, startExpanded: false, formatter: fmt
      }, mx));
      var root = tree.el_();
      x.test(await waitShown(root, [ 'admin', 'admin.data', 'admin.data.agents' ]),
        'a match shows with its parents and nothing else, got ' + JSON.stringify(shownIds(root)));
      x.test(row(root, 'admin')?.getAttribute('aria-expanded') === 'true',
        'a parent of a match opens, got ' + row(root, 'admin')?.getAttribute('aria-expanded'));

      // A new search replaces the shown rows; a matched row whose children are
      // all hidden draws no open/close arrow.
      tree.data = search('Admin');
      x.test(await waitShown(root, [ 'admin' ]),
        'a new search replaces the shown rows, got ' + JSON.stringify(shownIds(root)));
      x.test(! row(root, 'admin')?.hasAttribute('aria-expanded'),
        'a match whose children are all hidden has no open/close state, got ' + row(root, 'admin')?.getAttribute('aria-expanded'));
      tree.remove();

      // A parent outside treeDAO stops the climb: a scope such as "enabled
      // menus only" is never widened by a search.
      var scoped = await mount(this.TreeView.create({
        data: search('Agents'), treeDAO: menuDAO.where(E.NEQ(M.ID, 'admin')), relationship: rel, startExpanded: false, formatter: fmt
      }, mx));
      await new Promise(r => setTimeout(r, 500));
      x.test(shownIds(scoped.el_()).length === 0,
        'a match whose parent is outside treeDAO does not bring the parent back, got ' + JSON.stringify(shownIds(scoped.el_())));
      scoped.remove();

      // A child the relationship builds from another source (not in treeDAO,
      // like Data Management's DAO menus) cannot be judged by the search: it
      // follows its parent, and its parent keeps its open/close arrow.
      var mixed = await mount(this.TreeView.create({
        data: search('Admin'), treeDAO: menuDAO.where(E.NEQ(M.ID, 'admin.users')), relationship: rel, startExpanded: true, formatter: fmt
      }, mx));
      x.test(await waitShown(mixed.el_(), [ 'admin', 'admin.users' ]),
        'a child outside treeDAO follows its shown parent, got ' + JSON.stringify(shownIds(mixed.el_())));
      x.test(mixed.el_().querySelector('[name="admin"]')?.getAttribute('aria-expanded') === 'true',
        'its parent keeps its open/close state, got ' + mixed.el_().querySelector('[name="admin"]')?.getAttribute('aria-expanded'));
      mixed.remove();

      // Without treeDAO, data is the whole tree and every row shows.
      var plain = await mount(this.TreeView.create({
        data: menuDAO, relationship: rel, startExpanded: true, formatter: fmt
      }, mx));
      x.test(await waitShown(plain.el_(), [ 'admin', 'admin.data', 'admin.data.agents', 'admin.users', 'help' ]),
        'without treeDAO every row shows, got ' + JSON.stringify(shownIds(plain.el_())));
      plain.remove();
    }
  ]
});
