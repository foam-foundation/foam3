/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2',
  name: 'PropertyModal',
  extends: 'foam.u2.dialog.ConfirmationModal',

  documentation: 'View for attaching a choice to a modal',

  imports: [
    'notify'
  ],

  requires: [
    'foam.u2.ControllerMode',
    'foam.u2.PropertyBorder'
  ],

  messages: [
    { name: 'DEFAULT_TITLE', message: 'Please fill out the following' },
    { name: 'REQUIRED', message: 'Required' },
    { name: 'OPTIONAL', message: 'Optional' }
  ],

  css: `
    ^inner {
      align-items: stretch;
    }
  `,

  properties: [
    [ 'showCancel', false ],
    {
      name: 'title',
      expression: function(isModalRequired) {
        if ( isModalRequired ) return `${this.DEFAULT_TITLE} (${this.REQUIRED})`;
        return `${this.DEFAULT_TITLE} (${this.OPTIONAL})`;
      }
    },
    {
      class: 'Property',
      name: 'property'
    },
    {
      class: 'Boolean',
      name: 'isModalRequired'
    },
    'propertyData'
  ],

  methods: [
    function addBody() {
      return this.E()
        .startContext({ controllerMode: this.ControllerMode.EDIT, data: this.data })
          .tag(this.PropertyBorder, {
            prop: this.property,
            data$: this.data$
          })
        .endContext();
    }
  ],

  actions: [
    {
      name: 'confirm',
      buttonStyle: 'PRIMARY',
      isEnabled: (isModalRequired, propertyData) => {
        if ( ! isModalRequired ) return true;

        return Array.isArray(propertyData) ? propertyData.length > 0 : propertyData;
      },
      code: async function(X) {
        return await this.primaryAction?.maybeCall(X, this.data).then(() => {
          X.closeDialog();
        });
      }
    }
  ]
});
