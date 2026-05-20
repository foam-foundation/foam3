/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.export',
  name: 'TableExportDriver',
  implements: [ 'foam.core.export.ExportDriver' ],

  requires: [
    'foam.core.column.TableColumnOutputter'
  ],

  properties: [
    {
      name: 'outputter',
      hidden: true,
      factory: function() {
        return this.TableColumnOutputter.create();
      },
      flags: ['js']
    },
    {
      name: 'columnHandler',
      class: 'FObjectProperty',
      of: 'foam.core.column.CommonColumnHandler',
      factory: function() {
        return foam.core.column.CommonColumnHandler.create();
      },
      hidden: true,
      flags: ['js']
    },
    {
      name: 'columnConfigToPropertyConverter',
      factory: function() {
        if ( ! this.__context__.columnConfigToPropertyConverter )
          return foam.core.column.ColumnConfigToPropertyConverter.create();
        return this.__context__.columnConfigToPropertyConverter;
      },
      hidden: true,
      flags: ['js']
    },
    {
      class: 'Boolean',
      name: 'addUnits',
      documentation: 'Include unit in UnitValues (mostly currencies) or not',
      value: true
    }
  ],

  methods: [
    async function exportFObjectAndReturnTable(X, obj, propNames) {
      var propToColumnMapping  = this.columnConfigToPropertyConverter.returnPropertyColumnMappings(obj.cls_, propNames);
      var propertyNamesToQuery = this.columnHandler.returnPropNamesToQuery(propToColumnMapping);

      return await this.outputter.objectToTable(X, obj.cls_, propertyNamesToQuery, obj, propNames.length);
    },

    async function exportDAOAndReturnTable(X, dao, propNames) {
      let propToColumnMapping  = this.columnConfigToPropertyConverter.returnPropertyColumnMappings(dao.of, propNames);
      let propertyNamesToQuery = this.columnHandler.returnPropNamesToQuery(propToColumnMapping);
      let projectionSafe       = ! propToColumnMapping.some(p => ! p.property.projectionSafe );
      var expr                 = ( foam.core.column.ExpressionForArrayOfNestedPropertiesBuilder.create() ).buildProjectionForPropertyNamesArray(dao.of, propertyNamesToQuery, projectionSafe);
      var sink                 = await dao.limit(this.LIMIT).select(expr);

      if (sink.exprs.length !== propertyNamesToQuery.length) {
        // re-populate propNamesToQuery to match result in sink (e.g., remove property names in many-to-one relationships)
        propNames = sink.exprs.map(e => e.name);
        propToColumnMapping  = this.columnConfigToPropertyConverter.returnPropertyColumnMappings(dao.of, propNames);
        propertyNamesToQuery = this.columnHandler.returnPropNamesToQuery(propToColumnMapping);
      }

      return await this.outputter.returnTable(X, dao.of, propertyNamesToQuery, sink.projection, propNames.length, this.addUnits);
    },

    function getPropName(X, of) {
      var propNames = X.filteredTableColumns ? X.filteredTableColumns : this.outputter.getAllPropertyNames(of);
      return this.columnConfigToPropertyConverter.filterExportedProps(of, propNames);
    }
  ]
});
