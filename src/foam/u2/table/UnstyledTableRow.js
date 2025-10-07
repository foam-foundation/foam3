/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.table',
  name: 'UnstyledTableRow',
  extends: 'foam.u2.table.TableComponentView',

  mixins: ['foam.comics.v2.Clickable'],

  requires: [
    'foam.lang.SimpleSlot',
    'foam.u2.CheckBox',
    'foam.u2.tag.Image',
    'foam.u2.view.OverlayActionListView',
    'foam.u2.table.UnstyledTableRowComponent'
  ],

  imports: [
    'click?',
    'config?',
    'dblclick?',
    'nestedPropsAndIndexes',
    'propertyNamesToQuery',
    'props',
    'stack?',
    'table'
  ],

  properties: [
    'projection',
    // Added for scrollTableView support
    {
      name: 'actionDAO',
      factory: function() { return this.table.data; }
    },
    'hoverSelection'
  ],

  methods: [
    function render() {
      this.SUPER();
      const obj = this.data;
      var self = this;
      var nestedPropertyValues    = this.columnHandler.filterNestedPropertyValues(this.projection, this.nestedPropsAndIndexes[1]);
      var nestedPropertiesObjsMap = this.columnHandler.groupRelatedObjects(this.table.of, this.nestedPropsAndIndexes[0], nestedPropertyValues);
      this.addClass(this.table.myClass('tr')).
        on('mouseover', () => self.hoverSelection = obj).
      call(this.insertClick, [obj]). // TODO: why the bind(), call should apply to this anyway?
      enableClass(this.table.myClass('clickable'), ! this.config?.disableSelection).
      addClass(this.table.myClass('row')).
      style({ 'min-width': this.table.tableWidth_$ }).

      // If the multi-select feature is enabled, then we render a
      // Checkbox in the first cell of each row.
      callIf(this.table.multiSelectEnabled, function() {
        var slot = self.SimpleSlot.create();
        self
          .start('')
            .addClass(self.table.myClass('td'))
            .tag(self.CheckBox, { }, slot)
          .end()
          .enableClass(self.table.myClass('selected'), slot.value$.dot('data'));

        slot.get().data$.relateFrom(self.table.selectedObjects$, function(checked) {
          var result = {...self.table.selectedObjects}
          if ( checked ) {
            result[obj.id] = obj;
          } else {
            delete result[obj.id];
          }
          return result;
        }, function(selected) {
          return !! selected[obj.id]
        });
      });

      for ( var j = 0 ; j < this.table.columns_.length ; j++ ) {
        self.tag(self.UnstyledTableRowComponent, { table: self.table, col: this.table.columns_[j], nestedPropertiesObjsMap: nestedPropertiesObjsMap, data: obj });
      }

      // Object actions
      var actions = this.table.getActionsForRow(obj);
      // When an action is taken, update the table
      obj?.sub('action', function() {
        if ( ! self.table ) return;
        self.table.updateValues = ! self.table.updateValues;
      });
      if ( Object.keys(actions).length ) self
        .start('')
          .addClass(this.table.myClass('td'))
          .on('dblClick', e => {
            e.preventDefault();
            e.stopPropogation();
          })
          .attrs({ name: 'contextMenuCell' })
          .style({ flex: `0 0 ${this.table.EDIT_COLUMNS_BUTTON_CONTAINER_WIDTH}px` })
          .startContext({ stack: this.subStack })
          .tag(this.OverlayActionListView, {
            data: Object.values(actions),
            lazy: true,
            obj: obj,
            dao: self.actionDAO,
            showDropdownIcon: false,
            buttonStyle: 'TERTIARY',
            icon: 'images/Icon_More_Resting.svg'
          })
          .endContext()
        .end();
    }
  ]
});


foam.CLASS({
  package: 'foam.u2.table',
  name: 'UnstyledTableRowComponent',
  extends: 'foam.u2.table.TableComponentView',

  imports: [
    'colWidthUpdated',
    'props',
    'selectedColumnsWidth?'
  ],

  properties: [
    {
      name: 'colWidth',
      factory: function() {
        return this.selectedColumnsWidth && this.selectedColumnsWidth[this.propName] ?
        this.selectedColumnsWidth[this.propName] :
        this.columnHandler.returnPropertyForColumn(this.props, this.table.of, this.col, 'tableWidth');
      }
    },
    'col',
    'propName',
    'nestedPropertiesObjsMap',
    'table'
  ],

  methods: [
    function render() {
      var self = this;
      this.propName = this.columnHandler.propertyNamesForColumnArray(this.col);
      [prop, objReturned] = this.getCellData(this.data, this.col, this.nestedPropertiesObjsMap);

      // Added to maintain support for ScrollTableView that does not support resizable columns
      if ( this.colWidthUpdated$ && this.selectedColumnsWidth$ ) {
        this.onDetach(this.colWidthUpdated$.sub(function() {
          if ( self.selectedColumnsWidth[self.propName] )
            self.colWidth = self.selectedColumnsWidth[self.propName];
        }));
      }

      this
        .startContext({ controllerMode: 'VIEW' })
        .addClass(this.table.myClass('td'))
        .style({ flex: this.slot(function(colWidth) {
            return colWidth ? `1 0 ${colWidth}px` : `1 0 ${this.table.MIN_COLUMN_WIDTH_FALLBACK}px`;
          })
        })
        .call(function() {
          prop.tableCellFormatter.format(
            this,
            prop.f ? prop.f(objReturned) : null,
            objReturned,
            prop
          );
        })
        .endContext();
    }
  ]
});
