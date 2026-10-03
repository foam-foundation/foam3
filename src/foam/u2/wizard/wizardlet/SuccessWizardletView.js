/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.wizard.wizardlet',
  name: 'SuccessWizardletView',
  extends: 'foam.u2.View',

  axioms: [foam.pattern.Faceted.create()],

  imports: ['wizardlet'],
  css: `
    << {
      text-align: center;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      margin: 2rem 0;
      gap: 2rem;
    }
    <<image img{
      width: 8rem;
    }
  `,

  properties: [
    {
      class: 'String',
      name: 'message',
      expression: function(wizardlet$message) {
        return wizardlet$message || 'Success!';
      }
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'logoSpec',
      value: {
        class: 'foam.u2.tag.Image',
        data: '/images/checkmark-outline-green.svg'
      }
    }
  ],

  methods: [
    function render() {
      let self = this;
      this
        .addClass(this.myClass())
        .startContext({ data: this })
          .add(this.slot(function(logoSpec) {
            return this.E().style({ display: 'contents' })
              .start(logoSpec)
                .addClass(self.myClass('image'))
              .end();
          }))
        .endContext()
        .start()
          .addClass('h300')
          .add(this.message$)
        .end();
    }
  ]
});
