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
      name: 'maxTurns',
      documentation: `The most replies one request may take. Each answer to an ask and each
        failed line costs one more reply; a model that keeps writing the same bad
        line would otherwise call itself without end.`,
      value: 10
    }
  ],

  messages: [
    { name: 'TOO_MANY_TURNS', message: 'I stopped after ${n} replies without finishing. Try asking again with more detail.', template: true }
  ],

  methods: [
    async function execute(q) {
      var systemPrompt = await this.buildSystemPrompt_();

      // One conversation, one turn at a time. A reply that asks for results,
      // or has a line that fails, gets its answer as the next turn of this
      // same loop, so the follow-up keeps this agent's dryRun and model. A
      // nested agent(...) call per answer used to resume the old reply after
      // the follow-up: in "ask info" then h1("Stale"), the stale heading was
      // drawn after the agent's real answer.
      var prompt = foam.String.isInstance(q) ? q : JSON.stringify(q);
      for ( var turn = 1 ; prompt ; turn++ ) {
        if ( turn > this.maxTurns ) {
          await this.eval_(`markdown(${JSON.stringify(this.TOO_MANY_TURNS({ n: this.maxTurns }))})`, true, true);
          break;
        }

        var result;
        try {
          result = await this.llmService.complete(this.__subContext__, foam.ai.llm.CompletionRequest.create({
            prompt:  prompt,
            options: foam.ai.llm.LLMOptions.create({ systemPrompt: systemPrompt, model: this.model })
          }));
        } catch (e) {
          throw 'LLM error: ' + e;
        }

        prompt = await this.runReply_(result.content);
      }

      // Delete this block, since it was just a prompt, not a block
      setTimeout(() => this.block.del(), 100);
    },

    // Runs one reply and returns what goes back to the model: the answers to
    // its asks, or the line that failed. Empty when the reply is done.
    async function runReply_(content) {
      var lines = this.parseCommandLines_(content);

      // A reply with no command line, such as one made only of '# ...' lines,
      // still reaches the user as a markdown block of its own. Drawn inside
      // this block instead, it would keep the block, and a saved flow would
      // send the same prompt again on every load.
      if ( ! lines.length && content ) {
        await this.eval_(`markdown(${JSON.stringify(content)})`, true, true);
        return '';
      }

      var answers = [];
      for ( var i = 0 ; i < lines.length ; i++ ) {
        const ask = lines[i].match(/^ask\s+(.*)$/);

        // The agent wrote the lines after its asks before it saw the answers,
        // so they wait: it writes them again in its next reply, knowing the
        // results. The asks right after one another still run together, so
        // "ask info" then "ask FROM commandDAO ..." costs one turn, not two.
        if ( answers.length && ! ask ) break;

        const cmd   = ask ? ask[1] : lines[i];
        const block = await this.eval_((this.dryRun ? 'propose ' : '') + cmd, true, true);

        if ( this.BadBlock.isInstance(block.value) ) {
          return JSON.stringify({ message: 'Syntax Error', cmd: lines[i], error: block.value.error });
        }

        if ( ask ) {
          // In a preview the asked command is proposed, and its answer waits
          // until the user accepts or rejects it (Propose.answer).
          answers.push({ asked: cmd, blockName: block.flowName, response: await block.answer() });
          // The asked block goes once answered: kept, a saved flow would run
          // it again on every load. A proposal removes itself when the user
          // decides.
          if ( ! this.dryRun ) setTimeout(() => block.del(), 100);
        } else {
          // Run the agent's lines the way loading a saved flow runs its
          // blocks (Console.includeScript): wait on each block's onLoad. So
          // after input('Delete order 1234?', ['Yes', 'No']) the agent's
          // next line waits until the user has answered.
          await block?.value?.onLoad?.();
        }
      }

      if ( ! answers.length ) return '';
      return JSON.stringify(answers.length === 1 ? answers[0] : answers);
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
