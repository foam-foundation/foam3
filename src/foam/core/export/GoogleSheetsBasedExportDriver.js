/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.export',
  name: 'GoogleSheetsBasedExportDriver',
  implements: [
    'foam.core.export.ExportDriver',
    'foam.core.export.GoogleSheetsServiceConfig'
  ],

  messages: [
    { name: 'PLEASE_SELECT_TEMPLATE', message: 'Please select template...' }
  ],

  properties: [
    {
      name: 'dateFormat',
      hidden: true,
      factory: function() {
        return [
          d => d ? d.toLocaleDateString('en-us') : '',
          d => d ? d.toLocaleTimeString('en-us') : ''
        ];
      }
    },
    {
      name: 'outputter',
      expression: function(dateFormat) {
        return foam.core.export.GoogleSheetsOutputter.create({ dateFormat: dateFormat });
      },
      hidden: true,
      flags: ['js']
    },
    {
      class: 'String',
      name: 'title'
    },
    {
      class: 'Reference',
      of: 'foam.core.export.report.Template',
      name: 'template',
      targetDAOKey: 'reportTemplateDAO',
      view: function(args, X) {
        var expr = foam.mlang.Expressions.create();
        if ( ! X.serviceName ) return {};

        return foam.u2.view.ChoiceView.create({
            placeholder: X.data.PLEASE_SELECT_TEMPLATE,
            dao: X.reportTemplateDAO.where(expr.EQ(foam.core.export.report.Template.DAO_KEY, X.serviceName.includes('/') ? X.serviceName.split('/')[1] : X.serviceName )),
            objToChoice: function(a) {
              return [a.id, a.name];
          }
        }, X);
      }
    },
    {
      name: 'serviceName',
      class: 'String',
      hidden: true
    },
    {
      name: 'exportClsInfo',
      class: 'Class',
      javaType: 'foam.lang.ClassInfo',
      hidden: true
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
  ],

  methods: [
    async function exportFObjectAndReturnSheetId(X, obj) {
      var self = this;

      var sheetId  = '';
      var columnConfig = X.columnConfigToPropertyConverter;

      var propNames;

      if ( ! this.template )
        propNames =  X.filteredTableColumns ? X.filteredTableColumns : this.outputter.getAllPropertyNames(dao.of);
      else {
        var expr1 = foam.mlang.Expressions.create();
        var template = await X.reportTemplateDAO.find(expr1.EQ(foam.core.export.report.Template.ID, this.template));
        propNames = template && template.columnNames && template.columnNames.length > 0 ? template.columnNames : X.filteredTableColumns ? X.filteredTableColumns : this.outputter.getAllPropertyNames(dao.of);
      }

      propNames = columnConfig.filterExportedProps(X, obj.cls_, propNames);

      var metadata = await self.outputter.getColumnMethadata(X, obj.cls_, propNames);

      self.outputter.setUnitValueMetadataForObj(metadata, obj);

      var stringArray = [ await this.outputter.objectToTable(X, obj.cls_, obj, propNames) ];

      sheetId = await X.googleSheetsDataExport.createSheetAndPopulateWithData(X, metadata, this);
      if ( this.template )
        sheetId = await X.googleSheetsDataExport.createSheetByCopyingTemplateAndFronEndData(X, stringArray, metadata, this);
      else
        sheetId = await X.googleSheetsDataExport.createSheetAndPopulateWithFrontEndData(X, stringArray, metadata, this);
      if ( ! sheetId || sheetId.length == 0)
        return '';
      return sheetId;
    },
    async function exportDAOAndReturnSheetId(X, dao) {
      this.serviceName = X.serviceName.includes('/') ? X.serviceName.split('/')[1] : X.serviceName;
      var self = this;
      this.exportClsInfo = dao.of;

      var columnConfig = X.columnConfigToPropertyConverter;

      var propNames;
      if ( ! this.template )
        propNames =  X.filteredTableColumns ? X.filteredTableColumns : this.outputter.getAllPropertyNames(dao.of);
      else {
        var expr1 = foam.mlang.Expressions.create();
        var template = await X.reportTemplateDAO.find(expr1.EQ(foam.core.export.report.Template.ID, this.template));
        propNames = template && template.columnNames && template.columnNames.length > 0 ? template.columnNames : X.filteredTableColumns ? X.filteredTableColumns : this.outputter.getAllPropertyNames(dao.of);
      }

      propNames = columnConfig.filterExportedProps(dao.of, propNames);
      var lengthOfInitialyPropsRequested = propNames.length;

      var metadata = await self.outputter.getColumnMetadata(X, dao.of, propNames);

      var propToColumnMapping = X.columnConfigToPropertyConverter.returnPropertyColumnMappings(dao.of, propNames);
      propNames = this.columnHandler.returnPropNamesToQuery(propToColumnMapping);
      var expr = ( foam.core.column.ExpressionForArrayOfNestedPropertiesBuilder.create() ).buildProjectionForPropertyNamesArray(dao.of, propNames);
      var sink = await dao.select(expr);

      var stringArray = await self.outputter.returnTable(X, dao.of, propNames, sink.projection, propNames.length);

      self.outputter.setUnitValueMetadata(metadata, propNames, stringArray);
      stringArray = stringArray.map(a => a.slice(0, lengthOfInitialyPropsRequested));

      var sheetId  = '';

      if ( this.template )
        sheetId = await X.googleSheetsDataExport.createSheetByCopyingTemplateAndFronEndData(X, stringArray, metadata, this);
      else
        sheetId = await X.googleSheetsDataExport.createSheetAndPopulateWithFrontEndData(X, stringArray, metadata, this);
      if ( ! sheetId || sheetId.length == 0)
        return '';
      return sheetId;
    }
  ]
});
