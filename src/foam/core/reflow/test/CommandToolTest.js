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
    An agent runs commands through one execute_command tool: only the commands its
    predicate matches are offered and runnable, a command gets the params the model sent
    and the agent's context, its return value is the result, and a command marked confirm
    runs only when the user agrees.
  `,

  requires: [
    'foam.ai.llm.LLMToolUse',
    'foam.core.reflow.ai.CommandTool',
    'foam.core.reflow.cmd.Command',
    'foam.dao.MDAO'
  ],

  methods: [
    {
      name: 'runTest',
      code: async function(x) {
        var dao = this.MDAO.create({ of: this.Command });
        await dao.put(this.Command.create({ id: 'demo.greet', description: 'Greet someone',
          inputSchema: '{"type":"object","properties":{"name":{"type":"string"}}}',
          script: 'return this.__context__.greeting + ", " + args[0].name;' }));
        await dao.put(this.Command.create({ id: 'demo.save', description: 'Save the data', confirm: true,
          script: 'this.__context__.saved.push(1); return "Saved.";' }));
        await dao.put(this.Command.create({ id: 'demo.silent', description: 'Return nothing', script: 'var a = 1;' }));
        await dao.put(this.Command.create({ id: 'other.drop', description: 'Drop everything', script: 'return "dropped";' }));

        var saved = [];
        var agentX = x.createSubContext({ commandDAO: dao, greeting: 'Hello', saved: saved });
        var asked = [];
        var tool = this.CommandTool.create({
          predicate: foam.mlang.Expressions.create().STARTS_WITH(this.Command.ID, 'demo.'),
          commandX: agentX,
          askConfirm: async function(c) { asked.push(c.id); return asked.length > 1; }
        }, agentX);

        var def = await tool.tool();
        var schema = JSON.parse(def.inputSchema);
        x.test(def.name === 'execute_command', 'one tool named execute_command');
        x.test(schema.properties.command.enum.sort().join() === 'demo.greet,demo.save,demo.silent',
          'only the agent\'s commands are offered: ' + schema.properties.command.enum);
        x.test(def.description.indexOf('demo.greet: Greet someone Params: {"type"') >= 0, 'each command is described with its params');
        x.test(def.description.indexOf('demo.save: Save the data No params. The user confirms before it runs.') >= 0, 'a confirm command says so');

        var call = (command, params) => tool.run(this.LLMToolUse.create({ id: 'c', name: 'execute_command', inputJson: JSON.stringify({ command: command, params: params }) }));
        x.test(await call('demo.greet', { name: 'Ada' }) === 'Hello, Ada', 'the command gets the params and the agent\'s context');
        x.test(await call('demo.silent') === 'Done.', 'a command that returns nothing reads as Done.');
        x.test(( await call('other.drop') ).indexOf('There is no command named other.drop') === 0, 'a command outside the agent\'s set is refused');
        x.test(( await call('demo.save') ).indexOf('did not confirm') >= 0 && saved.length === 0, 'a confirm command does not run when the user says no');
        x.test(await call('demo.save') === 'Saved.' && saved.length === 1, 'it runs once the user agrees');
        x.test(( await tool.run(this.LLMToolUse.create({ name: 'eval', inputJson: '{}' })) ).indexOf('There is no tool named eval') === 0, 'another tool name is refused');
        x.test(await tool.run(this.LLMToolUse.create({ name: 'execute_command', inputJson: 'not json' })) === 'The input was not JSON.', 'unreadable input is refused');
      }
    }
  ]
});
