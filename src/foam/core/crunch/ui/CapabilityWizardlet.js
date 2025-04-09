/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */
foam.CLASS({
  package: 'foam.core.crunch.ui',
  name: 'CapabilityWizardlet',
  extends: 'foam.u2.wizard.wizardlet.BaseWizardlet',
  implements: ['foam.u2.wizard.DynamicActionWizardlet'],

  requires: [
    'foam.core.crunch.CapabilityJunctionStatus',
    'foam.u2.wizard.wao.ProxyWAO',
    'foam.u2.wizard.WizardletIndicator'
  ],

  properties: [
    // Properties specific to CapabilityWizardSection
    {
      name: 'capability'
    },
    {
      name: 'status'
    },
    {
      name: 'id',
      expression: function (capability) {
        return capability ? capability.id : '';
      }
    },
    {
      class: 'Boolean',
      name: 'goNextOnGranted',
      documentation: 'When set to true, wizard will automatically move to the next wizardlet as soon as this is granted'
    },
    // Properties for WizardSection interface
    {
      name: 'of',
      class: 'Class',
      expression: function(capability) {
        if ( ! capability || ! capability.of ) return null;
        return capability.of;
      }
    },
    {
      name: 'data',
      flags: ['web']
    },
    {
      name: 'title',
      class: 'String',
      expression: function(capability) {
        if ( ! capability || ! capability.name ) return '';
        return capability.name;
      }
    },
    {
      name: 'isAvailablePromise',
      factory: () => Promise.resolve(),
      hidden: true
    },
    {
      name: 'isAvailable',
      class: 'Boolean',
      value: true,
      postSet: function (ol, nu) {
        if ( ! this.saveOnAvailable ) return;
        if ( nu ) this.isAvailablePromise =
          this.isAvailablePromise.then(() => this.save());
        else this.isAvailablePromise =
          this.isAvailablePromise.then(() => this.cancel());
      }
    },
    {
      name: 'saveOnAvailable',
      class: 'Boolean',
      // TODO: Not sure why this defaults to true, this is never the behaviour we want
      // Look into it and probably disable
      value: true
    },
    {
      name: 'saveOnCurrent',
      class: 'Boolean'
    },
    {
      name: 'isCurrent',
      class: 'Boolean'
    },
    {
      name: 'wao',
      hidden: true,
      factory: function () {
        return this.ProxyWAO.create({}, this.__context__);
      }
    },
    {
      name: 'indicator',
      expression: function (status) {
        if (
          status == this.CapabilityJunctionStatus.GRANTED ||
          status == this.CapabilityJunctionStatus.PENDING ||
          status == this.CapabilityJunctionStatus.GRACE_PERIOD
        ) {
          return this.WizardletIndicator.COMPLETED;
        }
        return this.WizardletIndicator.PLEASE_FILL;
      }
    },
    {
      class: 'Boolean',
      name: 'isLoaded',
      documentation: `
        True if CapabilityJunctionData is loaded - currently used only in Capable
      `
    }
  ],
  methods: [
    async function willRender() {
      if ( this.saveOnCurrent ) {
        await this.save();
      }
    },
    async function save(options) {
      let ret = await this.SUPER(options);
      if ( this.goNextOnGranted && this.status == 'GRANTED' ) {
        this.__context__.wizardController?.goNext();
        // Make itself invisible when granted in this case so that back actions work as expected in the wizard
        this.isVisible = false;
      }
      return ret;
    },
  ]
});
