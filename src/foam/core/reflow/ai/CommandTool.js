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
    to the model is the value of the block the script made, or its error.

      var tool = CommandTool.create(null, x);   // x is a Console's context, holding eval_
      request.tools = [ tool.tool() ];
      use.result    = await tool.run(use);      // for each LLMToolUse in the reply
  `,

  requires: [
    'foam.ai.llm.LLMTool'
  ],

  imports: [ 'eval_' ],

  constants: [
    { name: 'TOOL_NAME', value: 'execute_command' },
    {
      name: 'MAX_RESULT',
      documentation: 'The most characters of one result sent back, so a script that prints a large table does not fill the conversation.',
      value: 4000
    }
  ],

  properties: [
    {
      class: 'String',
      name: 'prefix',
      documentation: 'Put before every script, e.g. "propose " so the user accepts each block before it runs.'
    },
    {
      name: 'flowParent',
      documentation: 'The block the scripts\' blocks are added under; empty adds them to the flow, where the user sees them.'
    }
  ],

  methods: [
    function tool() {
      return this.LLMTool.create({
        name: this.TOOL_NAME,
        description: 'Run a script at the Reflow prompt, as the user would type it: a command, or JavaScript that reads and changes the flow\'s blocks by name. Returns the value of the block it made, or its error.',
        inputSchema: JSON.stringify({
          type: 'object',
          properties: {
            script: { type: 'string', description: 'What to type at the prompt, e.g. h1(title1.title + " Part 2")' }
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

      var block = await this.eval_(this.prefix + input.script, true, true, this.flowParent || undefined);
      if ( ! block ) return 'Done.';
      if ( block.error ) return 'Error: ' + block.error;
      // Wait as loading a saved flow does (Console.includeScript), so after
      // input('Delete order 1234?', ['Yes', 'No']) the answer is in the result.
      await block.value?.onLoad?.();
      // A proposed script (prefix "propose ") runs only when the user accepts it.
      if ( block.value?.decided ) {
        block = await block.value.decided;
        if ( ! block ) return 'The user rejected it, so it did not run.';
        if ( block.error ) return 'Error: ' + block.error;
      }
      return this.resultText_(block);
    },

    function resultText_(block) {
      var v = block.value;
      var text = v === undefined || v === null ? '' :
        v.cls_ && v.cls_.getAxiomByName('value') ? String(v.value) :
        foam.lang.FObject.isInstance(v) ? v.cls_.id :
        foam.json.stringify(v);
      text = block.flowName + ( text ? ': ' + text : '' );
      return text.length > this.MAX_RESULT ? text.substring(0, this.MAX_RESULT) + ' ... (cut)' : text;
    }
  ]
});
