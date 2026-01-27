/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

 foam.CLASS({
  package: 'foam.u2.wizard.data',
  name: 'ExecuteActionsSaver',
  extends: 'foam.u2.wizard.data.ProxySaver',

  documentation: `
    Used to execute specified list of actions on wizardlet data when it is saved.

    While the name suggests that this saver only executes actions, it also can execute methods
    on the data object. Note that the only argument passed to these methods is the context.
  `,

  properties: [
    {
      class: 'StringArray',
      name: 'actions'
    }
  ],

  methods: [
    async function save(data) {
      for ( var action of this.actions ) {
        try {
          await data[action]?.call(data, this.__subContext__);
        } catch(e) {
          throw e;
        }
      }
      await this.delegate.save(data);
    }
  ]
});