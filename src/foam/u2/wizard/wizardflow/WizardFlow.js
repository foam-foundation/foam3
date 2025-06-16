/**
 * @license
 * Copyright 2023 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.wizard.wizardflow',
  name: 'WizardFlow',
  extends: 'foam.util.async.SequenceInstaller',
  mixins: [
    'foam.u2.wizard.wizardflow.WizardDSL'
  ],
  requires: [
    'foam.u2.crunch.EasyCrunchWizard',
    'foam.u2.wizard.AlternateFlow',
    'foam.u2.wizard.agents.AlternateFlowAgent',
    'foam.u2.wizard.WizardPosition',
    'foam.u2.wizard.WizardType',
    'foam.u2.wizard.agents.QuickAgent',
    'foam.u2.wizard.wizardflow.AddCapabilityHierarchy',
    'foam.u2.wizard.wizardflow.Export',
    'foam.u2.wizard.wizardflow.AddWizardlet',
    'foam.u2.wizard.wizardflow.AddFacadeWizardlet',
    'foam.u2.wizard.wizardflow.EditWizardlet',
    'foam.u2.wizard.wizardflow.RemoveWizardlets',
    'foam.u2.wizard.wizardflow.Predicated',
    'foam.util.async.AdvanceToAgent'
  ],
  properties: [
    ['initialized_', false],
    {
      class: 'String',
      name: 'name',
      documentation: 'Wizard flow name when serving as wizard step context agent in a wizard',
      factory: function() {
        return this.toSummary();
      }
    }
  ],
  methods: [
    function equals(other) { return this.model_.id === other.model_.id; },
    async function install(...a) {
      const SUPER = this.SUPER.bind(this);
      if ( ! this.initialized_ ) {
        if ( typeof this.sequence !== 'function' ) {
          throw new Error('abstract method WizardFlow.sequence() is required');
        }
        this.tag(this.QuickAgent, {
          executeFn: x => {
            if ( x.wizardlets ) return x;
            return x.createSubContext({ wizardlets: [] });
          }
        });
        await this.sequence(a[0]);
        this.initialized_ = true;
      }
      return await SUPER(...a);
    },

    function toSummary() {
      return this.cls_.name;
    }
  ]
});
