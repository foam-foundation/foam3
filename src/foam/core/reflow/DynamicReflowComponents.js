/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'DynamicReflowComponents',
  extends: 'foam.u2.View',

  requires: [
    'foam.core.reflow.CommandItemView'
  ],

  imports: [
    'commandDAO'
  ],

  css: `
    ^container {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    ^command-list {
      display: flex;
      flex-direction: column;
      gap: 5px;
      max-height: 200px;
      overflow-y: auto;
      padding-top: 10px;
    }
  `,

  properties: [
    {
      class: 'String',
      name: 'filterSearch',
      placeholder: 'Search...'
    },
    {
      name: 'commands',
      value: []
    }
  ],

  methods: [
    async function render() {
      var self = this;
      const commandsSink = await this.commandDAO.select();
      this.commands = commandsSink.array;

      console.log('commands', this.commands);


      this.addClass()
        .start().addClass(this.myClass('container'))
          .tag(this.FILTER_SEARCH, { data$: this.filterSearch$ })
          .add(this.dynamic(function(filterSearch, commands) {
            var search = (filterSearch || '').toLowerCase();
            var filtered = commands.filter(c =>
              !search || (c.description && c.description.toLowerCase().includes(search))
            );
            this.start().addClass(self.myClass('command-list'))
              .forEach(filtered, function(command) {
                this.start(self.CommandItemView, { data: self.data, command: command.id, description: command.description });
              })
          }))
        .end();
    }
  ],
  actions: [
    {
      name: 'addComponent',
      label: 'Add',
      buttonStyle: foam.u2.ButtonStyle.SECONDARY,
      size: 'SMALL',
      themeIcon: 'plus',
      code: function() {
        this.data.eval_('Test')
      }
    }
  ]
});