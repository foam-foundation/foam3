/*
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.dialog',
  name: 'ConfirmationModal',
  extends: 'foam.u2.dialog.StyledModal',
  documentation: `
    Extension of styled modal with a primary and secondary action, mainly to be used for conifrmations and yes/no modals.
    Clicking on any action closes performs the action and closes the dialog
  `,

  imports: ['theme?'],

  messages: [
    { name: 'CONFIRM_LABEL', message: 'Confirm' },
    { name: 'CANCEL_LABEL', message: 'Cancel' }
  ],

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.lang.Action',
      name: 'primaryAction',
      documentation: 'The primary action for this modal dialog (Save/Submit/Continue)',
    },
    {
      class: 'FObjectProperty',
      of: 'foam.lang.Action',
      name: 'secondaryAction',
      documentation: `The secondary action for this modal dialog (Close/Cancel)
      can be turned off using the 'showCancel' property`,
    },
    ['showCancel', true],
    'data'
  ],

  methods: [
    function addActions(self) {
      var actions = this.startContext({ data: self });
      if ( self.showCancel ) {
        actions.tag(self.CANCEL, { label: self.secondaryAction?.label || self.CANCEL_LABEL });
      }
      actions.tag(self.CONFIRM, { label: self.primaryAction?.label || self.CONFIRM_LABEL, isDestructive: self.modalStyle == 'DESTRUCTIVE' });
      return actions.endContext();
    }
  ],

  actions: [
    {
      name: 'confirm',
      buttonStyle: 'PRIMARY',
      code: async function(X) {
        await this.primaryAction && this.primaryAction.maybeCall(X, this.data);
        X.closeDialog();
      }
    },
    {
      name: 'cancel',
      buttonStyle: 'TERTIARY',
      code: function(X) {
        this.secondaryAction && this.secondaryAction.maybeCall(X, this.data);
        X.closeDialog();
      }
    }
  ]

});
