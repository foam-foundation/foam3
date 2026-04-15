/**
 * PAYTIC CONFIDENTIAL
 *
 * [2026] Paytic Inc.
 * All Rights Reserved.
 *
 * NOTICE:  All information contained herein is, and remains
 * the property of Paytic Inc.
 * The intellectual and technical concepts contained
 * herein are proprietary to Paytic Inc
 * and may be covered by Canadian and Foreign Patents, patents
 * in process, and are protected by trade secret or copyright law.
 * Dissemination of this information or reproduction of this material
 * is strictly forbidden unless prior written permission is obtained
 * from Paytic Inc.
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
