/**
 * @license
 * Copyright 2016 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.view',
  name: 'TreeViewRow',
  extends: 'foam.u2.Element',

  requires: [
    'foam.mlang.ExpressionsSingleton',
    'foam.u2.tag.Image'
  ],

  exports: [
    'showTreeRow',
    'data'
  ],

  imports: [
    'collapsed',
    'dblclick?',
    'draggable',
    'onObjDrop',
    'returnExpandedCSS?',
    'selection',
    'startExpanded',
    'translationService?',
    'treeHiddenIds',
    'treeOpenIds',
    'rowConfig'
  ],

  css: `
    << {
      inset: none;
      white-space: nowrap;
    }

    <<label-container {
      display: flex;
      align-items: center;
    }

    <<heading {
      cursor: pointer;
      min-height: 40px;
      display: flex;
      align-items: center;
    }

    <<disabled {
      opacity: 0.4;
      cursor: not-allowed;
      pointer-events: none;
    }

    button<<button {
      padding: 8px;
      width: 100%;
      justify-content: flex-start;
    }

    <<button svg { fill: currentColor; }
  `,

  classes: [
    {
      name: 'LabelView',
      extends: 'foam.u2.View',
      requires: [
        'foam.u2.tag.Image'
      ],

      css: `
        <<select-level {
          display: flex;
          justify-content: space-between;
          overflow: hidden;
          padding-right: 8px;
          text-align: left;
          width: 100%;
        }

        <<select-level > * {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        <<toggle-icon {
          align-self: center;
          transition: 0.2s linear;
        }

        <<toggle-icon svg {
          width: 0.75em;
          height: 0.75em;
        }

        /* copied from foam.core.controller.Fonts so that it works without CORE */
        .p-semiBold {
          line-height: 1.78;
          font-size: 1.4rem;
          font-style: normal;
          font-weight: $font-medium;
          line-height: 1.71;
          margin: 0;
        }
      `,

      properties: [
        {
          name: 'row'
        }
      ],

      methods: [
        function render() {
          let row  = this.row;
          let self = this;
          var selectedSlot = row.slot(function(selected_) {
            return selected_ ? 'p-semiBold' : 'p';
          });
          this.addClass(this.myClass('select-level'))
            .enableClass(this.myClass('select-level-selected'), row.selected_$)
            .callIfElse(row.rowConfig?.[row.data.id],
              function() {
                this.tag(row.rowConfig?.[row.data.id])
              },
              function() {
                this.start()
                  .addClass(selectedSlot)
                  .addClass(this.myClass('label'))
                  .call(row.formatter, [row.data, self.__context__])
                .end();
              }
            )
            .add(row.hasChildren$.map(hasChildren => {
              if ( ! hasChildren ) return self.E();
              return self.E()
                .addClass(self.myClass('toggle-icon'))
                .style({
                  'transform': row.expanded$.map(function(c) { return c ? 'rotate(90deg)': 'rotate(0deg)'; })
                })
                .on('click', this.toggleExpanded)
                .tag(self.Image, { glyph: 'next' });
            }));
        }
      ]
    }
  ],

  properties: [
    {
      name: 'data'
    },
    {
      name: 'relationship'
    },
    {
      class: 'Boolean',
      name: 'expanded',
      // Remembered by id, so a row drawn again (its parent's children reload)
      // keeps the state the person or a search gave it.
      postSet: function(o, n) { this.collapsed[this.data.id] = ! n; }
    },
    {
      class: 'Boolean',
      name: 'openedBySearch_',
      documentation: `True while this row is open only because a search opened
        it (a match is below it). When the search no longer needs it, the row
        closes again; a click on it makes the state the person's own.`
    },
    {
      class: 'Function',
      name: 'formatter'
    },
    {
      class: 'Boolean',
      name: 'hasChildren',
      expression: function(subMenus, treeHiddenIds) {
        return subMenus.some(c => ! treeHiddenIds?.[c.id]);
      }
    },
    {
      class: 'Boolean',
      name: 'drillsIn',
      documentation: `True when clicking a row with children replaces the list
        with that row's children (NestedTreeView) instead of expanding them in
        place. Such a row is not a disclosure, so it carries no aria-expanded.`
    },
    {
      class: 'Array',
      name: 'subMenus'
    },
    {
      class: 'Function',
      name: 'onClickAddOn'
    },
    {
      class: 'Int',
      name: 'level'
    },
    {
      class: 'Boolean',
      name: 'selected_',
      expression: function(selection, data$id) {
        return selection && foam.util.equals(selection.id, this.data.id);
      }
    },
    {
      class: 'Boolean',
      name: 'showTreeRow',
      value: true
    }
  ],

  methods: [
    function render() {
      this.SUPER();
      var self = this;

      var cb = () => {
        this.data[self.relationship.forwardName].select().then(function( val ) {
          self.subMenus = val.array;
        });
      }

      this.onDetach(this.data[self.relationship.forwardName].listen({ put: cb }));
      cb();

      this.onDetach(this.treeOpenIds$.sub(this.followSearch));
      this.followSearch();

      var labelString = this.data.label;
      if ( this.translationService ) {
        labelString = self.translationService.getTranslation(foam.locale, self.data.label, self.data.label);
      }

      // Check if handler has a custom row view
      if ( this.data && this.data.createRowView ) {
        this.start()
          .style({
            'padding-left': (((self.level - 0.5) * 16) + 'px')
          })
          .tag(this.data.createRowView(this.__context__, this.data))
        .end();
        return;
      }

      // Regular menu item rendering
      this.
        addClass(this.myClass()).
        show(this.slot(function(showTreeRow, treeHiddenIds) {
          return showTreeRow && ! treeHiddenIds?.[self.data.id];
        })).
        enableClass(this.myClass('selected'), this.selected_$).
        on('dblclick', this.onDblClick).
        callIf(this.draggable, function() {
          this.
          attrs({ draggable: 'true' }).
          on('dragstart', this.onDragStart).
          on('dragenter', this.onDragOver).
          on('dragover',  this.onDragOver).
          on('drop',      this.onDrop);
        }).
        start().
          addClass(self.myClass('heading')).
          enableClass(self.myClass('disabled'), self.data.enabled$.not()).
          style({
            'padding-left': (((self.level - 0.5) * 16 ) + 'px')
          }).
          startContext({ data: self }).
            start(self.ON_CLICK_FUNCTIONS, {
              buttonStyle: 'UNSTYLED',
              // Every menu row shares the same action, so the button's DOM name
              // would be 'onClickFunctions' for all of them; use the menu id so
              // recorders/tests get a stable, unique selector per menu.
              name: self.data.id,
              label: { class: 'foam.u2.view.TreeViewRow.LabelView', row: self },
              ariaLabel: labelString,
              size: 'SMALL',
              themeIcon$: self.data$.dot('themeIcon') || '',
              icon$: self.data$.dot('icon') || ''
            }).
              attrs({
                title: self.data$.dot('tooltip').map(t => t || labelString),
                // Rows that expand in place announce open/closed to screen
                // readers. Leaf rows and rows that drill in (NestedTreeView
                // replaces the list) must not carry aria-expanded at all, or they
                // would be read as "collapsed"; undefined removes the attribute.
                'aria-expanded': self.slot(function(hasChildren, drillsIn, expanded) {
                  return hasChildren && ! drillsIn ? String(expanded) : undefined;
                })
              }).
              enableClass('selected', this.selected_$).
              addClass(this.myClass('button')).
            end().
          endContext().
        end().
        start().
          show(this.expanded$).
          add(this.slot(function( subMenus ) {
            return this.E().forEach(subMenus/*.dao*/, function( obj ) {
              this.add(self.cls_.create({
                data:             obj,
                formatter:        self.formatter,
                relationship:     self.relationship,
                expanded:         obj.id in self.collapsed ? ! self.collapsed[obj.id] : self.startExpanded,
                onClickAddOn:     self.onClickAddOn,
                // Inline children of a drill-in row (startExpanded) share its
                // click handler, so a click on one replaces the list too.
                drillsIn:         self.drillsIn,
                level:            self.level + 1
              }, self)).addClass('child-menu');
            });
          })).
        end();
    }
  ],

  listeners: [
    function onDblClick(e) {
      // A row's element holds its child rows, so without this a double-click
      // on a child also reaches every parent row and the top one opens last.
      e.stopPropagation();
      this.dblclick && this.dblclick(this.data);
    },

    function followSearch() {
      // A search opens the rows above its matches; once it no longer needs a
      // row open, the row goes back to how it was before the search.
      var aboveAMatch = !! this.treeOpenIds?.[this.data.id];
      if ( aboveAMatch && ! this.expanded ) {
        this.openedBySearch_ = true;
        this.expanded        = true;
      } else if ( ! aboveAMatch && this.openedBySearch_ ) {
        this.openedBySearch_ = false;
        this.expanded        = false;
      }
    },

    function onDragStart(e) {
      e.dataTransfer.setData('application/x-foam-obj-id', this.data.id);
      e.stopPropagation();
    },

    function onDragOver(e) {
      if ( ! e.dataTransfer.types.some(function( m ) { return m === 'application/x-foam-obj-id'; }) )
        return;

      var id = e.dataTransfer.getData('application/x-foam-obj-id');

      if ( foam.util.equals(id, this.data.id) )
        return;

      e.preventDefault();
      e.stopPropagation();
    },

    function onDrop(e) {
      if ( ! e.dataTransfer.types.some(function( m ) { return m === 'application/x-foam-obj-id'; }) )
        return;

      var id = e.dataTransfer.getData('application/x-foam-obj-id');

      if ( foam.util.equals(id, this.data.id) ) return;

      e.preventDefault();
      e.stopPropagation();

      var self = this;
      var dao  = this.__context__[this.relationship.targetDAOKey];
      dao.find(id).then(function( obj ) {
        if ( ! obj ) return null;

        // TODO: We shouldn't have to remove then put,
        // We currently have to because the FLOW editor is not updating properly
        // on a put event for an object that it already has.
        dao.remove(obj).then(function() {
          self.data[self.relationship.forwardName].put(obj).then(function( obj ) {
            self.onObjDrop(obj, id);
          });
        });
      });
    },

    function selected(e) {
      this.selection = this.data;
      e.preventDefault();
      e.stopPropagation();
    }
  ],

  actions: [
    {
      name: 'onClickFunctions',
      label: '',
      code: function () {
        if ( this.onClickAddOn )
          this.onClickAddOn(this.data, this.hasChildren);
        this.toggleExpanded();
      }
    },
    {
      name: 'toggleExpanded',
      label: '',
      code: function() {
        this.openedBySearch_ = false;
        this.expanded        = ! this.expanded;
        this.selection       = this.data;
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.u2.view',
  name: 'TreeView',
  extends: 'foam.u2.Element',

  requires: [
    'foam.mlang.ExpressionsSingleton',
    'foam.mlang.predicate.True',
    'foam.u2.view.TreeViewRow'
  ],

  imports: [
    'theme'
  ],

  exports: [
    'collapsed',
    'draggable',
    'onObjDrop',
    'openIds_ as treeOpenIds',
    'rowConfig',
    'selection',
    'hiddenIds_ as treeHiddenIds',
    'startExpanded'
  ],

  css: `
    << {
      overflow-y: auto;
      overflow-x: hidden;
      padding: 0 8px;
    }
  `,

  properties: [
    {
      class: 'foam.dao.DAOProperty',
      name: 'data'
    },
    {
      class: 'foam.mlang.predicate.PredicateProperty',
      name: 'searchPredicate',
      documentation: `A search. The tree shows the rows it accepts with the rows
        above them, and opens those, as MUI X and AG Grid do for a filtered
        tree. Rows inside an accepted row show too, closed. Every row the tree can draw is judged, wherever the relationship
        found it: Data Management builds its DAO menus itself, so they are in
        no DAO the caller holds. data stays the whole tree. Unset or TRUE:
        every row shows.`
    },
    {
      name: 'hiddenIds_',
      documentation: `With a searchPredicate: the ids of rows that do not pass it,
        have no row below them that does, and sit inside no row that does.
        Null hides nothing.`,
      value: null
    },
    {
      name: 'openIds_',
      documentation: 'With a searchPredicate: the ids of rows with a match below them; they open.',
      value: null
    },
    {
      class: 'Int',
      name: 'hiddenIdsRun_',
      documentation: 'Counts updateHiddenIds runs, so a slow run for an old search does not overwrite a newer one.'
    },
    {
      name: 'relationship'
    },
    {
      name: 'selection'
    },
    {
      class: 'Function',
      name: 'formatter'
    },
    {
      class: 'Boolean',
      name: 'startExpanded',
      value: false
    },
    {
      class: 'Function',
      name: 'onClickAddOn'
    },
    {
      name: 'rowConfig',
      documentation: `
      Allows overrides for menu Row views where required
      Format: { menuId: viewSpec }
      ex: { notifications: {class: 'NotificationMenuItem' } }
      `
    },
    {
      class: 'Boolean',
      name: 'draggable',
      documentation: 'Enable to allow drag&drop editing.'
    },
    [ 'defaultRoot', '' ],
    {
      // Set of collapsed TreeRows
      name: 'collapsed',
      factory: function() { return {}; }
    }
  ],

  methods: [
    function render() {
      this.startExpanded = this.startExpanded;

      var of  = this.__context__.lookup(this.relationship.sourceModel);
      var dao = this.data$proxy.where(
        this.EQ(of.getAxiomByName(this.relationship.inverseName), this.defaultRoot));
      var self = this;
      var isFirstSet = false;

      this.onDetach(this.searchPredicate$.sub(this.updateHiddenIds));
      this.onDetach(this.data$proxy.on.sub(this.updateHiddenIds));
      this.updateHiddenIds();

      this.addClass().
        select(dao, function( obj ) {
          if ( ! isFirstSet && ! self.selection ) {
            self.selection = obj;
            isFirstSet = true;
          }
          this.tag({
            class:        foam.u2.view.TreeViewRow,
            data:         obj,
            relationship: self.relationship,
            expanded:     self.startExpanded,
            formatter:    self.formatter,
            onClickAddOn: self.onClickAddOn,
            level:        0
          });
        });
    },

    function onObjDrop(obj, target) {
      // Template Method
    }
  ],

  listeners: [
    {
      name: 'updateHiddenIds',
      documentation: `Walks the tree from its top rows through the relationship,
        as the rows draw it: a row shows if searchPredicate accepts it, a row
        below it is accepted, or it is inside an accepted row; a row with an
        accepted row below it opens.`,
      isMerged: true,
      delay: 50,
      code: async function() {
        var run    = ++this.hiddenIdsRun_;
        // A list screen with no search passes AND(TRUE, TRUE): simplify first.
        var search = this.searchPredicate?.partialEval();
        if ( ! search || this.True.isInstance(search) ) {
          this.hiddenIds_ = null;
          this.openIds_   = null;
          return;
        }

        var of      = this.__context__.lookup(this.relationship.sourceModel);
        var forward = this.relationship.forwardName;
        var hidden  = {};
        var open    = {};
        var seen    = {};
        // Answers whether obj or a row below it passes the search. Rows inside
        // a passing row show too, as AG Grid does, but open only for a pass
        // below them: searching a folder's name shows the folder, closed, with
        // its contents one click away.
        var judge = async (obj, insideMatch) => {
          if ( seen[obj.id] ) return false;
          seen[obj.id] = true;
          var passes   = search.f(obj);
          var children = (await obj[forward].select()).array;
          var below    = (await Promise.all(children.map(c => judge(c, insideMatch || passes)))).some(b => b);
          if ( below ) open[obj.id] = true;
          if ( ! ( below || passes || insideMatch ) ) hidden[obj.id] = true;
          return below || passes;
        };
        var top = await this.data.where(
          this.EQ(of.getAxiomByName(this.relationship.inverseName), this.defaultRoot)).select();
        await Promise.all(top.array.map(o => judge(o, false)));

        if ( run !== this.hiddenIdsRun_ ) return;
        this.hiddenIds_ = hidden;
        this.openIds_   = open;
      }
    }
  ]
});
