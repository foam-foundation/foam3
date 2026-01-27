/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2',
  name: 'ExportModal',
  extends: 'foam.u2.View',

  documentation: 'Export Modal',

  imports: [
    'exportDriverRegistryDAO',
    'filteredTableColumns',
    'serviceName'
  ],

  requires: [
    'foam.u2.LoadingSpinner',
    'foam.u2.layout.Cols',
    'foam.u2.layout.Rows'
  ],

  css: `
    ^{
      width: 448px;
      margin: auto;
    }
    ^ > *, ^ .foam-u2-layout-Grid {
      gap: 12px;
    }
    ^ .foam-u2-TextInputCSS {
      border: 1px solid $borderLight;

    }
    ^ .foam-u2-TextInputCSS option {
      padding: 10px;
    }
    ^datatype-group {
      display: flex;
      align-items: center;
      gap: 5px;
    }
    ^dimmed-text {
      color: $textSecondary;
    }
    ^datatype-text {
      font-weight: bold;
      color: $textSecondary;
    }
    ^divided-sec {
      border-top: 1px solid $borderDefault;
      padding-top: 10px;
    }
    ^ .foam-u2-borders-ExpandableBorder-container {
      padding: 10px;
    }

  `,

  properties: [
    {
      class: 'String',
      name: 'dataType',
      label: '',
      view: function(_, X) {
        return foam.u2.view.RichChoiceView.create({
          search: false,
          allowClearingSelection: false,
          dao: X.exportDriverRegistryDAO.where(X.data.predicate),
          choosePlaceholder: 'Select Type',
          sections: [
            {
              heading: '',
              dao: X.exportDriverRegistryDAO.where(X.data.predicate)
            }
          ]
        }, X);
      }
    },
    {
      name: 'isDataTypeSelected',
      expression: function(dataType) {
        return dataType != '';
      }
    },
    {
      name: 'note',
      label: 'Response',
      view: 'foam.u2.tag.TextArea',
      visibility: function(note) { return note ? foam.u2.DisplayMode.RO : foam.u2.DisplayMode.HIDDEN; },
      value: ''
    },
    {
      class: 'FObjectProperty',
      of: 'foam.mlang.predicate.Predicate',
      name: 'predicate',
      factory: function() { return foam.mlang.predicate.True.create(); }
    },
    {
      name: 'unknownExportDriverRegistry',
      factory: function() { return foam.core.export.ExportDriverRegistry.create(); }
    },
    'exportData',
    'exportObj',
    {
      name: 'exportAllColumns',
      label: '',
      view: { class: 'foam.u2.CheckBox',  label: 'Include all columns in export'},
      class: 'Boolean',
      help: 'Exports all columns, even those hidden by filters or view settings.'
    },
    'exportDriverReg',
    {
      class: 'Boolean',
      name: 'isConvertAvailable'
    },
    {
      class: 'Boolean',
      name: 'isDownloadAvailable'
    },
    {
      class: 'Boolean',
      name: 'isOpenAvailable'
    },
    'exportDriver',
    {
      class: 'Boolean',
      name: 'loading'
    }
  ],

  methods: [
    function render() {
      var self = this;
      this.SUPER();

      this.exportDriverReg = this.unknownExportDriverRegistry;
      this.exportDriver = undefined;

      self.dataType$.sub(function() {
        self.exportDriverRegistryDAO.find(self.dataType).then(function(val) {
          if ( ! val ) {
            self.exportDriverReg = self.unknownExportDriverRegistry;
            self.exportDriver    = undefined;
          } else {
            self.exportDriverReg = val;
            self.exportDriver    = foam.lookup(self.exportDriverReg.driverName).create({}, self);
          }
        });
      });


      self.exportDriverReg$.sub(function() {
        self.isConvertAvailable  =  self.exportDriverReg.isConvertible;
        self.isDownloadAvailable = self.exportDriverReg.isDownloadable;
        self.isOpenAvailable     = self.exportDriverReg.isOpenable;
      });

      this
      .addClass(this.myClass())
      .startContext({ data: this })
        .start(this.Rows)
          .tag(this.DATA_TYPE.__)
          .start().show(this.isDataTypeSelected$)
            .add(function(dataType) {
              this.start().addClass(self.myClass('datatype-group'))
                .start()
                  .addClass(self.myClass('dimmed-text'))
                  .add('Data will be exported as')
                .end()
                .start().addClass(self.myClass('datatype-text')).add(`${dataType}.`).end()
              .end()
            })
          .end()

          .start().show(this.isDataTypeSelected$).addClass(this.myClass('divided-sec'))
            .add(this.slot(function (exportDriver) {
              return this.E()
              .show(exportDriver && exportDriver.cls_.getAxiomsByClass(foam.lang.Property).some(p => ! p.hidden))
              .start({class: 'foam.u2.detail.VerticalDetailView', data: exportDriver}).end();
           }))
          .end()
          .start()
            .style({ display: 'contents' })
            .show(this.isDataTypeSelected$)
            .start(this.NOTE.__).end()
            .start().addClass(this.myClass('divided-sec'))
              .add(
                self.slot(function(exportDriverReg$exportAllColumns) {
                  if ( exportDriverReg$exportAllColumns ) {
                    return self.E().start().startContext({ data: self }).tag(self.EXPORT_ALL_COLUMNS.__).endContext().end();
                  }
                })
              )
            .end()
            .start().show(this.loading$).tag(this.LoadingSpinner, {size: '32px'} ).end()
            .start(this.Cols).hide(this.loading$).style({ 'justify-content': 'flex-end', 'gap': '10px' })
              .start(this.DOWNLOAD).end()
              .start(this.CONVERT).end()
              .start(this.OPEN).end()
            .end()
          .end()
        .end()
        .endContext()
        .br()
        .start('i').add(`Downloads limited to ${foam.core.export.ExportDriver.LIMIT.toLocaleString()} rows.`).end();
    }
  ],

  actions: [
    {
      name: 'convert',
      label: 'Preview',
      isAvailable: function(isConvertAvailable) {
        return isConvertAvailable;
      },
      code: async function() {
        this.loading = true;
        this.note = '';
        if ( ! this.exportData && ! this.exportObj ) {
          this.note = 'Error: No data available for export';
          this.loading = false;
          return;
        }

        var filteredColumnsCopy = this.filteredTableColumns;
        if ( this.exportAllColumns )
          this.filteredTableColumns = null;

        try {
          this.note = this.exportData ?
            await this.exportDriver.exportDAO(this.__context__, this.exportData) :
            await this.exportDriver.exportFObject(this.__context__, this.exportObj);
        } catch (e) {
          console.error('Export failed:', e);
          this.note = 'Error: ' + (e.data?.message || e.message || 'Export failed');
        } finally {
          if ( this.exportAllColumns )
            this.filteredTableColumns = filteredColumnsCopy;
          this.loading = false;
        }
      }
    },
    {
      name: 'download',
      label: 'Export',
      buttonStyle: 'PRIMARY',
      isAvailable: function(isDownloadAvailable) {
        return isDownloadAvailable;
      },
      code: async function download() {
        this.loading = true;
        this.note = '';
        if ( ! this.exportData && ! this.exportObj ) {
          this.note = 'Error: No data available for export';
          this.loading = false;
          return;
        }

        var filteredColumnsCopy = this.filteredTableColumns;
        if ( this.exportAllColumns )
          this.filteredTableColumns = null;

        try {
          var result;
          if ( this.exportData ) {
            result = await this.exportDriver.exportDAO(this.__context__, this.exportData);
          } else {
            result = await this.exportDriver.exportFObject(this.__context__, this.exportObj);
          }
          if ( result ) {
            var link = document.createElement('a');
            var href = '';
            if ( this.exportDriverReg.mimeType && this.exportDriverReg.mimeType.length != 0 ) {
              var blob = new Blob([result], { type: this.exportDriverReg.mimeType });
              href = URL.createObjectURL(blob);
            } else {
              this.loading = false;
              this.note = 'Error: Data type for export not specified';
              return;
            }
            link.setAttribute('href', href);
            link.setAttribute('download', ( `${this.exportData?.of?.name}_Export_${(new Date()).toDateString().replaceAll(' ', '_')}.` || 'data.') + this.exportDriverReg.extension);
            document.body.appendChild(link);
            link.click();

            // Cleanup data blob and link
            if ( blob ) URL.revokeObjectURL(link.href);
            document.body.removeChild(link);
          }
        } catch (e) {
          console.error('Export failed:', e);
          this.note = 'Error: ' + (e.data?.message || e.message || 'Export failed');
        } finally {
          if ( this.exportAllColumns )
            this.filteredTableColumns = filteredColumnsCopy;
          this.loading = false;
        }
      }
    },
    {
      name: 'open',
      label: 'Save',
      isAvailable: function(isOpenAvailable) {
        return isOpenAvailable;
      },
      code: async function() {
        this.loading = true;
        this.note = '';

        var filteredColumnsCopy = this.filteredTableColumns;
        if ( this.exportAllColumns )
          this.filteredTableColumns = null;

        var url;
        try {
          url = this.exportData ?
            await this.exportDriver.exportDAO(this.__context__, this.exportData) :
            await this.exportDriver.exportFObject(this.__context__, this.exportObj);

          if ( url && url.length > 0 ) {
            window.location.replace(url);
          } else {
            this.parentNode.close();
          }
        } catch (e) {
          console.error('Export failed:', e);
          this.note = 'Error: ' + (e.data?.message || e.message || 'Export failed');
        } finally {
          if ( this.exportAllColumns )
            this.filteredTableColumns = filteredColumnsCopy;
          this.loading = false;
        }
      }
    }
  ]
});
