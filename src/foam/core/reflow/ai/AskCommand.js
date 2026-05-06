/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.ai',
  name: 'AskCommand',
  extends: 'foam.core.reflow.cmd.Command',

  imports: [ 'eval_', 'currentBlock' ],

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
      await this.eval_(cmd);
      // Give command time to finish, TODO: make commands return promises
      await foam.async.sleep(1300)();

      const block    = this.currentBlock;
      const response = block.childNodes[1].element_.innerText; //innerHTML;

      console.log(`ASK: ${cmd} -> ${response}`);
      const reply = JSON.stringify({asked: cmd, response: response});
      await this.eval_(`agent(${reply})`);

      setTimeout(() => block.del(), 100);
    }
  ]
});
