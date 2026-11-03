/**
* @license
* Copyright 2024 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.core.notification.push',
  name: 'PushSettingNotificationSettingCitationView',
  extends: 'foam.core.notification.NotificationSettingCitationView',
  imports: ['pushRegistryAgent'],

  requires: ['foam.u2.crunch.wizardflow.RequestNotificationPermissionAgent'],

  messages: [
    { name: 'ALREADY_GRANTED', message: 'You are receiving push notifications on this device.'},
    { name: 'ALREADY_DENIED', message: 'Push Notifications have been disabled on this device, please reset your browser/app settings to enable push notifications.' },
    { name: 'INACTIVE_NOTIFICATIONS', message: 'Push Notifications are not enabled on this device. To enable push notifications, ' }
  ],
  properties: [

  ],
  css: `
    <<sub > .foam-u2-ActionView-link {
      color: currentColor;
      padding: 0;
      font-weight: $font-medium;
      text-decoration: underline;
      transition: all 0.2s ease;
    }
    <<sub > .foam-u2-ActionView-link .p {
      font-weight: $font-medium;
    }
  `,
  methods: [
    function addContent() {
      let self = this;
      this.start()
        .addClass('p', this.myClass('column'))
        .start().addClass('p-semiBold').add(this.label).end()
        .add(this.slot(async function(pushRegistryAgent$currentState) {
          let res = await pushRegistryAgent$currentState;
          let e = this.E().addClass(self.myClass('sub'));
          switch ( res ) {
            case 'DEFAULT':
              return e.add(self.INACTIVE_NOTIFICATIONS).startContext({ data: self }).tag(self.CLICK_HERE).endContext();
            case 'GRANTED':
              return e.add(self.ALREADY_GRANTED);
            case 'DENIED':
              return e.add(self.ALREADY_DENIED);
            default:
              break;
          }
        }))
      .end();
    }
  ],
  actions: [
    {
      name: 'clickHere',
      buttonStyle: 'LINK',
      code: async function(X) {
        this.RequestNotificationPermissionAgent.create({ affectUserChecks: false }, X).execute();
      }
    }
  ]
});
