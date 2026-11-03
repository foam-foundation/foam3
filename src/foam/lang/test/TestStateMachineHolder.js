/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.lang.test',
  name: 'TestStateMachineHolder',

  properties: [
    { class: 'Long', name: 'id' },
    {
      class: 'StateMachine',
      of: 'foam.lang.test.TestStateMachine',
      name: 'status',
      factory: function() { return foam.lang.test.TestStateMachine.NEW; }
    },
    { class: 'Boolean', name: 'allowGuarded' }
  ]
});
