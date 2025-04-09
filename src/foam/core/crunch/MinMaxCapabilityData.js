/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.crunch',
  name: 'MinMaxCapabilityData',
  mixins: ['foam.u2.wizard.AbstractWizardletAware'],

  documentation: `
    A model for the data store on MinMaxCapability
  `,

  properties: [
    // TODO: Why isn't this working?
    ['customUpdateSlot', true],
    {
      name: 'selectedData',
      class: 'StringArray',
      javaFactory: 'return null;',
      factory: null,
      adaptArrayElement: function(o, prop) {
        if ( foam.core.crunch.Capability.isInstance(o) ) return o.id;
        return o;
      },
      postSet: function (o, n) {
        if ( ! foam.util.equals(o, n) ) {
          this.selectedDataStable = n;
          this.propertyChange.pub('selectedDataStable', this.selectedDataStable$);
        }
      }
    },
    {
      name: 'selectedDataStable',
      documentation: 'A more stable array property for wizard updates',
      class: 'StringArray',
      hidden: true
    }
  ],

  methods: [
    function init () {
      // TODO: Why is this needed?
      this.customUpdateSlot = true;
    },
    {
      name: 'getUpdateSlot',
      code: function (helpers) {
        return this.selectedDataStable$;
      }
    }
  ]
});
