/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.crunch',
  name: 'CrunchController',
  documentation: `
    Defines behaviour for invocation of CRUNCH-related views.
  `,

  implements: [
    'foam.mlang.Expressions'
  ],

  imports: [
    'capabilityDAO',
    'capabilityCategoryDAO',
    'crunchService',
    'ctrl',
    'stack',
    'subject',
    'userCapabilityJunctionDAO',
    'translationService'
  ],

  requires: [
    'foam.log.LogLevel',
    'foam.core.crunch.AgentCapabilityJunction',
    'foam.core.crunch.UserCapabilityJunction',
    'foam.u2.crunch.wizardflow.CapabilityAdaptAgent',
    'foam.u2.crunch.wizardflow.CheckRootIdAgent',
    'foam.u2.crunch.wizardflow.GrantedEditAgent',
    'foam.u2.crunch.wizardflow.CheckPendingAgent',
    'foam.u2.crunch.wizardflow.CheckNoDataAgent',
    'foam.u2.crunch.wizardflow.LoadCapabilitiesAgent',
    'foam.u2.crunch.wizardflow.LoadCapabilityGraphAgent',
    'foam.u2.crunch.wizardflow.CreateWizardletsAgent',
    'foam.u2.crunch.wizardflow.GraphWizardletsAgent',
    'foam.u2.crunch.wizardflow.LoadWizardletsAgent',
    'foam.u2.crunch.wizardflow.FilterWizardletsAgent',
    'foam.u2.crunch.wizardflow.FilterGrantModeAgent',
    'foam.u2.crunch.wizardflow.WizardStateAgent',
    'foam.u2.crunch.wizardflow.RequirementsPreviewAgent',
    'foam.u2.crunch.wizardflow.AutoSaveWizardletsAgent',
    'foam.u2.crunch.wizardflow.PublishToWizardletsAgent',
    'foam.u2.crunch.wizardflow.PutFinalJunctionsAgent',
    'foam.u2.crunch.wizardflow.PutFinalPayloadsAgent',
    'foam.u2.crunch.wizardflow.TestAgent',
    'foam.u2.crunch.wizardflow.LoadTopConfig',
    'foam.u2.crunch.wizardflow.CapableDefaultConfigAgent',
    'foam.u2.crunch.wizardflow.SkipGrantedAgent',
    'foam.u2.crunch.wizardflow.MaybeDAOPutAgent',
    'foam.u2.crunch.wizardflow.ShowPreexistingAgent',
    'foam.u2.crunch.wizardflow.SaveAllAgent',
    'foam.u2.crunch.wizardflow.CapabilityStoreAgent',
    'foam.u2.crunch.wizardflow.DebugContextInterceptAgent',
    'foam.u2.crunch.wizardflow.DebugAgent',
    'foam.u2.crunch.wizardflow.WAOSettingAgent',
    'foam.u2.crunch.wizardflow.lite.CheckGrantedAgent',
    'foam.u2.crunch.wizardflow.StatusPageAgent',
    'foam.u2.wizard.WizardStatus',
    'foam.u2.wizard.agents.ConfigureFlowAgent',
    'foam.u2.wizard.agents.DeveloperModeAgent',
    'foam.u2.wizard.agents.StepWizardAgent',
    'foam.u2.wizard.agents.CreateControllerAgent',
    'foam.u2.wizard.agents.DetachAgent',
    'foam.u2.wizard.agents.SpinnerAgent',
    'foam.u2.wizard.agents.DetachSpinnerAgent',
    'foam.u2.wizard.agents.NullEventHandlerAgent',
    'foam.u2.wizard.agents.ReturnToLaunchPointAgent',
    'foam.u2.wizard.debug.WizardInspector',
    'foam.u2.wizard.wao.TopicWAO',
    'foam.util.async.Sequence',
    'foam.u2.borders.SpacingBorder',
    'foam.u2.crunch.CapabilityInterceptView',
    'foam.u2.dialog.Popup'
  ],

  properties: [
    {
      name: 'activeIntercepts',
      class: 'Array',
      documentation: `
        Since permissions may be checked during asynchronous calls,
        it is possible that the same intercept view will be requested
        twice in a short period of time. Keeping a map of active
        intercept views is done to prevent two intercept views being
        open for the same permission (as this would be confusing for
        the user if they happen to choose the "cancel" option).

        This also allows a single intercept view to activate the
        message retry for multiple permissioned calls made
        asynchronously.
      `
    },
    {
      class: 'Map',
      name: 'capabilityCache',
      factory: function() {
        return new Map();
      }
    },
    {
      class: 'Boolean',
      name: 'debugMode',
      factory: function () {
        // return this.ctrl.appConfig.mode == foam.core.app.Mode.DEVELOPMENT;
        return false;
      }
    },
    'lastActiveWizard'
  ],

  methods: [
    {
      name: 'openWizardInspector',
      code: function() {
        this.WizardInspector.OPEN({}, this.__subContext__.createSubContext({
          wizardController$: this.lastActiveWizard$
        }));
      }
    },
    {
      name: 'createWizardSequence',
      documentation: `
        Create the default wizard sequence for the specified capability in
        association with the user. The wizard can be
      `,
      code: function createWizardSequence(capabilityOrId, x) {
        if ( ! x ) x = this.__subContext__;
        var self = this;
        return this.Sequence.create(null, x.createSubContext({
          rootCapability: capabilityOrId
        }))
          .add(this.DeveloperModeAgent)
          .add(this.NullEventHandlerAgent)
          .add(this.ConfigureFlowAgent)
          .add(this.CapabilityAdaptAgent)
          .add(this.LoadTopConfig)
          .add(this.GrantedEditAgent)
          .add(this.LoadCapabilitiesAgent)
          .add(this.WAOSettingAgent)
          // TODO: remove CheckRootIdAgent after phase 2 fix on PENDING
          .add(this.CheckRootIdAgent)
          .add(this.CheckPendingAgent)
          .add(this.CheckNoDataAgent)
          .add(this.CreateWizardletsAgent)
          .add(this.WizardStateAgent)
          .add(this.FilterGrantModeAgent)
          .add(this.LoadWizardletsAgent)
          .add(this.SkipGrantedAgent)
          .add(this.RequirementsPreviewAgent)
          .add(this.AutoSaveWizardletsAgent)
          .callIf(this.debugMode, function () {
            this.add(self.DebugAgent)
          })
          .add(this.CreateControllerAgent)
          .addAs('ReadyAgent', this.PublishToWizardletsAgent, { event: 'onReady' })
          .add(this.StepWizardAgent)
          .add(this.DetachAgent)
          .add(this.SpinnerAgent)
          .add(this.SaveAllAgent)
          .addAs('SubmitAgent', this.PublishToWizardletsAgent, { event: 'onSubmit' })
          .add(this.DetachSpinnerAgent)
          .add(this.CapabilityStoreAgent)
          .add(this.StatusPageAgent)
          .add(this.ReturnToLaunchPointAgent)
          // .add(this.TestAgent)
          ;
      }
    },
    {
      name: 'createCapableWizardSequence',
      documentation: `
        Create the default wizard sequence for the specified Capable object
        intercept.

        A Capable object intercept occurs when the server replies with an object
        implementing Capable. These objects can have data requirements in the
        form of capabilities that are stored object-locally rather than in
        association with a user.
      `,
      code: function createCapableWizardSequence(intercept, capable, capabilityId, x) {
        x = x || this.__subContext__;
        x = x.createSubContext({
          intercept: intercept,
          capable: capable
        });

        const capableCapabilityId = capable && capable.capabilityIds[0];
        return this.toGraphAgentWizard(this.createWizardSequence(capabilityId || capableCapabilityId, x)
          .reconfigure('WAOSettingAgent', {
            waoSetting: this.WAOSettingAgent.WAOSetting.CAPABLE })
          .remove('SkipGrantedAgent')
          .remove('CheckRootIdAgent')
          .remove('CheckPendingAgent')
          .remove('CheckNoDataAgent')
          .remove('WizardStateAgent') //Filters out granted payloads but also only checks ucj not in context of capable obj, needs a capable analog or can be ignored as it is now
          .remove('FilterGrantModeAgent') // breaks for non-CapabilityWizardlet
          .remove('AutoSaveWizardletsAgent')
          .remove('ReturnToLaunchPointAgent')
          .addBefore('LoadTopConfig',this.CheckGrantedAgent)
          .addBefore('RequirementsPreviewAgent',this.ShowPreexistingAgent)
          .addBefore('DetachSpinnerAgent', this.MaybeDAOPutAgent))
          ;
      }
    },
    {
      name: 'createTransientWizardSequence',
      documentation: `
        A transient wizard has disposable CRUNCH payloads and is used for it's side effects.
        To use this sequence, a context agent exporting rootCapabilityId should be inserted
        before CapabilityAdaptAgent; this capability will be set as the requirement for a
        new BaseCapable object that will be discarded at the end of the sequence.
      `,
      code: function createTransientWizardSequence(x) {
        const capable = foam.core.crunch.lite.BaseCapable.create();
        x = x || this.__subContext__;
        x = x.createSubContext({ capable });
        return this.createWizardSequence('no-capability-id', x)
          .reconfigure('WAOSettingAgent', {
            waoSetting: this.WAOSettingAgent.WAOSetting.CAPABLE })
          .remove('SkipGrantedAgent')
          .remove('CheckRootIdAgent')
          .remove('CheckPendingAgent')
          .remove('CheckNoDataAgent')
          .remove('AutoSaveWizardletsAgent')
          .remove('SaveAllAgent')
          .remove('LoadWizardletsAgent')
          .remove('WizardStateAgent') // does not make sense in transient wizards
          .remove('FilterGrantModeAgent') // breaks for non-CapabilityWizardlet
          .remove('GrantedEditAgent')
          .remove('CapabilityStoreAgent')
          .addBefore('RequirementsPreviewAgent',this.ShowPreexistingAgent)
          .addBefore('DetachSpinnerAgent', this.MaybeDAOPutAgent)
          ;
      }
    },
    {
      name: 'createWizardFlowSequence',
      documentation: `
        This wizard sequence does not load a capability graph or any wizardlets.
        This is intended for use with WizardFlow (Fluent/DSL for wizards).
      `,
      code: function createWizardFlowSequence(x) {
        // for non-inline wizard only, clear old capas and wizardlets from x
        var newX = x.createSubContext({ capabilities: [], wizardlets: []});
        return this.toWizardFlowSequence(
          this.createTransientWizardSequence(newX)
        );
      }
    },
    {
      name: 'toWizardFlowSequence',
      documentation: `
        This wizard sequence does not load a capability graph or any wizardlets.
        This is intended for use with WizardFlow (Fluent/DSL for wizards).
      `,
      code: function toWizardFlowSequence(seq) {
        return seq
          .remove('LoadCapabilitiesAgent')
          .remove('LoadTopConfig')
          // Doesnt remove CreateWizardletsAgent since removing it would push a parent wizard's wizardlets into 
          // the context creating duplicates
          // .remove('CreateWizardletsAgent')
          .remove('RequirementsPreviewAgent')
          ;
      }
    },
    {
      name: 'toGraphAgentWizard',
      documentation: `
        Used to convert any sequence to use the new GraphingWizardletAgents, needed for proper XOR MinMax behavior
        NOTE: this should be the default behaviour since CreateWizardletsAgent and LoadWizardletsAgent are now considered legacy
      `,
      code: function(seq) {
        return seq
          .addBefore('CreateWizardletsAgent', {
            class: 'foam.u2.crunch.wizardflow.LoadCapabilityGraphAgent'
          })
          .addBefore('CreateWizardletsAgent', {
            class: 'foam.u2.crunch.wizardflow.GraphWizardletsAgent'
          })
          .remove('CreateWizardletsAgent')
          .remove('LoadWizardletsAgent');
      }
    },

    // TODO: remove this during NP-8927
    function createUCJInlineWizardSequence (x) {
      const capable = foam.core.crunch.lite.BaseCapable.create();
      x = x || this.__subContext__;
      x = x.createSubContext({ capable });

      return this.Sequence.create(null, x)
        .add(this.CapabilityAdaptAgent)
        .add(this.LoadCapabilitiesAgent)
        .add(this.LoadCapabilityGraphAgent)
        .add(this.WAOSettingAgent, {
          waoSetting: this.WAOSettingAgent.WAOSetting.UCJ
        })
        .add(this.GraphWizardletsAgent)
        .add(this.PublishToWizardletsAgent, { event: 'onReady' })
    },

    function createInlineWizardSequence (x) {
      return this.Sequence.create(null, x)
        .add(this.CapabilityAdaptAgent)
        .add(this.LoadCapabilitiesAgent)
        .add(this.LoadCapabilityGraphAgent)
        .add(this.WAOSettingAgent, {
          waoSetting: this.WAOSettingAgent.WAOSetting.CAPABLE
        })
        .add(this.GraphWizardletsAgent)
        .add(this.PublishToWizardletsAgent, { event: 'onReady' })
    },

    function wizardSequenceToViewSequence_(sequence) {
      return sequence
        .remove('WizardStateAgent')
        .remove('FilterGrantModeAgent')
        .remove('SkipGrantedAgent')
        .remove('RequirementsPreviewAgent')
        .remove('CreateControllerAgent')
        .remove('StepWizardAgent')
        .remove('MaybeDAOPutAgent')
        .remove('PutFinalPayloadsAgent')
        // if input is UCJ sequence, these apply
        .remove('CheckRootIdAgent')
        .remove('CheckPendingAgent')
        .remove('CheckNoDataAgent')

    },

    // This function is only called by CapableView
    function createCapableViewSequence(capable, x) {
      return this.wizardSequenceToViewSequence_(
        this.createCapableWizardSequence(undefined, capable, x)
      )
        .add(this.SaveAllAgent)
        ;
    },

    function createCapabilityViewSequence(capabilityOrId, x) {
      return this.wizardSequenceToViewSequence_(
        this.createWizardSequence(capabilityOrId, x)
      )
        .add(this.SaveAllAgent)
        ;
    },

    async function handleIntercept(intercept) {
      var self = this;

      // TODO: determine why this is here
      intercept.capabilities.forEach((c) => {
        self.capabilityCache.set(c, false);
      });

      // Create context including the intercept object
      let x = this.__subContext__.createSubContext({ intercept });

      // Try inline intercept
      if ( await this.maybeInlineIntercept(intercept) ) return;

      if ( intercept.interceptType == intercept.InterceptType.COMPOSITE ) {
        // TODO: (NP-7813) verify that intercept view still works
        x = await self.maybeLaunchInterceptView(intercept);
      } else if ( intercept.interceptType == intercept.InterceptType.UCJ ) {
        const rootCapability = intercept.capabilities[0];
        x = await self.createWizardSequence(rootCapability, x).execute();
      } else if ( intercept.interceptType == intercept.InterceptType.CAPABLE ) {
        x = await self.launchCapableWizard(intercept, x);
      }

      const wizardController = x.wizardController;

      if ( wizardController?.status == this.WizardStatus.COMPLETED ) {
        const returnObject = intercept.returnCapable || intercept.capables[0];
        intercept.resolve(returnObject);
        return;
      }

      if ( ! wizardController || wizardController.status == this.WizardStatus.DISCARDED ) {
        intercept.reject('cancelled by user');
        return;
      }

      intercept.resend();
    },

    async function maybeInlineIntercept(intercept, wizardController) {
      if ( ! wizardController ) wizardController = this.lastActiveWizard;
      if ( ! this.canInlineIntercept(intercept, wizardController) ) {
        return false;
      }
      for ( const capable of intercept.capables ) {
        let ignoreCapas = [];
        for ( let i = 0; i < capable.capablePayloads?.length; i++ ) {
          let payload = capable.capablePayloads[i];
          // if payload already in a final state, skip
          if ( payload?.status == 'GRANTED' ||
            payload?.status == 'PENDING' ||
            payload?.status == 'REJECTED' ) {
            ignoreCapas.push(payload.capability);
          }
        }
        let remainingCapas = capable.capabilityIds.filter(el => ! ignoreCapas.includes(el))
        for ( let i = 0; i < remainingCapas.length; i++ ) {
          // for capable intercepts with multiple capability ids
          // only do put on last wizardlet
          var doPut = i == remainingCapas.length - 1;
          await this.doInlineIntercept(
            wizardController, capable, remainingCapas[i], intercept,
            { put: doPut }
          );
        }
      }
      return true;
    },

    function canInlineIntercept(intercept, wizardController) {
      // This must be an intercept for Capable objects
      if ( intercept.interceptType != intercept.InterceptType.CAPABLE ) {
        return false;
      }

      // There must be a wizard
      if ( ! wizardController ) wizardController = this.lastActiveWizard;
      if ( ! wizardController ) return false;

      // The wizard must be in progress
      if ( wizardController.status !== this.WizardStatus.IN_PROGRESS ) {
        return false;
      }

      return true;
    },

    async function doInlineIntercept(
      wizardController, capable, capabilityId,
      opt_intercept, flags, opt_x,
      opt_sequenceExtras
    ) {
      if ( ! capable ) {
        capable = foam.core.crunch.lite.BaseCapable.create();
      }

      let x = ( opt_x || wizardController.__subContext__ ).createSubContext({
        capable,
        intercept: opt_intercept,
        wizardController: wizardController,
        rootCapability: capabilityId,
        wizardlets: []
      });

      const seq = this.createInlineWizardSequence(x);

      if ( opt_sequenceExtras ) {
        for ( const fluentSpec of opt_sequenceExtras ) {
          fluentSpec.apply(seq);
        }
      }

      const options = {};
      if ( flags.put )  {
        options.onLastWizardletSaved = async x => {
          const targetDAO = x[opt_intercept.daoKey];
          let a = await targetDAO.put(capable);
        }
      }

      // for multiple capabilityIds: pass in start index before any wizardlets are added
      const wi = wizardController.activePosition.wizardletIndex;
      await this.inlineWizardFromSequence(wizardController, seq, options, wi);

      if ( opt_intercept ) opt_intercept.resolve(capable);
    },

    async function inlineWizardFromSequence(wizardController, seq, options, startWi) {
      options = options || {};

      if ( ! wizardController ) wizardController = this.lastActiveWizard;

      let x = await seq.execute();

      if ( options.onLastWizardletSaved ) {
        const lastWizardlet = x.wizardlets[x.wizardlets.length - 1];
        lastWizardlet.wao = this.TopicWAO.create({
          delegate: lastWizardlet.wao
        });

        lastWizardlet.wao.saved.sub(async () => {options.onLastWizardletSaved(x)});
      }

      for ( let i = 0; i < x.wizardlets.length; i++ ) {
        let w = x.wizardlets[i];
        w.wizardController = wizardController;
      }

      const wi = wizardController.activePosition.wizardletIndex;
      startWi = startWi || wi;

      console.log('splicing at wizard position', wi);
      // Remove intercept wizardlets if user goes back beyond th intercept
      wizardController.wizardlets[wi].wao = this.TopicWAO.create({
        delegate: wizardController.wizardlets[wi].wao
      });

      wizardController.onDetach(wizardController.wizardlets[startWi].wao.saving.sub(
        foam.events.oneTime(() => {
          wizardController.wizardlets$splice(startWi + 1, x.wizardlets.length)
        })
      ));
      wizardController.wizardlets$splice(wi + 1, 0, ...x.wizardlets);
      return x;
    },

    function maybeLaunchInterceptView(intercept) {
      // Clear stale intercepts (ones which have been closed already)
      this.activeIntercepts = this.activeIntercepts.filter((ic) => {
        return ( ! ic.aquired ) && ( ! ic.cancelled );
      });
      // Try to find a matching intercept view that's already opened.
      // NP-1426 explains this is greater detail.
      for ( let i = 0 ; i < this.activeIntercepts.length ; i++ ) {
        let activeIntercept = this.activeIntercepts[i];
        let hasAllOptions = true;

        // All options in the active intercept need to satisfy the
        // incoming intercept for this to be a match.
        activeIntercept.capabilities.forEach((capOpt) => {
          if ( ! intercept.capabilities.includes(capOpt) ) {
            hasAllOptions = false;
          }
        });
        if ( hasAllOptions ) {
          return activeIntercept.promise;
        }
      }
      // Register intercept for later occurances of the check above
      this.activeIntercepts.push(intercept);

      // Pop up the popup
      return new Promise((resolve, _) => {
        this.ctrl.add(this.Popup.create({ closeable: false })
            .tag(this.CapabilityInterceptView, {
              data: intercept,
              onClose: (x) => {
                x.closeDialog();
                resolve(x);
              }
            })
        );
      });
    },

    function purgeCachedCapabilityDAOs() {
      this.capabilityDAO.cmd_(this, foam.dao.DAO.PURGE_CMD);
      this.capabilityDAO.cmd_(this, foam.dao.DAO.RESET_CMD);
      this.capabilityCategoryDAO.cmd_(this, foam.dao.DAO.PURGE_CMD);
      this.capabilityCategoryDAO.cmd_(this, foam.dao.DAO.RESET_CMD);
      this.userCapabilityJunctionDAO.cmd_(this, foam.dao.DAO.PURGE_CMD);
      this.userCapabilityJunctionDAO.cmd_(this, foam.dao.DAO.RESET_CMD);
    },

    // CRUNCH Lite Methods
    function launchCapableWizard(intercept, x) {
      var p = Promise.resolve(true);

      intercept.capables.forEach(capable => {
        // Create one capable wizard per capable requirement listed in capable.capabilityIds.
        capable.capabilityIds.forEach((c) => {
          var seq = this.createCapableWizardSequence(intercept, capable, c, x);
          p = p.then((x) => {
            // Halt launching subsequent capable wizards if users closed the wizard.
            return x?.wizardController?.status == 'DISCARDED' ? x
              : seq.execute().then(x => x);
          });
        });
      });

      return p;
    }
  ]
});
