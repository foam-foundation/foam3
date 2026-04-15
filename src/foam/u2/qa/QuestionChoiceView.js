/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.qa',
  name: 'QuestionChoiceView',
  extends: 'foam.u2.View',

  css: `
    ^ .foam-u2-view-RadioView span {
      text-wrap: auto;
    }
  `,

  properties: [
    {
      class: 'String',
      name: 'data',
    },
    {
      class: 'String',
      name: 'prompt',
    },
    {
      class: 'Array',
      name: 'choices'
    },
    {
      class: 'String',
      name: 'placeholder'
    }
  ],

  methods: [
    function render() {
      this.SUPER();
      var self = this;
      let viewSpec = this.choices.length > 2 ? { class: 'foam.u2.view.ChoiceView', placeholder$: this.placeholder$ } : { class: 'foam.u2.view.RadioView', isHorizontal: false };
      viewSpec.choices = this.choices;
      this.startContext({ data: this })
      this.start(this.DATA.__, { config: { label: '', view: viewSpec } }).addClass(this.myClass()).end();
    },
    function fromProperty(property) {
      this.prompt = property.label;
      this.SUPER(property);
    }
  ],
  listeners: [
    {
      name: 'onChoiceChange',
      on: ['this.propertyChange.selectedChoice'],
      code: function() {
        this.data = this.selectedChoice;
      }
    }
  ]
});
