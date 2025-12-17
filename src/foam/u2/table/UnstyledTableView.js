/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.table',
  name: 'UnstyledTableView',
  extends: 'foam.u2.table.TableComponentView',

  implements: [
    'foam.mlang.Expressions'
  ],

  mixins: ['foam.u2.memento.Memorable'],

  requires: [
    'foam.lang.SimpleSlot',
    'foam.comics.v2.DAOControllerConfig',
    'foam.dao.ProxyDAO',
    'foam.core.column.TableColumnOutputter',
    'foam.u2.CheckBox',
    'foam.u2.layout.Rows',
    'foam.u2.layout.Cols',
    'foam.u2.stack.StackBlock',
    'foam.u2.table.TableHeaderComponent',
    'foam.u2.tag.Image',
    'foam.u2.view.EditColumnsView',
    'foam.u2.view.LazyScrollManager',
    'foam.u2.view.OverlayActionListView'
  ],

  exports: [
    'as table',
    'columns',
    'colWidthUpdated',
    'config',
    'currentMemento_ as memento',
    'nestedPropsAndIndexes',
    'props',
    'propertyNamesToQuery',
    'selectedColumnsWidth',
    'selectedObjects',
    'selection'
  ],

  imports: [
    'auth?',
    'columnStorage',
    'config? as importedConfig',
    'filteredTableColumns?',
    'flowColumns?',
    'stack?',
    'selection? as importSelection'
  ],

  constants: [
    {
      type: 'Int',
      name: 'MIN_COLUMN_WIDTH_FALLBACK',
      value: 100
    },
    {
      type: 'Int',
      name: 'EDIT_COLUMNS_BUTTON_CONTAINER_WIDTH',
      value: 60
    },
    {
      type: 'Int',
      name: 'CHECKBOX_CONTAINER_WIDTH',
      value: 42
    },
    {
      type: 'Char',
      name: 'DESCENDING_ORDER_CHAR',
      value: '-'
    },
    {
      type: 'Char',
      name: 'ASCENDING_ORDER_CHAR',
      value: '+'
    }
  ],

  properties: [
    {
      class: 'Class',
      name: 'of'
    },
    {
      class: 'foam.dao.DAOProperty',
      name: 'data',
      postSet: function(_, data) {
        if ( ! this.of && data ) this.of = data.of;
      }
    },
    {
      class: 'FObjectProperty',
      of: 'foam.comics.v2.DAOControllerConfig',
      name: 'config',
      factory: function() {
        if ( this.importedConfig )
          return this.importedConfig;
        return this.DAOControllerConfig.create({ dao: this.data });
      }
    },
    {
      name: 'selection',
      expression: function(importSelection) { return importSelection || null; },
    },
    {
      name: 'order'
    },
    {
      name: 'columns_',
      documentation: `Internal prop used by the table view to render the columns,
        should always have the current table columns`,
      factory: function() { return []; }
    },
    {
      name: 'allColumns',
      documentation: `Array that stores all properties and actions defined
        in the model and filters out any the user does not have permission to access
        Should be accessed through the 'columns' prop instead of being used directly`
    },
    {
      name: 'selectedColumnNames',
      documentation: `Property responsible for deciding what columns to use when tableView is rendered
        Order of precedece: Memento -> columnStorage (localStorage) -> default cols.
        Gets updated when 'columns' changes and tries to fetch the latest value from columnStorage.
        Can also be set by any column config view to change the current columns loaded by the table`,
      memorable: true,
      expression: function(columns, of) {
        var ls = JSON.parse(this.columnStorage.getItem(of.id))?.map(c => foam.Array.isInstance(c) ? c[0] : c)
        return ls || columns;
      },
      adapt: function(_,n) {
        return foam.Array.isInstance(n) ? n : n.split(',');
      }
    },
    {
      name: 'selectedColumnsWidth',
      documentation: `Manages preferred column widths for a user, responsible for
        grabbing widths from LS and passing them to table columns. Updating column
        widths here should propogate changes to the rest of the view and LS`,
      factory: function() {
        var local = {};
        JSON.parse(this.columnStorage.getItem(this.of.id))?.map(c => {
          foam.Array.isInstance(c) ?
          local[c[0]] = c[1] :
          local[c] = undefined;
        });
        return local;
      }
    },
    {
      class: 'Boolean',
      name: 'colWidthUpdated',
      documentation: `used to trigger/listen to columnWidth changes as they are stored
        in an object where value changes do not trigger slots`
    },
    {
      name: 'columns',
      documentation:  `Stores an Array of preferred columns defined in the tableColumns
      axiom on the model, if undefined this acts as an alias for allColumns`,
      expression: function(of, config) {
        if ( ! of ) return [];
        return config?.tableColumns;
      }
    },
    {
      class: 'FObjectArray',
      of: 'foam.lang.Action',
      name: 'contextMenuActions',
      documentation: `
        Each table row has a context menu that contains actions you can perform
        on the object in that row. The actions used to populate that menu come
        from two different sources. The first source is this property. If you
        want a context menu action to do something in the view, then you should
        write the code for that action in the view model and pass it to the
        table view via this property. The second source of actions is from the
        model of the object being shown in the table.
      `
    },
    {
      class: 'Boolean',
      name: 'editColumnsEnabled',
      value: true,
      documentation: 'Set this to true to let the user select columns.'
    },
    {
      class: 'Boolean',
      name: 'disableUserSelection',
      value: false,
      documentation: 'Ignores selection by user.'
    },
    {
      name: 'restingIcon',
      documentation: 'Image for grayed out double arrow when table header is not sorting',
      value: '/images/resting-arrow.svg'
    },
    {
      name: 'ascIcon',
      documentation: 'Image for table header ascending sorting arrow',
      value: '/images/up-arrow.svg'
    },
    {
      name: 'descIcon',
      documentation: 'Image for table header descending sorting arrow',
      value: '/images/down-arrow.svg'
    },
    {
      type: 'Boolean',
      name: 'showHeader',
      value: true,
      documentation: 'Set to false to not render the header.'
    },
    {
      class: 'Boolean',
      name: 'multiSelectEnabled',
      documentation: 'Set to true to support selecting multiple table rows.'
    },
    {
      class: 'Map',
      name: 'selectedObjects',
      documentation: `
        The objects selected by the user when multi-select support is enabled.
        It's a map where the key is the object id and the value is the object.
      `
    },
    {
      name: 'idsOfObjectsTheUserHasInteractedWith_',
      factory: function() {
        return {};
      }
    },
    {
      class: 'Int',
      name: 'tableWidth_',
      documentation: 'Width of the whole table. Used to get proper scrolling on narrow screens.',
      expression: function(props, colWidthUpdated, multiSelectEnabled, editColumnsEnabled) {
        var self = this;
        var base = 0;
        if ( this.multiSelectEnabled ) base += this.CHECKBOX_CONTAINER_WIDTH;
        if ( this.editColumnsEnabled ) base += this.EDIT_COLUMNS_BUTTON_CONTAINER_WIDTH;
        return this.columns_.reduce((acc, col) => {
          var width = this.selectedColumnsWidth[self.columnHandler.propertyNamesForColumnArray(col)];
          return acc + (width || this.columnHandler.returnPropertyForColumn(this.props, this.of, col, 'tableWidth') || this.MIN_COLUMN_WIDTH_FALLBACK);
        }, base) + 'px';
      }
    },
    {
      name: 'isColumnChanged',
      class: 'Boolean',
      value: false,
      documentation: 'If isColumnChanged is changed, columns_ will be updated'
    },
    {
      name: 'outputter',
      factory: function() {
        return this.TableColumnOutputter.create();
      }
    },
    {
      name: 'props',
      expression: function(of, columns_) {
        return this.returnPropertiesForColumns(this, columns_);
      }
    },
    {
      name: 'updateValues',
      class: 'Boolean',
      value: false,
      documentation: 'If updateValues is changed, rows are re-rendered'
    },
    'currentMemento_',
    {
      name: 'propertyNamesToQuery',
      expression: function(props) {
        return this.columnHandler.returnPropNamesToQuery(props);
      }
    },
    {
      class: 'Boolean',
      name: 'canObjBeBuildFromProjection',
      value: undefined,
      expression: function(props) {
        for ( var p of props ) {
          if ( ! p.property.projectionSafe && ! p.property.cls_.hasOwnProperty('tableCellFormatter') ) {
            return false;
          }
          if ( ! foam.lookup(p.property.cls_.id) ) {
            return false;
          }
        }
        return true;
      }
    },
    {
      name: 'nestedPropsAndIndexes',
      expression: function(propertyNamesToQuery) {
        return this.columnHandler.buildPropNameAndIndexArray(propertyNamesToQuery);
      }
    },
    {
      name: 'groupBy',
      description: 'Property that stores the current column that the table is being grouped by'
    },
    {
      class: 'Boolean',
      name: 'showPagination',
      value: true
    },
    'lastAppliedColumns_',
    'tableEl_',
    'scrollEl_',
    ['tableHeadHeight', 52]
  ],

  methods: [
    function sortBy(column) {
      var isNewOrderDesc = this.order === column;
      this.order = isNewOrderDesc ?
        this.DESC(column) :
        column;

      if ( ! this.memento || this.memento.head.length == 0 )
        return;

      var columns = this.memento.head.split(',');
      var mementoColumn = columns.find(c => this.returnMementoColumnNameDisregardSorting(c) === column.name)
      var orderChar = isNewOrderDesc ? this.DESCENDING_ORDER_CHAR : this.ASCENDING_ORDER_CHAR;
      if ( ! mementoColumn ) {
        columns.push(column.name + orderChar);
      } else {
        var index = columns.indexOf(mementoColumn);
        columns[index] = column.name + orderChar;
      }
      this.memento.head = columns.join(',');
    },
    function groupByCol(column) {
      this.groupBy = column;
    },

    function updateColumns() {
      // prevent redundant refreshes
      var columns = (this.selectedColumnNames || [])
        .map(c => foam.String.isInstance(c) ? c : c.name)
        .join(',');

      if ( columns === this.lastAppliedColumns_ ) return;
      this.lastAppliedColumns_ = columns;

      this.updateColumnStorage();

      this.isColumnChanged = ! this.isColumnChanged;
    },

    async function render() {
      var view = this;
      var nextViewMemento;
      const asyncRes = await this.filterUnpermitted(view.of.getAxiomsByClass(foam.lang.Property));
      this.allColumns = ! view.of ? [] : [].concat(
        asyncRes.map(a => a.name),
        view.of.getAxiomsByClass(foam.lang.Action)
        .map(a => a.name).filter( a => view.of.getAxiomByName('tableColumns') ? view.of.getAxiomByName('tableColumns').columns.includes(a) : false)
      );

      this.editColumnsEnabled$.sub(this.updateColumns_);
      this.selectedColumnNames$.sub(this.updateColumns_);
      this.isColumnChanged$.sub(this.updateColumns_);
      this.updateColumns_();
      if ( this.flowColumns$ ) {
        this.onDetach(this.flowColumns$.sub(this.applyFlowColumns));
        this.applyFlowColumns();
      }

      this.onDetach(this.colWidthUpdated$.sub(this.updateColumnStorage));
      if ( view.editColumnsEnabled )
        var editColumnView = foam.u2.view.EditColumnsView.create({data:view}, this);

      if ( this.filteredTableColumns$ ) {
        this.onDetach(this.filteredTableColumns$.follow(
          //to not export "custom" table columns
          this.columns_$.map((cols) => this.columnHandler.mapArrayColumnsToArrayOfColumnNames(this.filterColumnsThatAllColumnsDoesNotIncludeForArrayOfColumns(this, cols)))
        ));
      }
      this.start(this.Rows)
        .enableClass(this.myClass('full-height'), this.showPagination$)
        .start('', {}, this.tableEl_$).addClass(this.myClass('table-wrapper'))
        .start().
          addClass(this.myClass()).
          addClass(this.myClass(this.of.id.replace(/\./g, '-'))).
          start().
            addClass(this.myClass('thead')).
            style({ 'min-width': this.tableWidth_$ }).
            show(this.showHeader$).
            add(this.slot(function(columns_) {
              view.props = this.returnPropertiesForColumns(view, columns_);
              view.updateValues = ! view.updateValues;

              return this.E().
                addClass(view.myClass('tr')).

                // If multi-select is enabled, then we show a checkbox in the
                // header that allows you to select all or select none.
                callIf(view.multiSelectEnabled, function() {
                  var slot = view.SimpleSlot.create();
                  this.start().
                    addClass(view.myClass('th')).
                    tag(view.CheckBox, {}, slot).
                    style({ width: `${this.CHECKBOX_CONTAINER_WIDTH}px`, 'min-width': `${this.CHECKBOX_CONTAINER_WIDTH}px` }).
                    end();

                  // Set up a listener so we can update the existing CheckBox
                  // views when a user wants to select all or select none.
                  view.onDetach(slot.value.dot('data').sub(function(_, __, ___, newValueSlot) {
                    var checked = newValueSlot.get();

                    if ( checked ) {
                      var objs = {};
                      view.data.select(function(obj) {
                        objs[obj.id] = obj;
                      }).then(function() {
                        view.selectedObjects = objs;
                      });
                    } else {
                      view.selectedObjects = {};
                    }
                  }));
                }).

                // Render the table headers for the property columns.
                forEach(columns_, function([col, overrides]) {
                  this.tag(view.TableHeaderComponent, { data: view, col: col, overrides: overrides });
                }).

                // Render a th at the end for the column that contains the context
                // menu. If the column-editing feature is enabled, add that to the
                // th we create here.
                call(function() {
                  this.start().
                    addClass(view.myClass('th')).
                    style({
                      flex: `0 0 ${view.EDIT_COLUMNS_BUTTON_CONTAINER_WIDTH}px`,
                      'min-width': view.EDIT_COLUMNS_BUTTON_CONTAINER_WIDTH,
                      'text-align': 'unset!important;'
                    }).
                    callIf(view.editColumnsEnabled, function() {
                      this.addClass(view.myClass('th-editColumns'))
                      .on('click', function(e) {
                        editColumnView.parentId = this.id;
                        editColumnView.updatePosition(); // Update position on click
                        if ( ! editColumnView.selectColumnsExpanded )
                          editColumnView.selectColumnsExpanded = ! editColumnView.selectColumnsExpanded;
                      }).
                      tag(view.Image, { data: '/images/Icon_More_Resting.svg' }).
                      addClass(view.myClass('vertDots')).
                      addClass(view.myClass('noselect'))
                      ;
                    }).
                  end();
                });
              })).
          end().
          callIf(view.editColumnsEnabled, function() {this.add(editColumnView);})
          .start().addClass(view.myClass('tbody'))
            .tag(view.LazyScrollManager, {
                data$: view.data$,
                order$: view.order$,
                rowView: { class: 'foam.u2.table.UnstyledTableRow' },
                groupHeaderView: { class: 'foam.u2.table.UnstyledTableGroup' },
                rootElement: this.tableEl_,
                ctx: view,
                prepDAO: view.prepDAO,
                groupBy$: view.groupBy$,
                offsetTop: view.tableHeadHeight
            }, view.scrollEl_$)
          .end()
        .end().end()
        .add(this.slot(showPagination => {
          var buttonStyle = { label: '', buttonStyle: 'TERTIARY', size: 'SMALL' };
          return showPagination ?
          this.E().start(view.Cols).addClass(view.myClass('nav')).style({ 'justify-content': 'flex-end'}). // Have to do this here because Cols CSS is installed after nav. Investigate later
            startContext({ data: view.scrollEl_ }).
              start(view.Cols).
                style({ gap: '4px', 'box-sizing': 'border-box' }).
                start('').add(view.scrollEl_$.dot('topRow')).addClass(this.myClass('counters')).end().
                add('-').
                start('').add(view.scrollEl_$.dot('bottomRow')).addClass(this.myClass('counters')).end().
                start().addClass(view.myClass('separator')).translate(this.cls_.id + '.MESSAGE_OF', this.MESSAGE_OF).end().add(view.scrollEl_.daoCount$).
              end().
              start(view.scrollEl_.FIRST_PAGE, { ...buttonStyle, themeIcon: 'first' }).
              addClass(view.myClass('buttons')).end().
              start(view.scrollEl_.PREV_PAGE, { ...buttonStyle, themeIcon: 'back' }).
              addClass(view.myClass('buttons')).end().
              start(view.scrollEl_.NEXT_PAGE, { ...buttonStyle, themeIcon: 'next' }).
              addClass(view.myClass('buttons')).end().
              start(view.scrollEl_.LAST_PAGE, {  ...buttonStyle, themeIcon: 'last' }).
              addClass(view.myClass('buttons')).end().
            endContext().end() : this.E();
        }))
        .end().end();
        this.onDetach(this.updateValues$.sub(this.scrollEl_.refresh));
    },
    {
      name: 'prepDAO',
      code: function(dao, ctx) {
        return ctx.returnRecords(ctx.of, dao, ctx.propertyNamesToQuery, ctx.canObjBeBuildFromProjection);
      }
    },
    {
      name: 'getActionsForRow',
      code: function(obj) {
        var actions = {};
        var actionsMerger = action => { actions[action.name] = action; };
        if ( obj?.cls_ ) {
          // Model actions
          obj.cls_.getAxiomsByClass(foam.lang.Action).forEach(actionsMerger);
        } else {
          console.error('FObject is missing cls_', obj);
        }

        // Context menu actions
        this.contextMenuActions.forEach(actionsMerger);

        return actions;
      }
    }
  ],

  listeners: [
    function resetColWidths() {
      this.selectedColumnsWidth = {};
      for ( var s of this.selectedColumnNames ) {
        this.selectedColumnsWidth[s] = this.columnHandler.returnPropertyForColumn(this.props, this.of, s, 'tableWidth') || null;
      }
    },
    {
      name: 'updateColumnStorage',
      isMerged: true,
      mergeDelay: 500,
      code: function() {
        var key = this.of.id;
        var val = JSON.stringify(this.selectedColumnNames.map(c => {
          var name = foam.String.isInstance(c) ? c : c.name;
          var size = this.selectedColumnsWidth[name] == undefined ? undefined : this.selectedColumnsWidth[name];
          return [name, size];
        }));
        // stop redundant rewrite
        var curr = this.columnStorage.getItem(key);
        if ( curr === val ) return;
        this.columnStorage.setItem(key, val);
      }
    },
    {
      name: 'updateColumns_',
      isFramed: true,
      code: function() {
        if ( ! this.of ) return [];
        var cols = this.editColumnsEnabled ? this.selectedColumnNames : this.columns;
        // Filter out any columns not preset in allColumns since that performs the permission checks before being populated
        Promise.all(this.filterColumnsThatAllColumnsDoesNotIncludeForArrayOfColumns(this, cols).map(
          c => foam.Array.isInstance(c) ?
            c :
            [c, null]
        ))
        .then(columns => {
          if ( foam.util.equals(this.columns_, columns) ) return;
          this.columns_ = columns;
        });
      }
    },
    {
      name: 'applyFlowColumns',
      code: function() {
        if ( ! this.flowColumns ) return;
        var cols = this.flowColumns.split(',').map(s => s.trim()).filter(s => s.length > 0);
        if ( foam.util.equals(cols, this.selectedColumnNames) ) return;
        this.selectedColumnNames = cols;
        this.updateColumns();
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.u2.table',
  name: 'TableViewPropertyRefinement',
  refines: 'foam.lang.Property',
  properties: [
    {
      class: 'Boolean',
      name: 'columnHidden'
    },
    {
      class: 'Boolean',
      documentation: `
        When set to true, the '<model>.column.<property>' permission is required for a
        user to be able to read this property. If false, any user can see the
        value of this property in a table column.
      `,
      name: 'columnPermissionRequired'
    }
  ]
});


foam.CLASS({
  package: 'foam.u2.table',
  name: 'PropertyColumnMapping',
  properties: [
    {
      name: 'fullPropertyName',
      class: 'String'
    },
    {
      name: 'property',
      class: 'FObjectProperty',
      of: 'Property'
    }
  ]
});
