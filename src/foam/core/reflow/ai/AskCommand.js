/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.ai',
  name: 'AskCommand',
  extends: 'foam.core.reflow.cmd.Command',

  imports: [ 'eval_' ],

  /*
  properties: [
    {
      class: 'String',
      name: 'agent'
      // reserved for future use
    },
    {
      class: 'String',
      name: 'command'
    }
  ],1
  */

  methods: [
    async function execute(cmd) {
      const block    = await this.eval_(cmd, true, true);
      const answer   = await block.answer();

      const reply = JSON.stringify({asked: cmd, blockName: block.flowName, response: answer});
      console.log(`AskCommand: ${reply}`);
      await this.eval_(`agent(${reply})`, false, false);

      setTimeout(() => block.del(), 100);
    }
  ]
});
