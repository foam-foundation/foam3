/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.export',
  name: 'XMLTableExportDriver',
  extends: 'foam.core.export.TableExportDriver',

  requires: [
    'foam.core.column.XMLTableOutputter'
  ],

  documentation: `The driver to export data retrieved with projection to XML.
    Exports the columns the table shows, like the CSV driver, and honours the
    'Include all columns in export' option.`,

  properties: [
    {
      name: 'outputter',
      hidden: true,
      factory: function() {
        var pad = n => ('0' + n).slice(-2);
        return this.XMLTableOutputter.create({
          // ISO 8601 date, 24h time: a consumer parses the value without
          // knowing the exporting browser's locale.
          dateFormat: [
            d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()),
            d => pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds())
          ]
        });
      }
    }
  ],

  methods: [
    async function exportFObject(X, obj) {
      var propNames  = this.getPropName(X, obj.cls_);
      var objToTable = await this.exportFObjectAndReturnTable(X, obj, propNames);
      return this.outputter.arrayToXML(objToTable);
    },

    async function exportDAO(X, dao) {
      var propNames  = this.getPropName(X, dao.of);
      var daoToTable = await this.exportDAOAndReturnTable(X, dao, propNames);
      return this.outputter.arrayToXML(daoToTable);
    }
  ]
});
