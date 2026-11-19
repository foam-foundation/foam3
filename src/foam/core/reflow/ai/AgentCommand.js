/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * AgentCommand: the LLM works the flow through the Reflow prompt.
 *
 * Flow:
 *   1. User types:  agent "show me overdue invoices and chart them by age"
 *   2. AgentCommand sends the request with the system prompt (the Markdown
 *      blocks of the flows named systemPrompt...) and one tool,
 *      execute_command, whose input is a script typed at the prompt.
 *   3. The model calls it as often as it needs, e.g.
 *        dao query invoiceDAO where status = 'OVERDUE' to table
 *        h1(title1.title + " Part 2"); block.shown = false
 *      Each script runs through eval_, as if the user had typed it, and the
 *      block it made, or its error, goes back to the model.
 *   4. The model's last reply, if it has text, is shown as Markdown.
 *
 * The LLM is just another user of the environment.
 * Permissions, validation, journaling — all inherited.
 */

foam.CLASS({
  package: 'foam.core.reflow.ai',
  name: 'AgentCommand',
  extends: 'foam.core.reflow.cmd.Command',

  documentation: `
    REFLOW command that delegates to an LLM, which works the flow
    through one tool, execute_command: each call is a script run at
    the Reflow prompt, a command or JavaScript, and its block is added
    to the current flow.

    Text the LLM answers with at the end is shown as Markdown.

    Because 'agent' is itself a command, agents can delegate
    to other agents: router → specialist, cheap triage → expensive.
  `,

  imports: [
    'block',
    'commandDAO',
    'flowDAO',
    'llmService',
    'subject'
  ],

  implements: [
    'foam.mlang.Expressions'
  ],

  requires: [
    'foam.ai.llm.LLMOptions',
    'foam.core.reflow.Flow',
    'foam.core.reflow.Markdown',
    'foam.core.reflow.ai.CommandChat',
    'foam.core.reflow.ai.CommandTool'
  ],

  properties: [
    {
      class: 'String',
      name: 'systemPrompt'
    },
    {
      class: 'String',
      name: 'description',
      value: 'Agent runs FLOW commands from a request'
    },
    {
      class: 'String',
      name: 'model',
      documentation: 'Optional model override.'
    },
    {
      class: 'Boolean',
      name: 'dryRun',
      documentation: 'If true, each script is proposed and runs only when the user accepts it.',
      value: true
    }
  ],

  methods: [
    async function execute(q) {
      var answer;
      try {
        answer = await this.CommandChat.create({
          options: this.LLMOptions.create({
            systemPrompt: await this.buildSystemPrompt_(),
            model:        this.model
          }),
          tool: this.CommandTool.create({ prefix: this.dryRun ? 'propose ' : '' }, this)
        }, this).ask(foam.String.isInstance(q) ? q : JSON.stringify(q));
      } catch (e) {
        throw 'LLM error: ' + e;
      }

      if ( answer ) {
        this.out.tag(this.Markdown, { markdown: answer });
        return;
      }

      // Nothing to say, so delete this block: it was just a prompt, not a block
      setTimeout(() => this.block.del(), 100);
    },

    async function buildSystemPrompt_() {
      if ( ! this.systemPrompt ) {
        const prompts = (await this.flowDAO.orderBy(this.Flow.NAME).where(this.STARTS_WITH(this.Flow.NAME, 'systemPrompt')).select()).array;
        const parts   = [];

        prompts.forEach(p => {
          const script = JSON.parse(p.script);
          script.forEach(block => {
            if ( block?.value?.class == 'foam.core.reflow.Markdown' ) {
              parts.push(block.value.markdown);
            } else {
            }
          });
        });

        // console.log('sysPrompt: ', parts.join('\n'));

        this.systemPrompt = parts.join('\n');
      }

      return this.systemPrompt;
    }
  ]
});
