/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.ai',
  name: 'CommandTool',

  documentation: `
    Gives an AI agent the Reflow prompt as one tool, execute_command. The model sends a
    script and run() evaluates it with the Console's eval_, exactly as if the user had
    typed it at the prompt: a command such as daos, or JavaScript that builds on the
    flow, such as h1(title1.title + " Part 2"); block.shown = false. The result sent back
    is what the ask command returns: the block's name and its answer, or its error.

      var tool = CommandTool.create(null, x);   // x is a Console's context, holding eval_
      request.tools = [ tool.tool() ];
      use.result    = await tool.run(use);      // for each LLMToolUse in the reply

    An agent that reads text it did not write, such as an uploaded file, sets predicate:
    a line in that file could otherwise steer the model into running any script as the user.
  `,

  requires: [
    'foam.ai.llm.LLMTool',
    'foam.core.reflow.Block'
  ],

  imports: [ 'commandDAO?', 'eval_' ],

  constants: [
    { name: 'TOOL_NAME', value: 'execute_command' }
  ],

  properties: [
    {
      class: 'String',
      name: 'prefix',
      documentation: 'Put before every script, e.g. "propose " so the user accepts each block before it runs.'
    },
    {
      class: 'Int',
      name: 'maxResult',
      value: 4000,
      documentation: `The most characters of one result sent back, so a script that prints a
        large table does not fill the conversation. Raise it for a command that returns a
        long read on purpose, such as a page of a document.`
    },
    {
      name: 'predicate',
      documentation: `Which commands the model may call. Empty, any script runs, as at the
        prompt. Set, a script must be one call of a matching command with JSON data as its
        argument, such as name({"key": "value"}), and anything else is refused.`
    },
    {
      name: 'commandX',
      documentation: `The context the scripts run in, holding what their commands read, such
        as the screen they drive. Set, the scripts run under a hidden block in it, so they
        add nothing to the flow the user sees, nor to the prompt's history. Empty, each script
        goes into the history like a typed one, so the history command lists what an agent ran.`
    },
    {
      name: 'flowParent',
      documentation: 'The block the scripts\' blocks are added under; empty adds them to the flow, where the user sees them.',
      factory: function() {
        // A childTransient block draws none of its children.
        return this.commandX ? this.Block.create({ childTransient: true }, this.commandX) : undefined;
      }
    }
  ],

  methods: [
    function tool() {
      return this.LLMTool.create({
        name: this.TOOL_NAME,
        description: 'Run a script at the Reflow prompt, as the user would type it: a command, or JavaScript that reads and changes the flow\'s blocks by name. Returns {blockName, response}: the name of the block it made and what that block shows, or its error.',
        inputSchema: JSON.stringify({
          type: 'object',
          properties: {
            // No double quotes here: the schema reaches the server as a JSON string
            // inside JSON, and an escaped quote in it fails org.json there.
            script: { type: 'string', description: "What to type at the prompt, e.g. h1(title1.title + ' Part 2')" }
          },
          required: [ 'script' ]
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
      if ( ! input || typeof input.script !== 'string' ) return 'The input has no script.';
      var refusal = this.predicate ? await this.refusal_(input.script) : '';
      if ( refusal ) return refusal;

      var block = await this.eval_(this.prefix + input.script, true, !! this.commandX, this.flowParent || undefined);
      if ( ! block ) return 'Done.';
      var response = block.error ? 'Error: ' + block.error : await this.response_(block);
      if ( typeof response === 'string' && response.length > this.maxResult ) response = response.substring(0, this.maxResult) + ' ... (cut)';
      // The same reply the ask command gives, so the model can refer back to the block by name.
      return JSON.stringify({ blockName: block.flowName, response: response });
    },

    async function refusal_(script) {
      // A script that is one call with JSON data as its argument runs nothing but
      // that command: JSON.parse accepts data only, never code.
      var call = script.trim();
      if ( call.endsWith(';') ) call = call.substring(0, call.length - 1).trim();
      var open = call.indexOf('(');
      if ( open < 0 || ! call.endsWith(')') ) return 'Send one command call, such as name({"key": "value"}).';
      var id  = call.substring(0, open).trim();
      var arg = call.substring(open + 1, call.length - 1).trim();
      if ( arg ) {
        try {
          JSON.parse(arg);
        } catch (e) {
          return 'The argument of ' + id + ' must be JSON data, with double-quoted keys and strings.';
        }
      }
      if ( ! await this.commandDAO.where(this.predicate).find(id) ) return 'There is no command named ' + id + ' here.';
      return '';
    },

    async function response_(block) {
      // A block under a childTransient parent is never drawn, so it has no text
      // to read; what its script returned is the answer.
      if ( block.flowParent?.childTransient ) return block.value?.value === undefined ? '' : String(block.value.value);
      // Block.answer waits on what the block waits on, such as the user's
      // answer to input('Delete order 1234?', ...), else returns its text.
      return block.answer();
    }
  ]
});
