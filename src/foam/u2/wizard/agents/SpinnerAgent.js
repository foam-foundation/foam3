/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.wizard.agents',
  name: 'SpinnerAgent',
  documentation: `
    Displays and exports a loading spinner to prevent a user from reloading the
    page when data is still being saved after the wizard closes.
  `,

  implements: [
    'foam.lang.ContextAgent'
  ],

  imports: [
    'ctrl'
  ],

  exports: [
    'as spinnerAgent'
  ],

  requires: [
    'foam.u2.LoadingSpinner',
    'foam.u2.dialog.Popup'
  ],
  properties: [
    {
      name: 'pushLast',
      class: 'Boolean'
    }
  ],
  methods: [
    async function execute() {
      var popup = this.Popup.create({
        closeable: false,
        onClose: this.pushLast ? () => {
          ctrl.__subContext__.pushMenu(ctrl.__subContext__.lastMenuLaunched);
        } : undefined
      })
        .start(foam.u2.borders.SpacingBorder, { padding: '2rem' })
          .tag(this.LoadingSpinner, { size: 48 })
        .end();
      popup.open();
      this.onDetach(popup.close.bind(popup));
    }
  ]
});

foam.CLASS({
  package: 'foam.u2.wizard.agents',
  name: 'DetachSpinnerAgent',
  flags: ['web'],
  documentation: `
    Removes a loading spinner created by SpinnerAgent.
  `,

  imports: [
    'spinnerAgent?'
  ],

  implements: [
    'foam.lang.ContextAgent'
  ],

  methods: [
    async function execute() {
      this.spinnerAgent && this.spinnerAgent.detach();
    }
  ]
});
