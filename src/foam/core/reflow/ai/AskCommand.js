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

  properties: [
    { name: 'reply_', transient: true, hidden: true }
  ],

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

      // The answer goes back to the agent that wrote this ask, as what this
      // ask block answers (Block.answer). Starting a new agent(...) with it
      // instead lost the asking agent's preview mode and model, and the old
      // agent then ran the lines it wrote before it saw the answer.
      this.reply_ = { asked: cmd, blockName: block.flowName, response: answer };
      this.addValue(this, true);

      // The ask block goes too, not only the block it asked. Kept, a saved
      // flow would run "ask info" again on every load.
      setTimeout(() => { block.del(); this.block.del(); }, 100);
    },

    function answer() {
      return this.reply_;
    }
  ]
});
