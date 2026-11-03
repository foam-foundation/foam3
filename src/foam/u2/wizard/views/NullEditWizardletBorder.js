/**
 * @license
 * Copyright 2023 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.wizard.views',
  name: 'NullEditWizardletBorder',
  extends: 'foam.u2.View',
  documentation: 'Border for wizardlets that the user is not allowed to edit',

  imports: ['wizardlet'],

  exports: ['controllerMode'],

  requires: [
    'foam.u2.ControllerMode',
    'foam.u2.borders.CardBorder'
  ],

  messages: [
    { name: 'INSTRUCTION', message: 'This information can not be edited through the UI. Please contact support in order to update this information'}
  ],
  
  css: `
    << {
     display: flex;
     flex-direction: column;
     gap: 0.8rem;
    }
    << .foam-u2-borders-CardBorder {
      padding: 24px 32px;
    }
  `,

  properties:[
    {
      name: 'title',
      class: 'String',
      expression: function(wizardlet) {
        return wizardlet?.capability.editBehaviour.title ||  wizardlet?.title
      }
    },
    {
      name: 'controllerMode',
      value: foam.u2.ControllerMode.VIEW
    }
  ], 
  
  methods: [
    function init() {

      // set in init as factories are lazy
      this.wizardlet.loadEvent.sub(() => {
        this.oldData = this.wizardlet.data.clone()
      })

      this
        .addClass()
          .start().addClass('h500', this.myClass('wizard-heading')).add(this.title).end()
          .start().addClass('p').add(this.INSTRUCTION).end()
          .start(this.CardBorder).addClass(this.myClass('card'))
            .tag('div', null, this.content$)
          .end()
    }
  ]
  });
    