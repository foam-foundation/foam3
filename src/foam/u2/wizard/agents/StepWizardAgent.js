/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.wizard.agents',
  name: 'StepWizardAgent',
  implements: [
    'foam.lang.ContextAgent',
    'foam.mlang.Expressions'
  ],
  documentation: `
    Opens the wizard. The scrolling wizard is used by default, but the provided
    config object may specify the incremental wizard to be used instead.
  `,

  imports: [
    'crunchController?',
    'ctrl',
    'config? as importedConfig',
    'isIframe',
    'popupMode',
    'flowAgent?',
    'sequence',
    'stack',
    'popupManager',
    'wizardClosing',
    'wizardController?'
  ],

  exports: ['wizardView'],

  requires: [
    'foam.u2.dialog.Popup',
    'foam.u2.stack.StackBlock',
    'foam.u2.wizard.ScrollingStepWizardView',
    'foam.u2.wizard.StepWizardConfig',
    'foam.u2.wizard.WizardStatus'
  ],

  properties: [
    {
      name: 'config',
      class: 'FObjectProperty',
      of: 'foam.u2.wizard.StepWizardConfig',
      factory: function() {
        return this.importedConfig || this.StepWizardConfig.create();
      }
    },
    'wizardView',
    'lastLastActiveWizard'
  ],

  methods: [
    async function execute() {
      const view = {
        ...this.wizardController.defaultView,
        data: this.wizardController
      };
      let self = this;

      this.onDetach(this.wizardController.status$.sub(() => {
        const v = this.wizardController.status;
        if ( v == this.WizardStatus.IN_PROGRESS ) return;
        this.resolveAgent();
        let closePromise = this.wizardController.onClose();
        if ( closePromise?.then )
          closePromise.then(() => {})
      }));

      if ( (view?.class || view?.cls_?.id).endsWith('ScrollingStepWizardView') ) {
        this.wizardController.autoPositionUpdates = false;
      }

      if ( this.wizardController.setFirstPosition ) {
        await this.wizardController.setFirstPosition();
      }

      await new Promise((resolve, onError) => {
        // If something has already completed the wizard at this stage, discard
        if( this.wizardController.status != this.WizardStatus.IN_PROGRESS ) 
          return resolve();
        this.onDetach(this.wizardController.lastException$.sub(() => {
          let e = this.wizardController.lastException;
          if ( ! e ) return;
          onError(e);
        }));

        // If this is published to, wizard status will stay IN_PROGRESS
        this.flowAgent?.sub(this.cls_.name,() => {
          resolve();
        })

        if ( this.crunchController ) {
          this.lastLastActiveWizard = this.crunchController.lastActiveWizard;
          this.crunchController.lastActiveWizard = this.wizardController;
        }
        if ( this.popupMode ) {
          this.wizardView = this.popupManager.push(view, this, this.config.popup || {})
        } else {
          this.wizardView = this.stack.set(view, this)
          // If wizard uses stack then remove returnToLaunchPointAgent
          this.sequence.remove('ReturnToLaunchPointAgent');
        }

        this.wizardView.onDetach(() => {
          this.crunchController.lastActiveWizard = this.lastLastActiveWizard;
          this.wizardClosing = true;
          if ( this.wizardController.status == this.WizardStatus.IN_PROGRESS ) {
            this.wizardController.status = this.WizardStatus.DISCARDED;
          }
          resolve();
        })
      }).catch(e => {
        this.resolveAgent();
      });
    }
  ],
  listeners: [
    function resolveAgent() {
      if ( this.wizardClosing ) return;
      this.wizardClosing = true;
      this.wizardView?.remove();
    }
  ]
});
