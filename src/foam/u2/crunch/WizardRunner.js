/**
 * @license
 * Copyright 2023 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.crunch',
  name: 'WizardRunner',
  imports: ['crunchController'],
  issues: [
    'when source is a capability it should create a WizardFlow'
  ],
  documentation: `
    Wizard Runner is a configuration that is used to run (and potentially modify) a wizard  
  `,
  requires: [
    'foam.u2.wizard.WizardType',
    'foam.u2.wizard.wizardflow.WizardFlow'
  ],
  exports: [ 'as wizardRunner' ],
  properties: [
    {
      class: 'Enum',
      of: 'foam.u2.wizard.WizardType',
      name: 'wizardType'
    },
    {
      name: 'source',
      adapt: function(o, n) {
        if ( foam.String.isInstance(n) ) return n;
        if ( foam.lang.FObject.isInstance(n) ) return n;
        return foam.json.parse(n, null, this.__subContext__);
      },
      documentation: `
        Either a capability, string, or WizardFlow
      `
    },
    {
      name:'options',
      class: 'Map',
      documentation: `
        These options are used when building the sequence or running the Wizard.
        These should be set before calling launch, and before any access of the sequence property.
      `
    },
    {
      name:'sequence',
      factory: function() {
        const IN_PROGRESS = this.crunchController.WizardStatus.IN_PROGRESS;
        const seq = this.getSequence_(this.__subContext__, this.isInline);
        return seq
      } 
    },
    {
      name: 'parentWizard',
      factory: function() {
        return this.getParentWizard_();
      }
    },
    {
      name: 'isInline',
      expression: function(parentWizard, options) {
        return (options.inline ?? true) && !! parentWizard;
      }
    },
    {
      name: 'controller',
      documentation: `The launched wizard context.
        Ultimately the return of the sequence.
        Populated in launch()`
    }
  ],
  methods: [
    async function launch() {
      x = this.__subContext__;

      const seq = this.sequence;

      if ( this.deduplicateWizard() ) {
        this.sequence.endSequence();
        throw new Error(`A UCJ is already in progress for this source: ${this.source}`);
      }
      let returnPromise = null;
      let promise$ = foam.lang.SimpleSlot.create({ value: false }, this);

      if ( this.options.returnCompletionPromise ) {
        returnPromise = new Promise(rslv => {
          promise$.sub(v => {
            if ( v ) rslv(v);
          });
        });
      }

      if ( this.isInline ) {
        this.controller = await this.crunchController.inlineWizardFromSequence(this.parentWizard, seq, ( returnPromise ? { onLastWizardletSaved: () => promise$.set(true) } : {}));
        return returnPromise ? returnPromise : null;
      }

      this.controller = await seq.execute().then((v) => {
          promise$.set(true);
          return v;
      });
      return returnPromise ? returnPromise : this.controller;
    },
    function deduplicateWizard() {
      if ( this.crunchController.lastActiveWizard?.status == 'IN_PROGRESS' && 
        foam.util.equals(this.crunchController.lastActiveWizard.__subContext__.wizardRunner?.source, this.source) &&
        this.wizardType == 'UCJ'
      ) {
        return true;
      }
    },
    function launchNotInline_ () {
      const seq = this.sequenceFromWizardType_();
    },
    function getParentWizard_ () {
      const lastWizard = this.crunchController.lastActiveWizard;
      if ( ! lastWizard ) return null;
      if ( lastWizard.status !== this.crunchController.WizardStatus.IN_PROGRESS ) {
        return null;
      }
      return lastWizard;
    },
    function getSequence_ (x, isInline) {
      if ( ! this.WizardFlow.isInstance(this.source) ) {
        return this.getSequenceFromCapability_(x, isInline);
      }

      if ( isInline ) {
        return this.crunchController.toWizardFlowSequence(
          this.crunchController.createInlineWizardSequence(x)
        ).add(this.source);
      }

      return this.crunchController.createWizardFlowSequence(x)
        .addBefore('ShowPreexistingAgent', this.source);
    },
    function getSequenceFromCapability_ (x, isInline) {
      const wizardType = this.wizardType;

      if ( isInline) {
        let seq;
        if ( wizardType == this.WizardType.UCJ ) {
          seq = this.crunchController.toGraphAgentWizard(this.crunchController.createUCJInlineWizardSequence(x));
        } else {
          seq = this.crunchController.toGraphAgentWizard(this.crunchController.createInlineWizardSequence(x))
        }
        seq.addBefore('CapabilityAdaptAgent', {
          class: 'foam.u2.wizard.agents.RootCapabilityAgent',
          rootCapability: this.source
        });
        return seq;
      }

      if ( ! isInline && wizardType == this.WizardType.UCJ ) {
        let seq = this.crunchController
          .createTransientWizardSequence(this.__subContext__)
          .addBefore('ConfigureFlowAgent', {
            class: 'foam.u2.wizard.agents.RootCapabilityAgent',
            rootCapability: this.source
          })
          .reconfigure('WAOSettingAgent', {
            waoSetting: foam.u2.crunch.wizardflow.WAOSettingAgent.WAOSetting.UCJ
          })
          .remove('RequirementsPreviewAgent');
        return this.crunchController.toGraphAgentWizard(seq)
      }

      if ( wizardType == this.WizardType.TRANSIENT ) {
        let seq = this.crunchController
          .createTransientWizardSequence(this.__subContext__)
          .addBefore('ConfigureFlowAgent', {
            class: 'foam.u2.wizard.agents.RootCapabilityAgent',
            rootCapability: this.source
          })
          .reconfigure('WAOSettingAgent', {
            waoSetting: foam.u2.crunch.wizardflow.WAOSettingAgent.WAOSetting.CAPABLE
          })
          .remove('RequirementsPreviewAgent')
        return this.crunchController.toGraphAgentWizard(seq);
      }
      console.error(
        '%cAre you configuring a new wizard?%c%s',
        'color:red;font-size:30px', '',
        'you need to add explicit support for ' +
          (isInline ? 'inline-' : '')+wizardType.name +
          ' wizards in WizardRunner.js; ' +
          'or wait for Eric to finish refactoring sequences'
      );
      throw new Error('getSequence_ has no implementation for this', {
        isInline, wizardType
      });
    }
  ]
});
