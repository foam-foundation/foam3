/**
* @license
* Copyright 2023 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.u2.wizard.views',
  name: 'ReferenceWizardletView',
  extends: 'foam.u2.View',
  documentation: `A view for wizardlets that need to populate an object from a DAO,
                  Wraps RichChoiceView and modifies the data passed to the wizardlet to be the full object instead of the id
  `,

  requires: ['foam.u2.view.RichChoiceView'],

  properties: [
    {
      name: 'selectedID',
      factory: function() {
        if ( ! this.data ) return undefined;
        var idProp = this.viewArgs.idProperty || 'id';
        var id = this.data[idProp];
        if ( id === undefined ) {
          console.warn('ReferenceWizardletView: idProperty "' + idProp +
            '" did not resolve on ' + this.data.cls_.id + ', so no initial ' +
            'selection will be shown. Pass a bare property name (e.g. \'name\').');
        }
        return id;
      }
    },
    {
      class: 'Map',
      name: 'viewArgs',
      documentation: 'Map of arguments passed to RichChoiceView'
    },
    'prop'
  ],
  methods: [
    function render() {
      this
        .tag(this.RichChoiceView, { ...this.viewArgs, prop: this.prop, data$: this.selectedID$, fullObject_$: this.data$ })
    },

    function fromProperty(p) {
      this.prop = p;
    }
  ]
});

