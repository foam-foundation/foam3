/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'DynamicReflowHelp',
  extends: 'foam.u2.View',

  constants: {
    COMMANDS: [
      {
        command: 'ESC',
        description: 'Toggle Propmt Display'
      },
      {
        command: 'Up',
        description: 'Previous from History'
      },
      {
        command: 'Down',
        description: 'Next from History'
      },
      {
        command: 'CMD + K / CTRL + K',
        description: 'Clear Flow'
      },
      {
        command: 'CTRL + `',
        description: 'Focus Input'
      }
    ]
  },

  css: `
    ^container {
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-height: 400px;
      overflow-y: auto;
    }
    ^header {
      padding: 10px;
      border-bottom: 1px solid $grey200;
      font-size: 14px;
      font-weight: bold;
    }
    ^command-container {
      padding: 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      font-size: 14px;
      cursor: pointer;
    }
    ^command-container:hover {
      background-color: $grey50;
    }
  `,

  properties: [],

  methods: [
    async function render() {

      var self = this;
      this.addClass()
        .start().addClass(this.myClass('container'))
          .start().addClass(this.myClass('header'))
            .add('Shortcuts')
          .end()

          .forEach(this.COMMANDS, function(command) {
            this.start().addClass(self.myClass('command-container'))
              .start('span')
                .add(command.command)
              .end()
              .start('span')
                .add(command.description)
              .end()
            .end()
          })
        
        .end();
    }
  ],

});