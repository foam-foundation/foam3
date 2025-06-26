/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2',
  name: 'DAOChoicesListView',
  extends: 'foam.u2.TextField',

  documentation: `An Input view that provides a dropdown list of all served DAOs and flowChildren if any available.
  The dropdown list gets filtered as user inputs their query.
  For flowChildren,
  - all flow-DAOs would be shown irrespective of whether that flow was declared before or after the current selected block,
  - current selected flowChild is not shown in list of dropdowns.`,

  imports: [
    'cSpecDAO',
    'selected',
    'flowChildren'
  ],

  properties: [
    'of',
    {
      name: 'choices',
      factory: function() {
        return [ 'placeholder' ];
      }
    },
    [ 'size', 45 ]
  ],

  methods: [
    function render() {
      this.SUPER();

      var flowChoices = [];
      var daoChoices  = [];

      this.flowChildren.forEach( child => {
          child.value?.cls_ && child.value.cls_.getAxiomsByClass(foam.dao.DAOProperty).forEach( prop => flowChoices.push(child.flowName + '.' + prop.name) )
      })

      var allDAOs = this.cSpecDAO.where(foam.core.boot.CSpec.SERVED_DAOS)

      allDAOs.select().then(sink => {
        sink.array.forEach( d => {
          daoChoices.push( d.name );
        });

        if ( flowChoices.length > 0 ) {
          var currentSelectedRemovedArray = Array.from(flowChoices).filter( e => {
            const dotIndex = e.indexOf(".");
            if ( dotIndex === -1 ) return true;
            return e.substring(0, dotIndex) !== this.selected?.flowName; // e.g. extracts 'match1' from 'match1.data1' to check with current selected flowName
          })
          this.choices = [ ...currentSelectedRemovedArray, ...daoChoices ];
        }
      });
    }
  ]
});
