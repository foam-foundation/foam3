/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.table',
  name: 'TableComponentView',
  extends: 'foam.u2.View',

  requires: [
    'foam.core.column.ColumnConfigToPropertyConverter',
    'foam.core.column.CommonColumnHandler',
    'foam.core.column.ExpressionForArrayOfNestedPropertiesBuilder'
  ],

  imports: ['columnConfigToPropertyConverter? as importedColumnConfigConverter'],

  properties: [
    {
      name: 'columnHandler',
      class: 'FObjectProperty',
      of: 'foam.core.column.CommonColumnHandler',
      factory: function() {
        return foam.core.column.CommonColumnHandler.create({}, this);
      }
    },
    {
      name: 'columnConfigToPropertyConverter',
      factory: function() {
        if ( ! this.importedColumnConfigConverter )
          return foam.core.column.ColumnConfigToPropertyConverter.create();
        return this.importedColumnConfigConverter;
      }
    }
  ],

  methods: [
    function returnRecords(of, dao, propertyNamesToQuery, useProjection) {
      var expr = this.ExpressionForArrayOfNestedPropertiesBuilder.create().buildProjectionForPropertyNamesArray(of, propertyNamesToQuery, useProjection);
      return dao.select(expr);
    },

    function doesAllColumnsContainsColumnName(obj, col) {
      return obj.allColumns.contains(obj.columnHandler.checkIfArrayAndReturnFirstLevelColumnName(col));
    },

    function filterColumnsThatAllColumnsDoesNotIncludeForArrayOfColumns(obj, columns) {
      return columns.filter( c => obj.allColumns.includes( obj.columnHandler.checkIfArrayAndReturnFirstLevelColumnName(c) ));
    },

    function returnPropertiesForColumns(obj, columns_) {
      var propertyNamesToQuery = columns_.length === 0 ? columns_ : [ 'id' ].concat(obj.filterColumnsThatAllColumnsDoesNotIncludeForArrayOfColumns(obj, columns_).filter(c => ! foam.lang.Action.isInstance(obj.of.getAxiomByName(obj.columnHandler.propertyNamesForColumnArray(c)))).map(c => obj.columnHandler.propertyNamesForColumnArray(c)));
      return obj.columnConfigToPropertyConverter.returnPropertyColumnMappings(obj.of, propertyNamesToQuery);
    },

    function shouldColumnBeSorted(c) {
      return c[c.length - 1] === this.DESCENDING_ORDER_CHAR || c[c.length - 1] === this.ASCENDING_ORDER_CHAR;
    },

    function returnMementoColumnNameDisregardSorting(c) {
      return c && this.shouldColumnBeSorted(c) ? c.substr(0, c.length - 1) : c;
    },

    async function filterUnpermitted(arr) {
      // A user who may not read a property sees it blank in every row, and
      // sorting by it is rejected by PermissionedPropertyDAO, which leaves the
      // table empty. Rule.daoKey is one such column, so it is dropped here
      // the same way FilterView drops it from the filters.
      var model = this.of.name.toLowerCase();
      const results = await Promise.all(arr.map( async p =>
        p.hidden ? false :
        (! this.auth) ? true :
        ( ! p.columnPermissionRequired ||
          await this.auth.check(ctrl.__subContext__, `${model}.column.${p.name.toLowerCase()}`) ) &&
        ( ! p.readPermissionRequired ||
          await this.auth.check(ctrl.__subContext__, `${model}.rw.${p.name.toLowerCase()}`) ||
          await this.auth.check(ctrl.__subContext__, `${model}.ro.${p.name.toLowerCase()}`) )));
      return arr.filter((_v, index) => results[index]);
    },

    function getCellData(obj, prop, nestedPropertiesObjsMap) {
      var objForCurrentProperty = obj;
      var propName = this.columnHandler.propertyNamesForColumnArray(prop);
      var prop = this.props.find(p => p.fullPropertyName === propName);
      //check if current column is a nested property
      //if so get object for it
      if ( prop && prop.fullPropertyName.includes('.') ) {
        objForCurrentProperty = nestedPropertiesObjsMap[this.columnHandler.getNestedPropertyNameExcludingLastProperty(prop.fullPropertyName)];
      }
      return [
        (objForCurrentProperty ?
        objForCurrentProperty.cls_.getAxiomByName(this.columnHandler.getNameOfLastPropertyForNestedProperty(propName)) :
        prop && prop.property ? prop.property : this.data.of.getAxiomByName(propName)),
        objForCurrentProperty
      ];
    }
  ]
});
