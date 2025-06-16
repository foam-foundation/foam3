/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'CommandItemView',
  extends: 'foam.u2.View',

  css: `
    ^command-item {
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-inline: 5px;
      height: 40px;
    }
    ^command-item:hover {
      background-color: $grey50;
    }
    ^ .foam-u2-ActionView-addComponent {
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      display: none !important;
    }
    ^command-item:hover .foam-u2-ActionView-addComponent{
      display: inline-flex !important;
    }
  `,

  properties: [
    {
      class: 'String',
      name: 'description'
    },
    {
      class: 'String',
      name: 'command'
    },
  ],

  methods: [
    async function render() {
      var self = this;
      this.addClass();
      this.start().addClass(self.myClass('command-item'))
        .add(this.description)
        .startContext({ data: self })
          .tag(self.ADD_COMPONENT)
        .endContext()
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
        this.data.eval_(this.command)
      }
    }
  ]
});