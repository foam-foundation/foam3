/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.notification',
  name: 'NotificationWidget',
  extends: 'foam.u2.View',

  imports: [
    'pushMenu',
    'pushRegistryAgent'
  ],

  requires: ['foam.u2.crunch.wizardflow.RequestNotificationPermissionAgent'],

  css: `
    << {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      height: 100%;
      gap: 1rem;
    }
    <<text-container {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    <<button-container {
      width: fit-content;
    }
  `,

  messages: [
    { name: 'TITLE', message: 'Stay up to date' },
    { name: 'TEXT', message: 'We use on device notifications update you.' },
  ],

  methods: [
    function render() {
      this.start().addClass(this.myClass())
        .start().addClass(this.myClass('text-container'))
          .start().addClass('h400')
              .add(this.TITLE)
          .end()
          .add(this.TEXT)
        .end()
        
        .start(this.ENABLE_NOTIF, { buttonStyle: 'PRIMARY' }).addClass(this.myClass('button-container'))
            .addClass(this.myClass('button'))
        .end()
      .end();
    }
  ],

  actions: [
    {
      name: 'enableNotif',
      label: 'Enable Notifications',
      code: async function(X) {
        foam.u2.crunch.wizardflow.RequestNotificationPermissionAgent.create({ affectUserChecks: false }, X).execute();
        X.pushRegistryAgent.currentState$.sub(async () => {
          await X.pushRegistryAgent.currentState.promise
          X.pushMenu(X.currentMenu.id, true)
        })
      }
    }
  ]
});

