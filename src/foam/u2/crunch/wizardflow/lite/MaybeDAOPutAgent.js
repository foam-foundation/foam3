/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.crunch.wizardflow',
  name: 'MaybeDAOPutAgent',
  implements: [
    'foam.lang.ContextAgent'
  ],
  documentation: `
    Perform a DAO put when Capable wizards are complete to complete the flow
    of a capability intercept.
  `,

  imports: [
    'intercept?',
    'submitted',
    'capable? as importedCapable',
  ],

  exports: [
    'capable'
  ],

  properties: [
    {
      name: 'capable',
      factory: function() {
        return this.importedCapable;
      }
    }
  ],

  methods: [
    async function execute() {
      let daoKey = this.intercept?.daoKey || this.capable?.DAOKey;
      if ( daoKey && this.submitted ) {
        try {
          let returnCapable = await this.__subContext__[daoKey].put(this.capable);
          if ( this.intercept )
            this.intercept.returnCapable = returnCapable;
          if ( this.capable ) 
            this.capable = returnCapable;
        } catch (e) {
          console.error(e);
        }
      }
      return;
    }
  ]
});
