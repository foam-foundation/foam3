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
    {
      class: 'String',
      name: 'agent',
      documentation: `The agent command the answer goes to: the one whose reply had this
        ask. A preview agent (?) writes "ask @? info", so its follow-up is
        proposed too instead of run by the plain agent.`,
      value: 'agent'
    }
  ],

  methods: [
    async function execute(cmd) {
      const to = cmd.match(/^@(\S+)\s+([\s\S]*)$/);
      if ( to ) { this.agent = to[1]; cmd = to[2]; }

      const block    = await this.eval_(cmd, true, true);
      const answer   = await block.answer();

      const reply = JSON.stringify({asked: cmd, blockName: block.flowName, response: answer});
      console.log(`AskCommand: ${reply}`);
      // "agent {...}" and "? {...}" both run as the command with the JSON as
      // its text; "?(...)" would not parse as JavaScript.
      await this.eval_(`${this.agent} ${reply}`, true, true);

      // The ask block goes too, not only the block it asked. Kept, a saved
      // flow would run "ask info" again on every load and send the answer
      // to the agent as a new request.
      setTimeout(() => { block.del(); this.block.del(); }, 100);
    }
  ]
});
