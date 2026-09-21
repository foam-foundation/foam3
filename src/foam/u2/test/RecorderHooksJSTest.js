/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.test',
  name: 'RecorderHooksOwner',
  flags: [ 'js' ],
  properties: [ 'id', 'label' ]
});

foam.CLASS({
  package: 'foam.u2.test',
  name: 'RecorderHooksItem',
  flags: [ 'js' ],
  properties: [
    'id',
    { class: 'Reference', of: 'foam.u2.test.RecorderHooksOwner', name: 'owner', targetDAOKey: 'recorderHooksOwnerDAO' }
  ]
});

foam.CLASS({
  package: 'foam.u2.test',
  name: 'RecorderHooksJSTest',
  extends: 'foam.core.test.JSTest',

  documentation: `The hooks recorders and screen readers key on: a table cell is
    named after its full column name (a nested 'owner.id' column and a plain
    'id' column get different names); a choice row carries its value in
    data-value and no name; only a tree row that expands in place carries
    aria-expanded, a NestedTreeView row that drills in does not.`,

  requires: [
    'foam.core.menu.Menu',
    'foam.dao.ArrayDAO',
    'foam.u2.test.RecorderHooksItem',
    'foam.u2.test.RecorderHooksOwner',
    'foam.u2.view.NestedTreeView',
    'foam.u2.view.RichChoiceView',
    'foam.u2.table.TableView',
    'foam.u2.view.TreeView'
  ],

  methods: [
    async function runTest(x) {
      x = x.createSubContext({
        translationService: { getTranslation: (locale, key, dflt) => dflt }
      });
      var settle = () => new Promise(r => setTimeout(r, 100));
      var mount  = async e => { e.write(x.document.body); await settle(); return e; };
      // Rows arrive from async DAO selects; poll for the first match, up to 3s.
      var waitFor = async (root, sel) => {
        for ( var i = 0 ; i < 30 ; i++ ) {
          var el = root.querySelector(sel);
          if ( el ) return el;
          await settle();
        }
        return null;
      };

      // Table: one nested column and one plain column that share a last segment.
      var ownerDAO = this.ArrayDAO.create({ of: this.RecorderHooksOwner, array: [
        this.RecorderHooksOwner.create({ id: 'o1', label: 'Owner one' }, x)
      ] }, x);
      var itemDAO = this.ArrayDAO.create({ of: this.RecorderHooksItem, array: [
        this.RecorderHooksItem.create({ id: 'i1', owner: 'o1' }, x)
      ] }, x);
      var tx = x.createSubContext({ recorderHooksOwnerDAO: ownerDAO });
      var table = await mount(this.TableView.create({ data: itemDAO, selectedColumnNames: [ 'id', 'owner.id' ] }, tx));
      await waitFor(table.el_(), '[name="owner.id"], [name="id"]');
      var cells = Array.from(table.el_().querySelectorAll('[name]')).map(el => el.getAttribute('name')).filter(n => n === 'id' || n === 'owner.id');
      table.remove();
      x.test(cells.includes('id') && cells.includes('owner.id'), 'table cells are named by full column name, got ' + JSON.stringify(cells));
      x.test(cells.filter(n => n === 'id').length === 1, 'the nested column does not reuse the plain column name, got ' + JSON.stringify(cells));

      // Choice rows: value in data-value, name only on the root.
      var choice = await mount(this.RichChoiceView.create({
        sections: [ { dao: ownerDAO } ],
        data: 'o1',
        prop: foam.u2.test.RecorderHooksItem.OWNER
      }, x));
      choice.dropdown_.parentEl = choice.selectionEl_.el_();
      choice.dropdown_.open(0, 0);
      var row = await waitFor(x.document, '[role="option"][data-value="o1"]');
      x.test(!! row, 'choice row is addressable by data-value');
      x.test(row && ! row.hasAttribute('name'), 'choice row carries no name attribute');
      x.test(choice.el_().getAttribute('name') === 'owner', 'choice root is named after the property, got ' + choice.el_().getAttribute('name'));
      choice.remove();

      // Trees: same menu data, two views.
      // Menu.children reads menuDAO from the menu's own context, so the menus
      // are created in the context that carries the DAO.
      var menuDAO = this.ArrayDAO.create({ of: this.Menu }, x);
      var mx = x.createSubContext({ menuDAO: menuDAO });
      menuDAO.put(this.Menu.create({ id: 'parent', label: 'Parent' }, mx));
      menuDAO.put(this.Menu.create({ id: 'parent.child', parent: 'parent', label: 'Child' }, mx));
      var relationship = foam.core.menu.MenuMenuChildrenRelationship;
      var fmt = function(data) { this.add(data.label); };
      var tree = await mount(this.TreeView.create({ data: menuDAO, relationship: relationship, startExpanded: false, formatter: fmt }, mx));
      var treeRow = await waitFor(tree.el_(), '[name="parent"][aria-expanded]');
      x.test(treeRow && treeRow.getAttribute('aria-expanded') === 'false', 'TreeView row with children announces aria-expanded, got ' + (treeRow && treeRow.getAttribute('aria-expanded')));
      tree.remove();

      var nested = await mount(this.NestedTreeView.create({ data: menuDAO, relationship: relationship, startExpanded: false, formatter: fmt, defaultRoot: '' }, mx));
      var nestedRow = await waitFor(nested.el_(), '[name="parent"]');
      await new Promise(r => setTimeout(r, 500)); // let hasChildren resolve before reading the attribute
      x.test(!! nestedRow, 'NestedTreeView renders the parent row');
      x.test(nestedRow && ! nestedRow.hasAttribute('aria-expanded'), 'NestedTreeView drill-in row carries no aria-expanded, got ' + (nestedRow && nestedRow.getAttribute('aria-expanded')));
      nested.remove();
    }
  ]
});
