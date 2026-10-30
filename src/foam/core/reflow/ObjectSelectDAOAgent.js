/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'ObjectSelectDAOAgent',
  extends: 'foam.core.reflow.AbstractDAOAgent',
  documentation: 'Allows selecting an object from a dao that can then be accessed using selectedObj',

  imports: [ 'sinkDAO as limitedDAO', 'block'],

  exports: ['as data'],
  properties: [
    {
      name: 'selectedObj',
      transient: true
    }
  ],
  methods: [
    function value(s) {
      return this.selectedObj;
    },
    function execute(e) {
      if ( this.block.value && this.block.value.VALUE ) {
        this.onDetach(this.block.value.value$.follow(this.selectedObj$));
      } else {
        this.onDetach(this.block.value$.follow(this.selectedObj$));
      }
      e.tag(foam.u2.view.RichChoiceReferenceView, {
        placeholder: '--',
        fullObject_$: this.selectedObj$,
        sections: [
          {
            name: 'Objects',
            dao$: this.limitedDAO$
          }
        ]
      });
    }
  ]
});
