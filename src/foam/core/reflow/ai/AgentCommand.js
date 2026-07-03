/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * AgentCommand: The LLM doesn't return markdown — it returns REFLOW commands.
 *
 * Flow:
 *   1. User types:  agent "show me overdue invoices and chart them by age"
 *   2. AgentCommand builds a system prompt containing:
 *      - Available commands (from commandDAO)
 *      - Available DAOs and their models (from context)
 *      - The user's prompt
 *   3. LLMService returns a string of REFLOW commands, e.g.:
 *        dao query invoiceDAO where status = 'OVERDUE' to table
 *        chart bar --x daysOverdue --y amount --title "Overdue by Age" // TODO: fix
 *   4. PromptCommand parses each line and inserts them into the
 *      current flow document, where they execute in sequence.
 *
 * The LLM is just another user of the environment.
 * Permissions, validation, journaling — all inherited.
 */

foam.CLASS({
  package: 'foam.core.reflow.ai',
  name: 'AgentCommand',
  extends: 'foam.core.reflow.cmd.Command',

  documentation: `
    REFLOW command that delegates to an LLM, which responds with
    REFLOW commands rather than markdown. The commands are parsed
    and inserted into the current flow for execution.

    If the LLM wants to respond conversationally, it uses the
    markdown command — text is just one capability among many.

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
    'foam.core.reflow.Flow',
    'foam.core.reflow.Markdown'
  ],

  properties: [
    {
      class: 'String',
      name: 'systemPrompt'
    },
    {
      class: 'String',
      name: 'description',
      value: 'Ask an LLM agent to generate REFLOW commands from a natural language instruction.'
    },
    {
      class: 'String',
      name: 'model',
      documentation: 'Optional model override.'
    },
    {
      class: 'Boolean',
      name: 'dryRun',
      documentation: 'If true, show generated commands without executing.',
      value: true
    }
  ],

  methods: [
    async function execute(q) {
      // ── 1. Build the system prompt with environment context ──
      var systemPrompt = await this.buildSystemPrompt_();

      // ── 2. Call LLMService ──
      var request = foam.core.ai.CompletionRequest.create({
        prompt: foam.String.isInstance(q) ? q : JSON.stringify(q),
        options: foam.core.ai.LLMOptions.create({
          systemPrompt: systemPrompt,
          model:        this.model,
          temperature:  0.2  // low temp for structured command output
        })
      });

      var result;
      try {
        result = await this.llmService.complete(x, request);
        // Use when offline. TODO: make a mock llmService for when offline
        // result = { content: 'h1 done' };
      } catch (e) {
        throw 'LLM error: ' + e;
//        flow.insertError('LLM error: ' + e.message);
        return;
      }

      // ── 3. Parse response into command lines ──
      var lines = this.parseCommandLines_(result.content);

      if ( ! lines.length ) {
        // LLM returned nothing parseable — show raw as markdown fallback
        this.out.tag(this.Markdown, {markdown: result.content});
        return;
      }

      // ── 4. Insert commands into the flow ──
      for ( var i = 0 ; i < lines.length ; i++ ) {
        if ( lines[i].trim() != '' )
          await this.eval_((this.dryRun ? 'propose ' : '') + lines[i]);
      }

      // -- 5. Delete this block, since it was just a prompt, not a block
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

        console.log('sysPrompt: ', parts.join('\n'));

        this.systemPrompt = parts.join('\n');
      }

      return this.systemPrompt;
    },

    function parseCommandLines_(content) {
      if ( ! content ) return [];

      // Strip code fences if LLM wrapped them despite instructions
      content = content.replace(/^```[\w]*\n?/gm, '').replace(/^```$/gm, '');

      return content
        .split('\n')
        .map(l => l.trim())
        .filter(l => l && ! l.startsWith('//') && ! l.startsWith('#'));
    }
  ]
});
