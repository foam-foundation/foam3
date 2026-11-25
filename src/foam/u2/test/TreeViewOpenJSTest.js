/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.test',
  name: 'TreeViewOpenJSTest',
  extends: 'foam.core.test.JSTest',

  documentation: `A double-click on a TreeView row opens that row only: a row's
    element holds its child rows, so a double-click on a child must not also
    reach its parents.`,

  requires: [
    'foam.core.menu.Menu',
    'foam.dao.ArrayDAO',
    'foam.u2.view.TreeView'
  ],

  methods: [
    async function runTest(x) {
      var opened = [];
      x = x.createSubContext({
        translationService: { getTranslation: (locale, key, dflt) => dflt },
        dblclick: obj => opened.push(obj.id)
      });
      var settle = () => new Promise(r => setTimeout(r, 100));
      var waitFor = async (root, sel) => {
        for ( var i = 0 ; i < 30 ; i++ ) {
          var el = root.querySelector(sel);
          if ( el ) return el;
          await settle();
        }
        return null;
      };

      // Menu.children reads menuDAO from the menu's own context, so the menus
      // are created in the context that carries the DAO.
      var menuDAO = this.ArrayDAO.create({ of: this.Menu }, x);
      var mx = x.createSubContext({ menuDAO: menuDAO });
      menuDAO.put(this.Menu.create({ id: 'admin', label: 'Admin' }, mx));
      menuDAO.put(this.Menu.create({ id: 'admin.data', parent: 'admin', label: 'Data' }, mx));
      menuDAO.put(this.Menu.create({ id: 'admin.data.agents', parent: 'admin.data', label: 'Agents' }, mx));

      var tree = this.TreeView.create({
        data: menuDAO, relationship: foam.core.menu.MenuMenuChildrenRelationship,
        startExpanded: true, formatter: function(data) { this.add(data.label); }
      }, mx);
      tree.write(x.document.body);

      var leaf = await waitFor(tree.el_(), '[name="admin.data.agents"]');
      x.test(!! leaf, 'the nested row renders');
      leaf?.dispatchEvent(new x.window.MouseEvent('dblclick', { bubbles: true }));
      x.test(opened.join(',') === 'admin.data.agents',
        'a double-click on a nested row opens that row only, got ' + JSON.stringify(opened));

      opened.length = 0;
      tree.el_().querySelector('[name="admin"]')?.dispatchEvent(new x.window.MouseEvent('dblclick', { bubbles: true }));
      x.test(opened.join(',') === 'admin',
        'a double-click on a top row opens it, got ' + JSON.stringify(opened));
      tree.remove();
    }
  ]
});
