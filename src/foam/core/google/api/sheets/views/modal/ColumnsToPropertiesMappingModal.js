/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

 foam.CLASS({
  package: 'foam.core.google.api.sheets.views.modal',
  name: 'ColumnsToPropertiesMappingModal',
  extends: 'foam.core.google.api.sheets.views.wizardModal.WizardModalSubView',
  requires: [
    'foam.log.LogLevel',
    'foam.core.google.api.sheets.views.ColumnHeaderToPropertyMapping',
    'foam.u2.dialog.NotificationMessage'
  ],
  imports: [
    'importConfig',
    'ctrl',
    'notify',
    'config'
  ],
  css: `
    <<footer {
      width: 100%;
      position: absolute;
      bottom: 0;
      padding: 0;
    }
  `,
  messages: [
    { name: 'ERROR_MSG', message: 'Something went wrong! Please contact support'},
    { name: 'SUCCESS_MSG', message: 'Number of records inserted: '},
    { name: 'NO_COLUMN_MATCHES_MSG', message: 'It looks like data you\'re trying to import do not match out records. Please make sure that google sheet you\'re trying to import and data on the current page match' }
  ],
  methods: [
    function render() {
      this.SUPER();
      var self = this;

        this
          .start()
            .addClass(this.myClass())
            .start('h2')
              .style({'padding-left': '16px'})
              .add('Exported Columns:')
            .end()
            .forEach(self.importConfig.columnHeaderPropertyMappings, function(c) {
              self
              .start()
                .style({'padding': '0 16px'})
                .startContext({ data: c })
                .add(self.ColumnHeaderToPropertyMapping.COLUMN_HEADER.__)
                .endContext()
              .end()
              .br();
            })
          .end()
          .start()
            .style({ 'padding-bottom': '120px' })
          .end()
          .start({ class: 'foam.core.google.api.sheets.views.wizardModal.WizardModalNavigationBar', back: this.BACK, next: this.NEXT }).addClass(this.myClass('footer')).end();
    }
  ],
  actions: [
    {
      name: 'back',
      label: 'Back',
      code: function(X) {
        this.pushToId('googleSheetLink');
      }
    },
    {
      name: 'next',
      label: 'Continue',
      code: async function(X) {
        if ( ! this.importConfig.columnHeaderPropertyMappings.some(m => m.prop && ! m.prop.sheetsOutput) ) {
          this.notify(this.NO_COLUMN_MATCHES_MSG, '', this.LogLevel.ERROR, true);
          return;
        }

        await X['googleSheetsDataImport'].importData(X, this.importConfig).then(r => {
          var message = this.NotificationMessage.create();
          if ( r.success )
            message.message = this.SUCCESS_MSG + r.result;
          else {
            message.message = this.ERROR_MSG;
            message.type = this.LogLevel.ERROR;
          }
          this.ctrl.add(message);
        });
        X.closeDialog();
      }
    }
  ],
});
