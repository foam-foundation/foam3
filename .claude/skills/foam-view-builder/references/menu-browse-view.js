/**
 * EXEMPLAR — a custom, read-only BROWSE view launched from a menu.
 *
 * Copy this shape for any standalone view that is opened from a menu entry and
 * shows a list of records. Each thing that is easy to forget is explained at
 * the line that does it. In-tree views that use the same pieces:
 *   - viewTitle + stack.setTitle on a custom view: foam3/src/foam/core/auth/PermissionTableView.js:241-249
 *   - a comics DAOView embedded in a custom view:  foam3/src/foam/comics/v3/DAOController.js
 */

// ---- row model -------------------------------------------------------------
foam.CLASS({
  package: 'foam.u2',
  name: 'ExampleRow',
  ids: [ 'id' ],
  properties: [
    { class: 'String', name: 'id', hidden: true },
    { class: 'String', name: 'name' },
    { class: 'String', name: 'status' }
  ]
});

// ---- the view --------------------------------------------------------------
foam.CLASS({
  package: 'foam.u2',
  name: 'ExampleBrowseView',
  extends: 'foam.u2.View',

  implements: [ 'foam.mlang.Expressions' ],   // gives this.FALSE / this.EQ for predicates

  // 'stack' is how the title/breadcrumb get set. Optional ('?') so the view
  // still renders outside a stack.
  imports: [ 'stack?' ],

  requires: [
    'foam.comics.v2.DAOControllerConfig',
    'foam.comics.v3.DAOView',
    'foam.dao.MDAO',
    'foam.lang.Action',
    'foam.u2.ExampleRow'
  ],

  css: `
    ^ { padding: 24px; height: 100%; box-sizing: border-box; }
  `,

  properties: [
    {
      // TITLE/BREADCRUMB SOURCE. The menu's `label` is not used as the view
      // title. StackView reads `viewTitle$` off the view or its FIRST child only
      // (foam3/src/foam/u2/stack/StackView.js:107-111), and the navigation Stack
      // is fed by stack.setTitle() in render() below. Provide both.
      name: 'viewTitle',
      value: 'Example Browse'
    },
    {
      name: 'dao',
      factory: function() { return this.MDAO.create({ of: this.ExampleRow }, this); }
    }
  ],

  methods: [
    function init() {
      this.SUPER();
      this.load();
    },

    function load() {
      // Re-populate the in-memory DAO. Reassigning this.dao (rather than mutating)
      // lets a slot-bound DAOView pick up the new instance reactively.
      var fresh = this.MDAO.create({ of: this.ExampleRow }, this);
      fresh.put(this.ExampleRow.create({ id: '1', name: 'alpha', status: 'OK' }, this));
      this.dao = fresh;
    },

    function render() {
      var self = this;
      this.addClass();

      // TITLE + BREADCRUMB: a custom view sets this itself. The embedded
      // foam.comics.v3.DAOView never calls stack.setTitle — only DAOController
      // does (foam3/src/foam/comics/v3/DAOController.js:106), and this view
      // embeds the former. Stack.setTitle: foam3/src/foam/core/u2/navigation/Stack.js:254.
      this.onDetach(this.stack?.setTitle(this.viewTitle$, this));

      // BROWSE TABLE via the comics DAO stack: AQL search, filter chips, column
      // config, count and CSV export come for free. Never hand-roll
      // foam.u2.table.TableView for a DAO list.
      var config = this.DAOControllerConfig.create({
        dao$:                   this.dao$,
        // read-only browse: no create / edit / delete
        createPredicate:        this.FALSE,
        editPredicate:          this.FALSE,
        deletePredicate:        this.FALSE,
        searchColumns:          [ 'name', 'status' ],
        tableColumns:           [ 'name', 'status' ],
        disableSelection:       true,
        disableTableRowActions: true,
        // Toolbar action — sits next to refresh/export. The toolbar renders its
        // actions with `data: self` = the DAOView (foam3/src/foam/comics/v3/DAOView.js:89),
        // so a closure-bound Action is how `code` reaches THIS view.
        DAOActions: [
          this.Action.create({
            name:  'reload',
            label: 'Reload',
            code:  function() { self.load(); }
          })
        ]
      }, this);

      // columnStorage: null stops a localStorage column set from another table
      // overriding tableColumns (foam3/src/foam/u2/table/UnstyledTableView.js:50, :130).
      this.startContext({ columnStorage: null })
        .tag({ class: 'foam.comics.v3.DAOView', data$: this.dao$, config: config })
      .endContext();
    }
  ]
});

/*
 * WIRING — two separate steps:
 *
 * 1. Register both classes in the nearest pom.js:
 *      { name: "foam/u2/ExampleRow",        flags: "web" },
 *      { name: "foam/u2/ExampleBrowseView", flags: "web" },
 *
 * 2. Add the menu entry to the app's menus journal, parented on an existing SubMenu:
 *      p({"class":"foam.core.menu.Menu","id":"admin.example","label":"Example",
 *         "handler":{"class":"foam.core.menu.ViewMenu",
 *                    "view":{"class":"foam.u2.ExampleBrowseView"}},
 *         "parent":"admin"})
 *
 * VERIFY IN THE RUNNING APP: title + breadcrumb show, the search bar filters,
 * the toolbar action appears. Loading the class in node proves it parses,
 * nothing more.
 */
