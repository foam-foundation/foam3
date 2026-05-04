/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.export',
  name: 'CSVTableExportDriver',
  extends: 'foam.core.export.TableExportDriver',

  implements: [ 'foam.core.export.ExportDriver' ],

  documentation: 'The driver to export data retrieved with projection to CSV',

  requires: [
    'foam.core.column.CSVTableOutputter',
    'foam.core.column.TableColumnOutputter'
  ],

  messages: [
    { name: 'SPREADSHEET', message: 'Spreadsheet Compatible' },
    { name: 'LOCALE',      message: 'Current Locale' },
    { name: 'LONG',        message: 'Long' },
    { name: 'DDMMYYYY',    message: 'DDMMYYYY' }
  ],

  properties: [
    {
      name: 'choices',
      hidden: true,
      factory: function() {
        return [
          [ [
              d => d.toLocaleDateString('en-us'),
              d => d.toLocaleTimeString('en-us')
            ],
            this.SPREADSHEET
          ],
          [
            [
              d => ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear(),
              d => ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ':' + ('0' + d.getSeconds()).slice(-2)
            ],
            this.DDMMYYYY
          ],
          [ [
              d => d.getTime(),
              d => d.getTime()
            ],
            this.LONG
          ],
          [ [
              d => d.toLocaleDateString(foam.locale),
              d => d.toLocaleTimeString(foam.locale)
            ],
            this.LOCALE + ' (' + foam.locale + ')'
          ],
        ].map(c => [ c[0], c[1] + ': ' + c[0][0](new Date()) ]);
      }
    },
    {
      name: 'dateFormat',
      view: function(_, X) {
        return {
          class: 'foam.u2.view.RadioView',
          choices: X.data.choices
        };
      },
      factory: function(_, X) { return this.choices[0][0]; },
      help: 'Select the format dates will appear in the output.'
    },
    {
      class: 'Boolean',
      name: 'addUnits',
      label: '',
      view: { class: 'foam.u2.CheckBox',  label: 'Add Units'},
      value: true
    },
    {
      name: 'outputter',
      hidden: true,
      expression: function(dateFormat, addUnits) {
        return this.CSVTableOutputter.create({
          dateFormat: dateFormat,
          addUnits:   addUnits
        });
      }
    },
    {
      name: 'columnHandler',
      hidden: true,
      class: 'FObjectProperty',
      of: 'foam.core.column.CommonColumnHandler',
      factory: function() {
        return foam.core.column.CommonColumnHandler.create();
      }
    },
    {
      name: 'columnConfigToPropertyConverter',
      hidden: true,
      factory: function() {
        if ( ! this.__context__.columnConfigToPropertyConverter )
          return foam.core.column.ColumnConfigToPropertyConverter.create();
        return this.__context__.columnConfigToPropertyConverter;
      }
    }
  ],

  methods: [
    async function exportFObject(X, obj) {
      var propNames  = this.getPropName(X, obj.cls_);
      var objToTable = await this.exportFObjectAndReturnTable(X, obj, propNames);
      return this.outputter.arrayToCSV(objToTable);
    },

    async function exportDAO(X, dao) {
      var propName   = this.getPropName(X, dao.of);
      var daoToTable = await this.exportDAOAndReturnTable(X, dao, propName);
      return this.outputter.arrayToCSV(daoToTable);
    }
  ]
});
