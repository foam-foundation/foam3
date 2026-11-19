/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.test',
  name: 'CommandToolTest',
  extends: 'foam.core.test.JSTest',

  documentation: `
    An agent has the Reflow prompt as one execute_command tool: the model's script goes
    to eval_ as typed, the result is the block's value or error, a proposed script waits
    for the user, and CommandChat sends each result back until the model answers.
  `,

  requires: [
    'foam.ai.llm.LLMResponse',
    'foam.ai.llm.LLMOptions',
    'foam.ai.llm.LLMToolUse',
    'foam.core.reflow.ai.CommandChat',
    'foam.core.reflow.ai.CommandTool'
  ],

  methods: [
    {
      name: 'runTest',
      code: async function(x) {
        // A stand-in for the Console's eval_: records each script and returns the block it would make.
        var typed = [];
        var blocks = {
          'h1(title1.title + " Part 2")': { flowName: 'h1', value: foam.lang.StringHolder.create({ value: 'Sales Part 2' }) },
          'block.shown = false':          { flowName: 'a' },
          'nosuch()':                     { flowName: 'error', error: 'nosuch is not defined' },
          'big()':                        { flowName: 'big', value: foam.lang.StringHolder.create({ value: 'x'.repeat(5000) }) }
        };
        var proposal = { flowName: 'propose', value: { decided: foam.lang.Latch.create() } };
        var evalX = x.createSubContext({ eval_: async function(script, ignoreSelect, ignoreHistory, flowParent) {
          typed.push({ script: script, flowParent: flowParent });
          return script.startsWith('propose ') ? proposal : blocks[script];
        } });

        var tool = this.CommandTool.create(null, evalX);
        var def  = tool.tool();
        x.test(def.name === 'execute_command' && JSON.parse(def.inputSchema).required[0] === 'script', 'one tool, execute_command, whose input is a script');

        var call = (t, script) => t.run(this.LLMToolUse.create({ id: 'c', name: 'execute_command', inputJson: JSON.stringify({ script: script }) }));
        x.test(await call(tool, 'h1(title1.title + " Part 2")') === 'h1: Sales Part 2', 'JavaScript runs as typed and its block\'s value comes back');
        x.test(typed[0].script === 'h1(title1.title + " Part 2")' && typed[0].flowParent === undefined, 'the script reaches eval_ unchanged, into the flow');
        x.test(await call(tool, 'block.shown = false') === 'a', 'a script whose block has no value comes back as the block\'s name');
        x.test(await call(tool, 'nosuch()') === 'Error: nosuch is not defined', 'an error comes back as the result');
        var big = await call(tool, 'big()');
        x.test(big.length < 4100 && big.endsWith('(cut)'), 'a large result is cut: ' + big.length);
        x.test(await tool.run(this.LLMToolUse.create({ name: 'eval', inputJson: '{}' })) === 'There is no tool named eval.', 'another tool name is refused');
        x.test(await tool.run(this.LLMToolUse.create({ name: 'execute_command', inputJson: 'not json' })) === 'The input was not JSON.', 'unreadable input is refused');
        x.test(await tool.run(this.LLMToolUse.create({ name: 'execute_command', inputJson: '{}' })) === 'The input has no script.', 'input with no script is refused');

        var parent = {};
        var proposing = this.CommandTool.create({ prefix: 'propose ', flowParent: parent }, evalX);
        var pending = call(proposing, 'h1("Done")');
        proposal.value.decided.resolve(blocks['h1(title1.title + " Part 2")']);
        x.test(await pending === 'h1: Sales Part 2', 'a proposed script returns the block the accepted command made');
        x.test(typed[typed.length - 1].script === 'propose h1("Done")' && typed[typed.length - 1].flowParent === parent, 'the prefix and flowParent are passed to eval_');
        proposal.value.decided = foam.lang.Latch.create();
        pending = call(proposing, 'h1("No")');
        proposal.value.decided.resolve(null);
        x.test(await pending === 'The user rejected it, so it did not run.', 'a rejected proposal says so');

        // CommandChat: the model runs one script, sees its result, then answers.
        var requests = [];
        var replies = [
          this.LLMResponse.create({ toolUses: [ this.LLMToolUse.create({ id: 't1', name: 'execute_command', inputJson: '{"script":"h1(title1.title + \\" Part 2\\")"}' }) ] }),
          this.LLMResponse.create({ content: 'Added the heading.' })
        ];
        var chatX = evalX.createSubContext({ llmService: { chat: async function(cx, request) { requests.push(request); return replies[requests.length - 1]; } } });
        var answer = await this.CommandChat.create({ options: this.LLMOptions.create({ systemPrompt: 'You work a flow.' }) }, chatX).ask('Add a part 2 heading');
        x.test(answer === 'Added the heading.', 'the model\'s last text is the answer');
        x.test(requests.length === 2 && requests[0].options.tools[0].name === 'execute_command', 'the tool is offered on every call');
        var sent = requests[1].messages[1].toolUses[0];
        x.test(sent.result === 'h1: Sales Part 2', 'the script\'s result goes back on the second call');
      }
    }
  ]
});
