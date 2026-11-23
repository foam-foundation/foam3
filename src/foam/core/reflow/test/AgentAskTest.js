/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.test',
  name: 'AgentAskTest',
  extends: 'foam.core.test.JSTest',

  documentation: `
    An ask sends its answer to an agent as a new request. It goes to the agent
    that asked, so a preview (?) stays a preview, and a line that keeps failing
    stops after maxRetries replies.
  `,

  requires: [
    'foam.core.reflow.BadBlock',
    'foam.core.reflow.ai.AgentCommand',
    'foam.core.reflow.ai.AskCommand'
  ],

  methods: [
    {
      name: 'runTest',
      code: async function(x) {
        var self  = this;
        var typed = [];
        var ctx   = x.createSubContext({
          block:      { del: function() {} },
          llmService: { complete: async function() { return { content: self.reply_ }; } },
          eval_:      async function(script) {
            typed.push(script);
            if ( script === 'nonsense(((' || script === 'propose nonsense(((' ) return { value: self.BadBlock.create({ error: 'Unexpected end of input' }) };
            return { flowName: 'info1', answer: async () => 'answer of ' + script, del: function() {} };
          }
        });
        var agent = (id, dryRun, q) => {
          typed = [];
          return self.AgentCommand.create({ id: id, dryRun: dryRun, systemPrompt: 'test' }, ctx).execute(q || 'write a heading');
        };

        this.reply_ = 'ask info';
        await agent('?', true);
        x.test(typed.join(' | ') === 'propose ask @? info', 'the ? agent names itself on its ask');
        await agent('agent', false);
        x.test(typed.join(' | ') === 'ask info', 'the plain agent writes its ask as it is');

        typed = [];
        var ask = this.AskCommand.create(null, ctx);
        await ask.execute('@? info');
        x.test(typed[0] === 'info', 'ask runs the asked command');
        x.test(typed[1] === '? ' + JSON.stringify({ asked: 'info', blockName: 'info1', response: 'answer of info' }), 'and sends the answer to the agent that asked');

        typed = [];
        await this.AskCommand.create(null, ctx).execute('info');
        x.test(typed[1].startsWith('agent {"asked":"info"'), 'an ask with no agent named answers the plain agent');

        this.reply_ = 'nonsense(((';
        await agent('?', true);
        x.test(typed[1] === '? ' + JSON.stringify({ message: 'Syntax Error', cmd: 'nonsense(((', error: 'Unexpected end of input', retry: 1 }), 'a failed line goes back to the same agent, counted');
        await agent('?', true, typed[1].slice(2));
        x.test(typed[1].indexOf('"retry":2') > 0, 'the next failure in a row counts on');
        await agent('?', true, JSON.stringify({ message: 'Syntax Error', retry: 3 }));
        x.test(typed.length === 2 && typed[1].startsWith('markdown(') && typed[1].indexOf('3 replies') > 0, 'after maxRetries failures in a row it stops and says so');
      }
    }
  ]
});
