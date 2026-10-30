/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.ai',
  name: 'CommandTool',

  documentation: `
    Lets an AI agent run Reflow commands through one tool, execute_command, instead of a
    tool per action written into each agent. The agent's commands are the rows of
    commandDAO its predicate matches, e.g. ids starting with "report."; commandDAO only
    returns the ones the user may read (command.read.<id>), so the agent can never do
    more than its user.

    The model names a command and passes its params; run() looks the command up by id
    among those rows and executes it in commandX, the context the agent's screen gives
    its commands. The model's text is never evaluated. A command marked confirm runs
    only after askConfirm resolves true.

      var tool = CommandTool.create({ predicate: STARTS_WITH(Command.ID, 'report.'), commandX: x });
      request.tools = [ await tool.tool() ];
      use.result    = await tool.run(use);   // for each LLMToolUse in the reply
  `,

  requires: [
    'foam.ai.llm.LLMTool',
    'foam.dao.ArraySink'
  ],

  imports: [ 'commandDAO' ],

  constants: [
    { name: 'TOOL_NAME', value: 'execute_command' }
  ],

  properties: [
    {
      name: 'predicate',
      documentation: 'Which commands this agent may run.'
    },
    {
      name: 'commandX',
      documentation: 'The context a command runs in: what its script imports, such as the screen it drives.'
    },
    {
      class: 'Function',
      name: 'askConfirm',
      documentation: 'Asked before a command marked confirm runs; resolves true to run it. The default refuses.',
      value: async function(command, params) { return false; }
    },
    {
      name: 'commands_',
      documentation: 'The matching commands, read once.',
      factory: function() {
        var dao = this.predicate ? this.commandDAO.where(this.predicate) : this.commandDAO;
        return dao.select(this.ArraySink.create()).then(s => s.array);
      }
    }
  ],

  methods: [
    async function tool() {
      var commands = await this.commands_;
      var lines = commands.map(c => '- ' + c.id + ': ' + ( c.description || '' )
        + ( c.inputSchema ? ' Params: ' + c.inputSchema : ' No params.' )
        + ( c.confirm ? ' The user confirms before it runs.' : '' ));
      return this.LLMTool.create({
        name: this.TOOL_NAME,
        description: 'Run one of these commands with its params:\n' + lines.join('\n'),
        inputSchema: JSON.stringify({
          type: 'object',
          properties: {
            command: { type: 'string', enum: commands.map(c => c.id) },
            params:  { type: 'object', description: 'The command\'s params, as its Params line describes; {} when it has none.' }
          },
          required: [ 'command' ]
        })
      });
    },

    async function run(use) {
      if ( use.name !== this.TOOL_NAME ) return 'There is no tool named ' + use.name + '.';
      var input;
      try {
        input = JSON.parse(use.inputJson || '{}');
      } catch (e) {
        return 'The input was not JSON.';
      }
      var command = ( await this.commands_ ).find(c => c.id === input.command);
      if ( ! command ) return 'There is no command named ' + input.command + ' here.';
      var params = input.params || {};
      if ( command.confirm && ! await this.askConfirm(command, params) ) {
        return 'The user did not confirm ' + command.id + ', so it did not run.';
      }
      try {
        var result = await command.clone(this.commandX || this.__context__).execute(params);
        return result === undefined || result === null ? 'Done.' : String(result);
      } catch (e) {
        return command.id + ' failed: ' + ( e && e.message || e );
      }
    }
  ]
});
