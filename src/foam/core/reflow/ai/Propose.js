/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.ai',
  name: 'Propose',
  extends: 'foam.u2.Controller',

  imports: [ 'eval_', 'block' ],

  css: `
    << {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      border-left: 3px solid $borderBrand;
      background: $backgroundTertiary;
      border-radius: 0 6px 6px 0;
      margin: 4px 0;
      font-family: monospace;
    }
    <<command {
      flex: 1;
    }
    <<command input {
      width: 100%;
      border: 1px solid $borderLight;
      border-radius: 4px;
      padding: 4px 8px;
      font-family: monospace;
      font-size: 13px;
      background: $backgroundDefault;
      outline: none;
    }
    <<command input:focus {
      border-color: $borderBrand;
    }
    <<btn {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      font-weight: bold;
      transition: background 0.15s, transform 0.1s;
    }
    <<btn:hover {
      transform: scale(1.1);
    }
    <<accept {
      background: $success50;
      color: $success700;
    }
    <<accept:hover {
      background: $success50;
    }
    <<reject {
      background: $destructive50;
      color: $destructive700;
    }
    <<reject:hover {
      background: $destructive50;
    }
  `,

  properties: [
    {
      class: 'String',
      name: 'command'
    },
    {
      name: 'decided_',
      transient: true,
      hidden: true,
      factory: function() { return foam.lang.Latch.create(); }
    }
  ],

  methods: [
    function answer() {
      // An agent that proposes a command waits here, so it sees what the command
      // did, or that the user rejected it, before its next step.
      return this.decided_;
    },

    function render() {
      this.addClass().
        start('span').addClass(this.myClass('command')).add(this.COMMAND).end().
        start(this.ACCEPT).
          addClass(this.myClass('btn')).
          addClass(this.myClass('accept')).
        end().
        start(this.REJECT).
          addClass(this.myClass('btn')).
          addClass(this.myClass('reject')).
        end();
    }
  ],

  actions: [
    {
      name: 'accept',
      label: '✓',
      code: async function() {
        var made = await this.eval_(this.command);
        this.block.del();
        this.decided_.resolve(made.error ? 'Error: ' + made.error : await made.answer());
      }
    },
    {
      name: 'reject',
      label: '✕',
      code: function() {
        this.block.del();
        this.decided_.resolve('The user rejected it, so it did not run.');
      }
    }
  ]
});
