/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.ai',
  name: 'LLMCommand',
  extends: 'foam.core.reflow.cmd.Command',

  documentation: 'REFLOW command: prompt the LLMService and display results as markdown.',

  requires: [
    'foam.core.ai.CompletionRequest',
    'foam.core.ai.LLMOptions',
    'foam.core.reflow.Markdown'
  ],

  imports: [
    'llmService',
    'notify'
  ],

  properties: [
    /*
    {
      class: 'String',
      name: 'prompt',
      view: { class: 'foam.u2.tag.TextArea', rows: 4, cols: 80 },
      required: true
      },
      */
    {
      class: 'String',
      name: 'systemPrompt',
      view: { class: 'foam.u2.tag.TextArea', rows: 2, cols: 80 }
    },
    {
      class: 'String',
      name: 'model',
      documentation: 'Optional model override. Leave blank for provider default.'
    },
    /*
    {
      class: 'String',
      name: 'response',
      view: { class: 'foam.u2.MarkdownView' },
      visibility: 'RO'
      }
      */
  ],

  methods: [
    async function execute(q) {
      try {
        var options = this.LLMOptions.create({
          systemPrompt: this.systemPrompt,
          model:        this.model
        });

        var request = this.CompletionRequest.create({
          prompt:  q,
          options: options
        });

        debugger;
        var result = await this.llmService.complete(null, request);

        debugger;
        this.out.tag(this.Markdown, {markdown: result.content});
      } catch (e) {
        this.notify('LLM error: ' + e.message, '', this.LogLevel.ERROR);
        //        this.response = '**Error:** ' + e.message;
        this.out.add('**Error:** ' + e.message);
      }
    }
  ]
});
