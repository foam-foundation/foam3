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
    to eval_ as typed, the result is the block's name and answer or its error, a proposed
    script waits for the user, and CommandChat sends each result back until the model answers.
    With a predicate, only one call of a matching command with JSON data runs.
  `,

  requires: [
    'foam.ai.llm.LLMResponse',
    'foam.ai.llm.LLMOptions',
    'foam.ai.llm.LLMToolUse',
    'foam.core.reflow.ai.CommandChat',
    'foam.core.reflow.ai.CommandTool',
    'foam.core.reflow.cmd.Command',
    'foam.dao.ArrayDAO'
  ],

  implements: [ 'foam.mlang.Expressions' ],

  methods: [
    {
      name: 'runTest',
      code: async function(x) {
        // A stand-in for the Console's eval_: records each script and returns the block it would make.
        var typed = [];
        var block = (name, answer, error) => ({ flowName: name, error: error, answer: async () => answer });
        var blocks = {
          'h1(title1.title + " Part 2")': block('h1', 'Sales Part 2'),
          'block.shown = false':          block('a', ''),
          'nosuch()':                     block('error', '', 'nosuch is not defined'),
          'big()':                        block('big', 'x'.repeat(5000))
        };
        var decision;
        var proposal = { flowName: 'propose', answer: () => decision };
        var evalX = x.createSubContext({ eval_: async function(script, ignoreSelect, ignoreHistory, flowParent) {
          typed.push({ script: script, flowParent: flowParent, ignoreHistory: ignoreHistory });
          return script.startsWith('propose ') ? proposal : blocks[script];
        } });
        var reply = (name, response) => JSON.stringify({ blockName: name, response: response });

        var tool = this.CommandTool.create(null, evalX);
        var def  = tool.tool();
        x.test(def.name === 'execute_command' && JSON.parse(def.inputSchema).required[0] === 'script', 'one tool, execute_command, whose input is a script');
        x.test(def.inputSchema.indexOf('\\"') < 0, 'the schema has no escaped quote, which fails on the server');

        var call = (t, script) => t.run(this.LLMToolUse.create({ id: 'c', name: 'execute_command', inputJson: JSON.stringify({ script: script }) }));
        x.test(await call(tool, 'h1(title1.title + " Part 2")') === reply('h1', 'Sales Part 2'), 'JavaScript runs as typed and the block\'s name and answer come back');
        x.test(typed[0].script === 'h1(title1.title + " Part 2")' && typed[0].flowParent === undefined, 'the script reaches eval_ unchanged, into the flow');
        x.test(typed[0].ignoreHistory === false, 'a script run into the flow goes into the prompt\'s history, like a typed one');
        x.test(await call(tool, 'block.shown = false') === reply('a', ''), 'a block that shows nothing comes back with its name');
        x.test(await call(tool, 'nosuch()') === reply('error', 'Error: nosuch is not defined'), 'an error comes back as the response');
        var big = JSON.parse(await call(tool, 'big()')).response;
        x.test(big.length < 4100 && big.endsWith('(cut)'), 'a large response is cut: ' + big.length);
        var long = JSON.parse(await call(this.CommandTool.create({ maxResult: 6000 }, evalX), 'big()')).response;
        x.test(long.length === 5000, 'a larger maxResult sends the whole response back');
        x.test(await tool.run(this.LLMToolUse.create({ name: 'eval', inputJson: '{}' })) === 'There is no tool named eval.', 'another tool name is refused');
        x.test(await tool.run(this.LLMToolUse.create({ name: 'execute_command', inputJson: 'not json' })) === 'The input was not JSON.', 'unreadable input is refused');
        x.test(await tool.run(this.LLMToolUse.create({ name: 'execute_command', inputJson: '{}' })) === 'The input has no script.', 'input with no script is refused');

        // A proposal answers once the user decides (Propose.answer), so the tool waits for it.
        var parent = {};
        var proposing = this.CommandTool.create({ prefix: 'propose ', flowParent: parent }, evalX);
        var decide;
        decision = new Promise(r => decide = r);
        var pending = call(proposing, 'h1("Done")');
        decide('Done');
        x.test(await pending === reply('propose', 'Done'), 'a proposed script returns what the accepted command shows');
        x.test(typed[typed.length - 1].script === 'propose h1("Done")' && typed[typed.length - 1].flowParent === parent, 'the prefix and flowParent are passed to eval_');
        x.test(typed[typed.length - 1].ignoreHistory === true, 'a proposed script stays out of the history until the user accepts it');

        // A block under a childTransient parent is never drawn: its value is the answer.
        var hidden = { childTransient: true };
        var hiddenX = x.createSubContext({ eval_: async function() { return { flowName: 'a', flowParent: hidden, value: foam.lang.StringHolder.create({ value: 'Started.' }), answer: () => { throw 'not drawn'; } }; } });
        x.test(await call(this.CommandTool.create({ flowParent: hidden }, hiddenX), 'report_load()') === reply('a', 'Started.'), 'a hidden block answers with what its script returned');

        // A predicate lets through only one call of a matching command with JSON data,
        // so text the model read in a file cannot make it run anything else.
        var cmdX = evalX.createSubContext({ commandDAO: this.ArrayDAO.create({ of: this.Command, array: [
          this.Command.create({ id: 'doc_readLines' }), this.Command.create({ id: 'report_load' }) ] }) });
        var limited = this.CommandTool.create({ predicate: this.STARTS_WITH(this.Command.ID, 'doc_') }, cmdX);
        blocks['doc_readLines({"from": 1})'] = block('a', 'line 1');
        x.test(await call(limited, 'doc_readLines({"from": 1})') === reply('a', 'line 1'), 'a matching command with JSON data runs');
        var ran = typed.length;
        x.test(( await call(limited, 'doc_readLines({ from: 1 })') ).startsWith('The argument of doc_readLines must be JSON'), 'an argument that is not JSON data is refused');
        x.test(( await call(limited, 'doc_readLines({"from": 1}); fetch("x")') ).startsWith('The argument of'), 'a second statement after the call is refused');
        x.test(await call(limited, 'report_load()') === 'There is no command named report_load here.', 'a command outside the predicate is refused');
        x.test(( await call(limited, 'h1("x")') ) === 'There is no command named h1 here.', 'a script that is not a listed command is refused');
        x.test(typed.length === ran, 'nothing refused reaches eval_');

        // commandX: the scripts run under a hidden block in that context.
        var screenX = x.createSubContext({ screen: 'upload' });
        var hiddenTool = this.CommandTool.create({ commandX: screenX }, evalX);
        await call(hiddenTool, 'nosuch()');
        var parentUsed = typed[typed.length - 1].flowParent;
        x.test(parentUsed && parentUsed.childTransient && parentUsed.__context__.screen === 'upload', 'commandX gives a hidden block in that context');
        x.test(typed[typed.length - 1].ignoreHistory === true, 'a script run under a hidden block stays out of the prompt\'s history');

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
        x.test(sent.result === reply('h1', 'Sales Part 2'), 'the script\'s result goes back on the second call');
      }
    }
  ]
});
