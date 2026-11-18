/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.ai',
  name: 'CommandRunner',

  documentation: `
    Lets an AI agent run Reflow commands by writing them in its reply, as
    AgentCommand's agent does, with no tool registered with the model. The
    agent's commands are the rows of commandDAO its predicate matches, e.g. ids
    starting with "report."; commandDAO only returns the ones the user may read
    (command.read.<id>), so the agent can never do more than its user.

    protocol() tells the model how to call them and lists them. runReply(reply)
    reads the reply with ReplyParser and runs each command in commandX, the
    context the agent's screen gives its commands. The model's text is never
    evaluated: a command's params must be a literal. A command marked confirm
    runs only after askConfirm resolves true.

      var runner = CommandRunner.create({ predicate: STARTS_WITH(Command.ID, 'report.'), commandX: x });
      options.systemPrompt += '\\n\\n' + await runner.protocol();
      var turn = await runner.runReply(reply.content);
      // turn.said: what the model said to the user; the whole reply when it ran no command
      // turn.results: what its ask commands returned, the next user message; '' when it asked nothing

    A screen that shows the model's words before a slow command runs calls
    read(reply) first, then runCommands(read.commands).
  `,

  requires: [
    'foam.core.reflow.ai.ReplyParser',
    'foam.dao.ArraySink'
  ],

  imports: [ 'commandDAO' ],

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
    },
    {
      name: 'parser_',
      factory: function() { return this.ReplyParser.create(); }
    }
  ],

  methods: [
    async function protocol() {
      // Asked to test a long draft, the model often wrote it as a tool call (<invoke name=...>)
      // that runs nothing. Saying it has no tools, and that the ask line is how a tool is called
      // here, with a multi-line example, took that from 6 in 30 replies to 0 in 40.
      var commands = await this.commands_;
      return '## How you reply\n\n'
        + 'You cannot make tool calls. This conversation has no tools, and tool calls are not allowed: '
        + 'an <invoke> or <function_calls> block runs nothing. You run commands only by writing lines, as described here.\n\n'
        + 'Here a tool call is a line in your reply. When you want to call a tool, write `ask <command>({...})` on its own line: '
        + 'that line is the tool call, and it is the only shape that runs. The arguments are the same JSON object you would send '
        + 'to a tool, with the keys from the command\'s Call line. A long string, such as code, goes inside backticks as written '
        + 'and may span lines:\n\n'
        + 'ask <command>({code: `foam.CLASS({\n  name: \'Example\'\n})`})\n\n'
        + 'Its result comes back in the next message as agent({"asked": ..., "response": ...}).\n\n'
        + 'You have no tools. To run a command, write it in your reply on a line of its own. '
        + 'Never write a tool call such as <invoke>, <function_calls> or <parameter> tags, or a JSON call: '
        + 'they run nothing.\n\n'
        + '- `ask <command>(<params>)` runs the command, and its result comes back in the next message as '
        + 'agent({"asked": ..., "response": ...}). Use it to read or check something before you answer.\n'
        + '- `<command>(<params>)` runs the command and sends nothing back.\n'
        + '- <params> is an object literal with the keys the command\'s Call line shows: '
        + '`ask doc.readLines({doc: "file", from: 1, count: 20})`.\n'
        + '- A long string, such as code, goes inside backticks as written and may span lines, in the same '
        + 'call: ask <command>({code: `foam.CLASS({ ... })`}). Write \\` for a backtick inside it.\n'
        + '- A reply with no command is your answer, in the shape the instructions above ask for.\n\n'
        + 'Wrong: `<invoke name="<command>"><parameter name="code">...</parameter></invoke>` runs nothing. '
        + 'Right: `ask <command>({code: `...`})`.\n\n'
        + 'The commands:\n'
        + commands.map(c => '- ' + c.id + ': ' + ( c.description || '' )
          + ( c.inputSchema ? '\n  ' + this.callLine_(c) : ' No params.' )
          + ( c.confirm ? ' The user confirms before it runs.' : '' )).join('\n')
        + '\n\nWhen you run a command, you may say a brief sentence first. '
        + 'Do not include internal or system XML tags in your response.';
    },

    function callLine_(c) {
      // The call as the model writes it, such as "Call: `ask doc.readLines({doc: <string>, from: <integer>, count?: <integer>})`.
      // doc: The document's name." A JSON Schema listed as it is reads as a tool definition, and
      // the model then answered in its tool-call format instead of writing the line.
      var schema = JSON.parse(c.inputSchema);
      var keys   = Object.keys(schema.properties || {});
      var type   = k => '<' + schema.properties[k].type + '>';
      var call   = keys.map(k => k + ( ( schema.required || [] ).indexOf(k) < 0 ? '?' : '' ) + ': ' + type(k)).join(', ');
      return 'Call: `ask ' + c.id + '({' + call + '})`. '
        + keys.filter(k => schema.properties[k].description).map(k => k + ': ' + schema.properties[k].description.replace(/\.$/, '') + '.').join(' ');
    },

    async function run(id, params) {
      var command = ( await this.commands_ ).find(c => c.id === id);
      if ( ! command ) return 'There is no command named ' + id + ' here.';
      params = params || {};
      if ( command.confirm && ! await this.askConfirm(command, params) ) {
        return 'The user did not confirm ' + command.id + ', so it did not run.';
      }
      try {
        var result = await command.clone(this.commandX || this.__context__).execute(params);
        return result === undefined || result === null ? 'Done.' : String(result);
      } catch (e) {
        return command.id + ' failed: ' + ( e && e.message || e );
      }
    },

    async function read(content) {
      // { said, commands }: the text for the user, and the commands to run in
      // reply order. A reply with no command is said whole, as written.
      content   = content || '';
      var known = ( await this.commands_ ).map(c => c.id);
      var parts = this.parser_.parseString(content) || [ { text: content } ];
      // A call is a command when it is asked or names one of the agent's
      // commands; foam.CLASS({...}) on a line of an answer is text. An ask
      // that did not parse goes back as an error, so the model can fix it.
      var isCommand = p => p.error || p.command && ( p.ask || known.indexOf(p.command) >= 0 );
      var commands  = parts.filter(isCommand);
      if ( ! commands.length ) return { said: content, commands: [] };
      var said = parts.filter(p => ! isCommand(p)).map(p => ( p.command ? p.source : p.text ).trim()).filter(t => t);
      return { said: said.join('\n'), commands: commands };
    },

    async function runCommands(commands) {
      // What the asked commands returned, as the next user message; '' when none was asked
      var results = [];
      for ( var c of commands ) {
        var response = c.error || await this.run(c.command, c.params);
        if ( c.ask ) results.push('agent(' + JSON.stringify({ asked: c.source, response: response }) + ')');
      }
      return results.join('\n');
    },

    async function runReply(content) {
      var reply = await this.read(content);
      return { said: reply.said, results: await this.runCommands(reply.commands) };
    }
  ]
});
