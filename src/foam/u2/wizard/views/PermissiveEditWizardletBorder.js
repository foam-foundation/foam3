/**
 * @license
 * Copyright 2023 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.wizard.views',
  name: 'PermissiveEditWizardletBorder',
  extends: 'foam.u2.wizard.views.NullEditWizardletBorder',
  documentation: 'Border for wizardlets that the user is allowed to edit',

  imports: ['ctrl', 'notify'],

  requires: [
    'foam.u2.borders.CardBorder'
  ],
  
  messages: [
    {
      name: 'SAVE_FAILED',
      message: 'Your data could not be saved.'
    }
  ],

  css: `
    ^flex{
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    ^button-flex{
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 0.4rem;
    } 
  `,

  properties: [
    {
      class: 'FObjectProperty',
      name: 'oldData'
    }
  ],
  
  methods: [
    function init() {
      // set in init as factories are lazy
      this.wizardlet.loadEvent.sub(() => {
        this.oldData = this.wizardlet.data?.clone()
      })

      this
        .addClass()
          .startContext({data: this})
            .start().addClass(this.myClass('flex'))
            .start().addClass('h500', this.myClass('wizard-heading')).add(this.title).end()
            .start().addClass(this.myClass('button-flex'))
              .tag(this.EDIT,  { size: 'SMALL'})
              .tag(this.CANCEL,  { size: 'SMALL'})
              .tag(this.SAVE,  { size: 'SMALL'})
            .end()
            .end()
          .endContext()
          .start(this.CardBorder).addClass(this.myClass('card'))
          .tag('div', null, this.content$)
        .end()
    }
  ],

  actions: [
    {
      name: 'Edit',
      label: 'Edit',
      buttonStyle: 'TERTIARY',
      isAvailable: function(controllerMode) {
        return this.controllerMode !== foam.u2.ControllerMode.EDIT
      },
      code: function() {
        this.controllerMode = foam.u2.ControllerMode.EDIT
      }
    },
    {
      name: 'Save',
      label: 'Save',
      buttonStyle: 'PRIMARY',
      isAvailable: function(controllerMode) {
        return this.controllerMode === foam.u2.ControllerMode.EDIT
      },
      isEnabled: function(wizardlet$data$errors_) {
        return !wizardlet$data$errors_
      },
      code: async function () {      
       try {
        await this.wizardlet.save()
        this.ctrl.reloadClient()
        this.controllerMode = foam.u2.ControllerMode.VIEW
       } catch (e) {
        this.notify(this.SAVE_FAILED, e.message, 'ERROR', true);
       }
      }
    },
    {
      name: 'Cancel',
      label: 'Cancel',
      buttonStyle: 'TERTIARY',
      isAvailable: function(controllerMode) {
        return this.controllerMode === foam.u2.ControllerMode.EDIT
      },
      code: function() {
        this.wizardlet.data = this.oldData
        this.controllerMode = foam.u2.ControllerMode.VIEW
      }
    }
  ]
  });
  