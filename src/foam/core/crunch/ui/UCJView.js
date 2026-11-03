/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.crunch.ui',
  name: 'UCJView',
  extends: 'foam.u2.View',

  imports: [
    'agentJunctionDAO',
    'approvalRequestDAO',
    'capabilityDAO',
    'crunchController',
    'notify',
    'pushMenu',
    'stack',
    'tableViewApprovalRequestDAO',
    'translationService',
    'userDAO'
  ],

  documentation: `
  To use the UCJView for a custom set of capabilities : should set the following properties:
    this.UCJView.create({
      isSettingCapabilities: // true,
      data: // need to set a ucj such that wizard extracts subject from
      mode: this.mode, // seems to want to be ControllerMode - however not clear why this is here
      capabilitiesList: // Set Custom Capability list
    });
  `,

  implements: [
    'foam.mlang.Expressions'
  ],

  requires: [
    'foam.log.LogLevel',
    'foam.core.approval.ApprovalStatus',
    'foam.core.auth.Subject',
    'foam.core.auth.UserUserJunction',
    'foam.core.crunch.CapabilityJunctionStatus',
    'foam.u2.ControllerMode',
    'foam.u2.crunch.EasyCrunchWizard',
    'foam.u2.crunch.wizardflow.CapabilityAdaptAgent',
    'foam.u2.crunch.wizardflow.CapabilityStoreAgent',
    'foam.u2.crunch.wizardflow.CreateWizardletsAgent',
    'foam.u2.crunch.wizardflow.FilterGrantModeAgent',
    'foam.u2.crunch.wizardflow.LoadCapabilitiesAgent',
    'foam.u2.crunch.wizardflow.LoadWizardletsAgent',
    'foam.u2.crunch.wizardflow.SaveAllAgent',
    'foam.u2.crunch.wizardflow.WAOSettingAgent',
    'foam.u2.DisplayMode',
    'foam.u2.stack.Stack',
    'foam.u2.stack.StackView',
    'foam.u2.wizard.agents.ConfigureFlowAgent',
    'foam.u2.wizard.agents.DetachAgent',
    'foam.u2.wizard.agents.DetachSpinnerAgent',
    'foam.u2.wizard.agents.DeveloperModeAgent',
    'foam.u2.wizard.agents.SpinnerAgent',
    'foam.u2.wizard.agents.StepWizardAgent',
    'foam.u2.wizard.agents.CreateControllerAgent',
    'foam.u2.wizard.StepWizardConfig',
    'foam.util.async.Sequence'
  ],

  css: `
    << {
      padding-bottom: 0px;
    }
    <<stack-container .foam-u2-stack-StackView {
      padding-left: 0px;
    }
    << .foam-u2-wizard-ScrollingStepWizardView {
      height: auto;
    }
    << .foam-u2-wizard-ScrollingStepWizardView-fix-grid {
      height: calc(100vh - 163px);
    }
  `,

  messages: [
    { name: 'BACK_LABEL',      message: 'Back' },
    { name: 'SUCCESS_UPDATED', message: 'Data successfuly updated' }
  ],

  properties: [
    {
      name: 'config',
      class: 'FObjectProperty',
      of: 'foam.u2.crunch.EasyCrunchWizard',
      factory: function () {
        return this.EasyCrunchWizard.create();
      }
    },
    {
      name: 'capabilitiesList',
      class: 'FObjectArray',
      of: 'foam.core.crunch.Capability'
    },
    {
      name: 'isSettingCapabilities',
      class: 'Boolean',
      documentation: `If passing in a set of capabilites to open,
      then this is true and the wizard sequence is different.
      Otherwise we assume a rootCapability is instantiating this flow
      and thus a different wizard sequence.`
    }
  ],

  methods: [
    async function render() {
      if ( ! this.data ) return;
      let user = await this.userDAO.find(this.data.sourceId);
      let realUser;
      if ( this.data.effectiveUser ) {
        realUser = await this.userDAO.find(this.data.effectiveUser);
      } else {
        let junction = await this.agentJunctionDAO.find(this.EQ(this.UserUserJunction.TARGET_ID, this.data.sourceId));
        if ( junction?.sourceId ) {
          realUser = await this.userDAO.find(junction.sourceId);
        }
      }
      if ( ! realUser ) realUser = user;
      var subject = this.Subject.create({ user: user, realUser: realUser });
      var x = this.__subContext__.createSubContext({
        wizardSubject: subject,
        controllerMode:
          this.mode == this.DisplayMode.RW
            ? this.ControllerMode.EDIT
            : this.ControllerMode.VIEW
      });
      var sequence = undefined;
      if ( this.isSettingCapabilities ) {
        x = x.createSubContext({
          capabilities: this.capabilitiesList
        });
        sequence = this.crunchController.createWizardSequence(null, x);
        sequence
          .reconfigure('ConfigureFlowAgent', { popupMode: false })
          .remove('LoadTopConfig')
          .remove('CapabilityAdaptAgent')
          .remove('GrantedEditAgent')
          .remove('LoadCapabilitiesAgent')
          .remove('CheckRootIdAgent')
          .remove('CheckPendingAgent')
          .remove('CheckNoDataAgent')
          .remove('WizardStateAgent')
          .remove('FilterGrantModeAgent')
          .remove('SkipGrantedAgent')
          .remove('RequirementsPreviewAgent')
          .remove('AutoSaveWizardletsAgent')
      } else {
        sequence = this.crunchController.createWizardSequence(this.data.targetId, x);
        sequence
          .reconfigure('LoadCapabilitiesAgent', {
            subject: subject })
          .reconfigure('GrantedEditAgent', {
            subject: subject
          })
          .reconfigure('ConfigureFlowAgent', {
            popupMode: false
          })
          .remove('LoadTopConfig')
          .remove('RequirementsPreviewAgent')
          .remove('SkipGrantedAgent')
          .remove('WizardStateAgent')
          .remove('AutoSaveWizardletsAgent')
          .remove('PutFinalJunctionsAgent')
          .remove('CheckPendingAgent')
          .remove('CheckNoDataAgent')
          .add(this.SaveAllAgent, { onSave: this.onSave.bind(this) });
      }
      this.config.applyTo(sequence);
      sequence.execute();
    },

    async function onSave(isValid, ucj) {
      if ( this.config.rejectOnInvalidatedSave && this.config.approval ) {
        this.onSaveRejectOnInvalidated_(isValid, ucj);
        return;
      }

      this.notify(this.SUCCESS_UPDATED, '', this.LogLevel.INFO, true);
      this.stack.back();
    },

    async function onSaveRejectOnInvalidated_(isValid, ucj) {
      try {
        if ( isValid && ucj.status !== this.CapabilityJunctionStatus.ACTION_REQUIRED ) {
          this.notify(this.SUCCESS_UPDATED, '', this.LogLevel.INFO, true);
          this.stack.back();
          return;
        }

        const rejectedApproval = this.config.approval.clone();
        rejectedApproval.status = this.ApprovalStatus.REJECTED;
        rejectedApproval.memo = 'Outdated Approval.';
        await this.approvalRequestDAO.put(rejectedApproval);
        this.approvalRequestDAO.cmd(foam.dao.DAO.RESET_CMD);
        this.tableViewApprovalRequestDAO.cmd(foam.dao.DAO.RESET_CMD);
        this.approvalRequestDAO.cmd(foam.dao.DAO.PURGE_CMD);
        this.tableViewApprovalRequestDAO.cmd(foam.dao.DAO.PURGE_CMD);

        this.notify(this.SUCCESS_UPDATED, '', this.LogLevel.INFO, true);
        this.pushMenu('approvals', true);
      } catch (e) {
        this.notify(e.message, '', this.LogLevel.ERROR, true);
      }
    }
  ],

  actions: [
    {
      name: 'back',
      code: function() {
        this.stack.back();
      }
    }
  ]
});
