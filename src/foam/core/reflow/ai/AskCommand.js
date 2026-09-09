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
      const block = await this.eval_(cmd);

      // eval_ awaits the command, but a block that renders from a DAO select
      // finishes after that: an agent has no signal to wait on, so this waits
      // out the render. Remove it once agents report when their output settles.
      await foam.async.sleep(1300)();

      const response = block.content?.element_?.innerText || '';

      const reply = JSON.stringify({asked: cmd, response: response});
      await this.eval_(`agent(${reply})`);

      setTimeout(() => block.del(), 100);
    }
  ]
});
