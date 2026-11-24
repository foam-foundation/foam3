/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.test',
  name: 'AgentCommandInboxTestHost',

  documentation: `Stands in for the Console: exports the agentInbox that an agent
    command and the agent commands started by its lines share.`,

  exports: [ 'agentInbox' ],

  properties: [ 'agentInbox' ]
});

foam.CLASS({
  package: 'foam.core.reflow.test',
  name: 'AgentCommandInboxTest',
  extends: 'foam.core.test.JSTest',

  documentation: `An agent sends the LLM one request per turn. The answer of an ask
    and the "continue" of "! continue" in the same reply reach the LLM together,
    after the reply's last line. The inbox is cleared when a turn fails, and a
    model that never stops is stopped after maxTurns calls.`,

  requires: [
    'foam.core.reflow.ai.AgentCommand',
    'foam.core.reflow.ai.AskCommand',
    'foam.core.reflow.test.AgentCommandInboxTestHost'
  ],

  methods: [
    async function runTest(x) {
      var self = this;

      // Runs "how many users are there" against a scripted LLM. reply(prompt)
      // gives the LLM's answer to each request; prompts holds every request sent.
      var run = async function(reply, maxTurns) {
        var host    = self.AgentCommandInboxTestHost.create({}, x);
        var prompts = [];
        var cx;
        var agent   = () => self.AgentCommand.create({ dryRun: false, systemPrompt: 'test', maxTurns: maxTurns || 20 }, cx);

        cx = host.__subContext__.createSubContext({
          block:      { del: function() {} },
          commandDAO: {},
          flowDAO:    {},
          llmService: {
            complete: async function(_, req) {
              prompts.push(req.prompt);
              return { content: reply(req.prompt) };
            }
          },
          // Stands in for Console.eval_. An ask line runs the real AskCommand,
          // which sends its answer back through agent(...). "!" is the agent
          // command itself, so "! continue" sends the agent "continue".
          eval_: async function(line) {
            if ( line.startsWith('ask ') ) {
              await self.AskCommand.create({}, cx).execute(line.slice(4));
            } else if ( line.startsWith('agent(') ) {
              await agent().execute(JSON.parse(line.slice(6, -1)));
            } else if ( line === '! continue' ) {
              await agent().execute('continue');
            }
            // The block the asked query made: AskCommand reads its answer.
            return { value: {}, flowName: 'b1', answer: async () => '40 rows', del: function() {} };
          }
        });

        var error;
        try {
          await agent().execute('how many users are there');
        } catch (e) {
          error = e;
        }
        return { prompts: prompts, host: host, error: error };
      };

      // 1. The ask's answer and "continue" go to the LLM as one request.
      var r = await run(p => p == 'how many users are there' ?
        'ask FROM userDAO COLUMNS id TO CSV\n! continue' :
        'markdown("There are 40 users")');
      x.test(! r.error, 'no error');
      x.test(r.prompts.length == 2, 'two LLM calls, got ' + r.prompts.length);
      x.test(r.prompts[1] == '{"asked":"FROM userDAO COLUMNS id TO CSV","blockName":"b1","response":"40 rows"}\ncontinue',
        'second request holds the answer and "continue" together, got ' + JSON.stringify(r.prompts[1]));
      x.test(r.host.agentInbox === undefined, 'inbox cleared after the turn');

      // 2. A failed LLM call shows its message and clears the inbox.
      r = await run(() => { throw new Error('boom'); });
      x.test(r.error && r.error.message == 'LLM error: boom', 'error says "LLM error: boom", got ' + ( r.error && r.error.message ));
      x.test(r.host.agentInbox === undefined, 'inbox cleared after a failed call');

      // 3. A model that answers every reply with "! continue" stops at maxTurns.
      r = await run(() => '! continue', 3);
      x.test(r.prompts.length == 3, 'three LLM calls with maxTurns 3, got ' + r.prompts.length);
      x.test(r.error && r.error.message == 'Agent stopped after 3 LLM calls for one request.',
        'error names the limit, got ' + ( r.error && r.error.message ));
      x.test(r.host.agentInbox === undefined, 'inbox cleared after the limit');
    }
  ]
});
