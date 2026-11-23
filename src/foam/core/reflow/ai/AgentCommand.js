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
 *   4. AgentCommand inserts each line into the current flow
 *      document, where they execute in sequence.
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
    'llmService'
  ],

  implements: [
    'foam.mlang.Expressions'
  ],

  requires: [
    'foam.core.reflow.BadBlock',
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
      documentation: 'If true, show generated commands without executing.',
      value: true
    },
    {
      class: 'Int',
      name: 'maxRetries',
      documentation: `How many replies in a row may have a line that fails. Each Syntax
        Error goes back to the agent for another reply; a model that keeps
        writing the same bad line would otherwise call itself without end.`,
      value: 3
    }
  ],

  messages: [
    { name: 'TOO_MANY_RETRIES', message: 'I stopped after ${n} replies in a row had a line that failed. Try asking again with more detail.', template: true }
  ],

  methods: [
    async function execute(q) {
      // ── 1. Build the system prompt with environment context ──
      var systemPrompt = await this.buildSystemPrompt_();

      // ── 2. Call LLMService ──
      var request = foam.ai.llm.CompletionRequest.create({
        prompt: foam.String.isInstance(q) ? q : JSON.stringify(q),
        options: foam.ai.llm.LLMOptions.create({
          systemPrompt: systemPrompt,
          model:        this.model
        })
      });

      var result;
      try {
        result = await this.llmService.complete(this.__subContext__, request);
      } catch (e) {
        throw 'LLM error: ' + e;
      }

      // ── 3. Parse response into command lines ──
      var lines = this.parseCommandLines_(result.content);

      // A reply with no command line, such as one made only of '# ...' lines,
      // still reaches the user as a markdown block of its own. Drawn inside
      // this block instead, it would keep the block, and a saved flow would
      // send the same prompt again on every load.
      if ( ! lines.length && result.content ) {
        await this.eval_(`markdown(${JSON.stringify(result.content)})`, true, true);
      }

      // ── 4. Insert commands into the flow ──
      for ( var i = 0 ; i < lines.length ; i++ ) {
        if ( lines[i].trim() != '' ) {
          // An ask sends its answer to an agent. Name this one, unless it is
          // the plain agent, so a preview's follow-up is proposed too: "ask info"
          // from ? becomes "ask @? info".
          var line  = this.id === 'agent' ? lines[i] : lines[i].replace(/^ask\s+/, 'ask @' + this.id + ' ');
          var block = await this.eval_((this.dryRun ? 'propose ' : '') + line, true, true);

          if ( this.BadBlock.isInstance(block.value) ) {
            const retry = this.retryOf_(q) + 1;
            if ( retry > this.maxRetries ) {
              await this.eval_(`markdown(${JSON.stringify(this.TOO_MANY_RETRIES({ n: this.maxRetries }))})`, true, true);
              break;
            }
            const reply = JSON.stringify({ message: 'Syntax Error', cmd: lines[i], error: block.value.error, retry: retry });
            await this.eval_(`${this.id} ${reply}`, true, true);
          } else {
            // Run the agent's lines the way loading a saved flow runs its
            // blocks (Console.includeScript): wait on each block's onLoad. So
            // after input('Delete order 1234?', ['Yes', 'No']) the agent's
            // next line waits until the user has answered.
            await block?.value?.onLoad?.();
          }
        }
      }

      // -- 5. Delete this block, since it was just a prompt, not a block
      setTimeout(() => this.block.del(), 100);
    },

    function retryOf_(q) {
      // How many Syntax Error replies in a row led to this request: 2 when q is
      // '{"message":"Syntax Error",...,"retry":2}', 0 for a user's request.
      try {
        return ( foam.String.isInstance(q) ? JSON.parse(q) : q ).retry || 0;
      } catch (x) {
        return 0;
      }
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
            }
          });
        });

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
