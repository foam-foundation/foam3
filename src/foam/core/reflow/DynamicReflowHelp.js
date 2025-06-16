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
        type: '🧩 1. Insert Elements: Elements that users can add into the view.',
        elements: [
          'Add Object to DAO', 'Insert Checkbox', 'Insert Timestamp', 'Insert Signature', 'Insert Today’s Date', 'Insert Header', 'Insert Cells', 'Insert link', 'Insert an attachment (Image, document, etc.)'
        ],
        color: '#8638E5'
      },
      {
        type: '☑️ 2. Console Actions: for actions like “Clear console output” or “save”',
        elements: [
          'Clear output',
          'Save'
        ],
        color: '#F4BF4F'
      },
      {
        type: '🎨 3. Style & Format: Tools to visually format or stylize the report or view.',
        elements: [
          'Bold',
          'Italic',
          'Headers sizes (H1–H6)'
        ],
        color: '#8F9295'
      },
      {
        type: '📂 4. Data Operations: Actions related to adding, importing, or processing data.',
        elements: [
          'Add DAOs → Add collections',
          'Add Flows → Add views',
          'URL → Fetch a file from a URL',
          'Upload → Upload data'
        ],
        color: '#61C554'
      },
      {
        type: '⚙️ 5. Utilities: System-level or functional tools for managing or operating the view.',
        elements: [
          'Reconciliation → Reconcile two collections',
          'Services → (Decide on “Services” to show to users or remove)',
          'Script → Execute a custom script'
        ],
        color: '#FF3CE2'
      },
      {
        type: '❓ 6. Help & History: Support and guidance tools.',
        elements: [
          'Help → Display available features',
          'History → View previously executed commands',
          'Shortcuts → Keyboard or interaction shortcuts'
        ],
        color: '#38CEE5'
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
      font-size: 12px;
    }
    ^command-container {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
  `,

  properties: [],

  methods: [
    async function render() {

      var self = this;
      this.addClass()
        .start().addClass(this.myClass('container'))
          .forEach(this.COMMANDS, function(command) {
            this.start().addClass(self.myClass('command-container'))
              .add(command.type)
              .start().style({'border': `1px solid ${command.color}`})
                .start('ul')
                  .forEach(command.elements, function(element) {
                    this.start('li')
                      .add(element)
                    .end()
                  })
                .end()
              .end()
            .end();
          })
        .end();
    }
  ],

});