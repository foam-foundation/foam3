/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.control',
  name: 'LLMControl',
  extends: 'foam.u2.Controller',

  documentation: `
    Chat-style prompt for users who only talk to the agent. Whatever is typed
    is sent as an 'agent' command, so the console behaves like a conventional
    LLM chat window. With Dry Run ticked the agent only proposes the
    commands it generates, without running them.
  `,

  imports: [ 'eval_' ],

  messages: [
    { name: 'DRY_RUN_LABEL', message: 'Dry Run' },
    { name: 'ASK',           message: 'Ask the agent...' },
    { name: 'THINKING',      message: 'Thinking...' }
  ],

  css: `
    << {
      align-items: center;
      display: flex;
      flex-direction: row;
      gap: 8px;
      padding-right: 8px;
      width: 100%;
    }
    <<input input {
      border-radius: 24px !important;
      padding-left: 10px;
    }
    <<input {
      border: none;
      padding-left: 0;
      padding-right: 0;
      width: 100%;
    }
    <<dryRun {
      display: flex;
      align-items: center;
      gap: 4px;
      white-space: nowrap;
    }
  `,

  properties: [
    'data',
    {
      class: 'String',
      name: 'text',
      onKey: true
    },
    {
      class: 'Boolean',
      name: 'dryRun'
    },
    {
      class: 'String',
      name: 'status',
      factory: function() { return this.ASK; }
    }
  ],

  methods: [
    function render() {
      this.addClass()
        // Hand the field to the Console as input_, so its ctrl-` shortcut and
        // click-to-focus (Console focusInput / onClick) focus this prompt.
        .start(this.TEXT, { placeholder$: this.status$, autofocus: true }, this.data.input_$)
          .addClass(this.myClass('input'))
          .on('keydown', this.onKeyDown)
        .end()
        .start()
          .addClass(this.myClass('dryRun'))
          .add(this.DRY_RUN, this.DRY_RUN_LABEL)
        .end();
      //        .add(this.SUBMIT.clone().copyFrom({ toolTip: this.SUBMIT.label, label: '' })) // Leave, might want to use later
    }
  ],

  actions: [
    {
      name: 'submit',
      // themeIcon: 'sendHorizontal', // Leave, might want to use later
      code: async function() {
        let prompt = this.text.trim();
        this.text = '';

        if ( ! prompt ) return;

        this.status = this.THINKING;
        try {
          await this.eval_(`agent(${JSON.stringify(prompt)}, ${this.dryRun})`);
        } finally {
          this.status = this.ASK;
        }
      }
    }
  ],

  listeners: [
    function onKeyDown(e) {
      if ( e.key === 'Enter' ) {
        e.stopPropagation();
        e.preventDefault();
        this.submit();
      }
    }
  ]
});
