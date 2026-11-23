/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.test',
  name: 'AgentTurnLoopTest',
  extends: 'foam.core.test.JSTest',

  documentation: `
    The agent talks to the model one turn at a time, in one loop. The answers to a
    reply's asks, or the line that failed, go back as the next turn of the same agent,
    so a preview stays a preview, the lines written before the answers never run,
    and a model that keeps failing stops after maxTurns.
  `,

  requires: [
    'foam.core.reflow.BadBlock',
    'foam.core.reflow.ai.AgentCommand'
  ],

  methods: [
    {
      name: 'runTest',
      code: async function(x) {
        var self = this;

        // A stand-in for the model: hands out the scripted replies, records each prompt.
        var run = async function(replies, props) {
          var typed = [], prompts = [];
          var block = (name, answer) => ({ flowName: name, answer: async () => answer, del: function() {} });
          var evalX = x.createSubContext({
            block: { del: function() {} },
            llmService: { complete: async function(_, req) {
              prompts.push(req.prompt);
              return { content: replies.shift() || '' };
            } },
            eval_: async function(script) {
              typed.push(script);
              if ( script === 'nonsense(((' ) return { value: self.BadBlock.create({ error: 'Unexpected end of input' }) };
              if ( script.startsWith('propose ') ) return block('propose1', 'answer of ' + script.slice(8));
              return block(script.replace(/\W.*/, '') + '1', 'answer of ' + script);
            }
          });
          var agent = self.AgentCommand.create(Object.assign({ systemPrompt: 'test', dryRun: false }, props), evalX);
          await agent.execute('write a heading');
          return { typed: typed, prompts: prompts };
        };

        var r = await run([ 'ask info\nh1("Stale")', 'h1("Fresh")' ]);
        x.test(r.typed.join(' | ') === 'info | h1("Fresh")', 'a line after an ask does not run: the agent writes it again once it has the answer');
        x.test(r.prompts[1] === JSON.stringify({ asked: 'info', blockName: 'info1', response: 'answer of info' }), 'the answer goes back as the next turn of the same agent');

        r = await run([ 'ask info\nask daos\nh1("A")', 'h1("B")' ]);
        x.test(r.typed.join(' | ') === 'info | daos | h1("B")', 'asks in a row all run, and the line after them does not');
        x.test(r.prompts.length === 2 && JSON.parse(r.prompts[1]).length === 2, 'their two answers go back together, in one turn');

        r = await run([ 'ask info\nh1("P")', 'h1("Q")' ], { dryRun: true });
        x.test(r.typed.join(' | ') === 'propose info | propose h1("Q")', 'in a preview the follow-up is proposed too, not run');

        r = await run([ 'nonsense(((', 'h1("Fixed")' ]);
        x.test(r.typed.join(' | ') === 'nonsense((( | h1("Fixed")', 'a failed line goes back to the same agent, which writes it again');
        x.test(JSON.parse(r.prompts[1]).message === 'Syntax Error', 'the model gets the error');

        r = await run([ 'nonsense(((', 'nonsense(((', 'nonsense(((', 'nonsense(((' ], { maxTurns: 3 });
        x.test(r.prompts.length === 3, 'a model that keeps failing gets maxTurns replies, then stops');
        x.test(r.typed[r.typed.length - 1].startsWith('markdown(') && r.typed[r.typed.length - 1].indexOf('3 replies') >= 0, 'and the user is told it stopped');

        r = await run([ 'h1("Done")' ]);
        x.test(r.prompts.length === 1 && r.typed.join(' | ') === 'h1("Done")', 'a reply with no ask is one turn');
      }
    }
  ]
});
