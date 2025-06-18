/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.table',
  name: 'UnstyledTableGroup',
  extends: 'foam.u2.table.TableComponentView',

  requires: [
    'foam.lang.SimpleSlot',
    'foam.u2.CheckBox',
    'foam.u2.view.OverlayActionListView'
  ],

  imports: [
    'nestedPropsAndIndexes',
    'propertyNamesToQuery',
    'props',
    'table'
  ],

  messages: [
    { name: 'EMPTY_MSG',  message: 'empty' }
  ],

  properties: [
    'projection',
  ],

  methods: [
    function render() {
      var self = this;
      var objForCurrentProperty = this.data;
      var expr = foam.mlang.Expressions.create();
      var nestedPropertyValues = this.columnHandler.filterNestedPropertyValues(this.projection, this.nestedPropsAndIndexes[1]);
      var nestedPropertiesObjsMap = this.columnHandler.groupRelatedObjects(this.table.of, this.nestedPropsAndIndexes[0], nestedPropertyValues);
      this.addClass(this.table.myClass('tr')).
      addClass(this.table.myClass('row-group'), this.table.myClass('row')).
      // If multi-select is enabled, then we show a checkbox in the
      // header that allows you to select all or select none.
      callIf(this.table.multiSelectEnabled, function() {
        var slot = self.SimpleSlot.create();
        this.start().
          addClass(self.table.myClass('th')).
          tag(self.CheckBox, {}, slot).
          style({ width: '42px' }).
        end();

        // Set up a listener so we can update the existing CheckBox
        // views when a user wants to select all or select none.
        self.onDetach(slot.value.dot('data').sub(function(_, __, ___, newValueSlot) {
          var checked = newValueSlot.get();

          if ( checked ) {
            self.table.selectedObjects = {};
            self.table.data.where(expr.EQ(self.table.groupBy, self.table.groupBy.f(objForCurrentProperty))).select(function(obj) {
              self.table.selectedObjects[obj.id] = obj;
              self.table.idsOfObjectsTheUserHasInteractedWith_[obj.id] = true;
              if ( self.table.checkboxes_[obj.id] )
                self.table.checkboxes_[obj.id].data = checked;
            });
          } else {
            Object.keys(self.table.checkboxes_).forEach(function(key) {
              if ( self.table.selectedObjects[key] && self.table.groupBy.f(self.table.selectedObjects[key]) == self.table.groupBy.f(objForCurrentProperty) )
                self.table.checkboxes_[key].data = checked;
            });
            self.table.selectedObjects = {};
          }
        }));
      }).

      style({ 'min-width': this.table.tableWidth_$ });
      [prop, objReturned] = this.getCellData(objForCurrentProperty, this.table.groupBy, nestedPropertiesObjsMap);
      this.start().addClass(self.table.myClass('group-content'),'h500')
        .start('span')
          .style({ flex: '3 0 0' })
          .add(prop.columnLabel + ': ')
          .call(function() {
            if ( ! prop.f(objReturned) && prop.f(objReturned) !== 0) {
              this.start('i').add(self.EMPTY_MSG).end()
            } else {
              prop.tableCellFormatter.format(
                this,
                prop.f ? prop.f(objReturned) : null,
                objReturned,
                prop
              );
            }
          })
        .end()
      .end();
    }
  ],

});
