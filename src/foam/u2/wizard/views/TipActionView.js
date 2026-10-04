/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.wizard.views',
  name: 'TipActionView',
  extends: 'foam.u2.View',
  documentation: `
    This action view displays additional text to inform the user
  `,

  requires: [
    'foam.u2.ActionView'
  ],

  properties: [
    'action',
    {
      class: 'String',
      name: 'text'
    }
  ],

  cssTokens: [
    {
      name: 'tipActionColor',
      value: '$buttonPrimaryColor'
    },
    {
      name: 'buttonPrimaryLightColor',
      value: function(e) { return e.FROM_HUE(e.TOKEN('$tipActionColor'), 41, 90) }
    }
  ],

  css: `
    << {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-wrap: wrap;
      gap: 0.4rem;
    }
    <<helptext {
      text-align: center;
    }
    <<tipAction.foam-u2-ActionView-text{
      color: $tipActionColor;
    }
    <<tipAction.foam-u2-ActionView-text svg { fill: $tipActionColor; }

    <<tipAction.foam-u2-ActionView-text:hover:not(:disabled) {
      background-color: $buttonPrimaryLightColor;
    }

    <<tipAction.foam-u2-ActionView-text:active:not(:disabled) {
      background-color: $buttonPrimaryLightColor;
      border-color: $tipActionColor;
    }

  `,

  methods: [
    function render() {
      this
        .enableClass('foam-u2-ActionView-unavailable',
          this.action.createIsAvailable$(this.__context__, this.data), true)
        .addClass()
        .start()
          .addClass(this.myClass('helptext'))
          .add(this.text$)
        .end()
        .start(this.ActionView, {
          action: this.action,
          size: 'SMALL',
          data$: this.data$,
          buttonStyle: 'TEXT'
        })
          .addClass(this.myClass('tipAction'))
        .end();
    }
  ]
});
