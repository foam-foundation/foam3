/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.dialog',
  name: 'DialogActionsView',
  extends: 'foam.u2.View',

  css: `
    <<actions {
      display: flex;
      flex-direction: column;
      gap: 0.8rem;
      margin: 0;
    }
    <<actions > * {
      flex-grow: 1;
      margin-left: 0 !important;
    }
  `,

  properties: [
    {
      class: 'FObjectArray',
      of: 'foam.u2.ActionReference',
      name: 'data'
    }
  ],

  methods: [
    function render() {
      const self = this;
      this
        .add(this.slot(function ( data ) {
          if ( ! data || data.length === 0 ) return this.E();

          // Ensure actions are sorted by button type
          data.sort((a, b) => {
            let buttonStyleA = a.action.buttonStyle;
            let buttonStyleB = b.action.buttonStyle;

            // Adapt strings to enum values
            if ( typeof buttonStyleA === 'string' ) {
              buttonStyleA = foam.u2.ButtonStyle[buttonStyleA];
            }
            if ( typeof buttonStyleB === 'string' ) {
              buttonStyleB = foam.u2.ButtonStyle[buttonStyleB];
            }

            return buttonStyleA.ordinal - buttonStyleB.ordinal;
          });

          let slots = [];
          data.forEach(a => {
            slots.push(a.action.createIsAvailable$(self.__subContext__, a.data));
          });
          let s = foam.lang.ArraySlot.create({ slots: slots }, self);
          let anyAvailable = this.slot(function(slots) {
            for ( let slot of slots ) {
              if ( slot ) return true;
            }
            return false;
          }, s);

          return this.E()
            .enableClass(self.myClass('actions'), anyAvailable)
            .forEach(data, function( actionRef ) {
              this.start(actionRef.action, {
                size: 'LARGE',
                data$: actionRef.data$
              }).end();
            });
        }));
    }
  ]
});