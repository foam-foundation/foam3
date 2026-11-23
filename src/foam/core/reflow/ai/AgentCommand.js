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

    A command can send the agent a message: ask sends its answer,
    a line that fails sends its error, '! continue' sends 'continue'.
    The agent runs every line of a reply before it reads them, then
    sends them to the LLM as one request. It stops when a reply sends
    it nothing.

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
    }
  ],

  methods: [
    async function execute(q) {
      var llm = this.llmService;
      q = foam.String.isInstance(q) ? q : JSON.stringify(q);

      // The agent takes one message at a time: it runs every line of its reply
      // before it reads the next message. A message sent to it meanwhile (an
      // ask's answer, a Syntax Error, the "continue" of "! continue") waits in
      // the conversation's inbox, and they all go to the LLM together once the
      // last line has run. Sent to the LLM at once instead, the answer of
      // "ask info" was replied to and acted on while the next line of the same
      // reply, "ask FROM commandDAO ...", had not run yet. That line then ran
      // after the agent had drawn its result, and cost one more LLM call.
      if ( llm.inbox ) {
        llm.inbox.push(q);
        setTimeout(() => this.block.del(), 100);
        return;
      }
      llm.inbox = [ q ];

      try {
        // ── 1. Build the system prompt with environment context ──
        var systemPrompt = await this.buildSystemPrompt_();

        // One LLM call per turn, until a reply sends the agent nothing more:
        // no ask, no "! continue" and no line that failed.
        while ( llm.inbox.length ) {
          // ── 2. Call LLMService ──
          var request = foam.ai.llm.CompletionRequest.create({
            prompt: llm.inbox.splice(0).join('\n'),
            options: foam.ai.llm.LLMOptions.create({
              systemPrompt: systemPrompt,
              model:        this.model
            })
          });

          var result;
          try {
            result = await llm.complete(this.__subContext__, request);
          } catch (e) {
            // An Error, not a string: Console.eval_ shows the message of what it
            // catches, and a string has none, so a failed call showed nothing.
            throw new Error('LLM error: ' + ( e.message || e ));
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
              var block = await this.eval_((this.dryRun ? 'propose ' : '') + lines[i], true, true);

              if ( this.BadBlock.isInstance(block.value) ) {
                // JSON.stringify escapes the quotes and newlines in the command
                // and error, so the agent(...) call is valid JavaScript for eval_.
                const reply = JSON.stringify({ message: 'Syntax Error', cmd: lines[i], error: block.value.error });
                await this.eval_(`agent(${reply})`, true, true);
              } else {
                // Run the agent's lines the way loading a saved flow runs its
                // blocks (Console.includeScript): wait on each block's onLoad. So
                // after input('Delete order 1234?', ['Yes', 'No']) the agent's
                // next line waits until the user has answered.
                await block?.value?.onLoad?.();
              }
            }
          }
        }
      } finally {
        // Also when a call or a line throws. Left set, the inbox would take
        // every later message for an agent that is no longer there to read it.
        llm.inbox = undefined;
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
