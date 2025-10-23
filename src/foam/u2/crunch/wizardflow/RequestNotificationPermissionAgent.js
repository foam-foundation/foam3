/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.crunch.wizardflow',
  name: 'RequestNotificationPermissionAgent',
  implements: [ 'foam.lang.ContextAgent' ],
  documentation: `
    Requests user for push notification permissions based on a predicate. Does nothing if already granted on device.
  `,

  imports: [
    'pushRegistryAgent',
    'wizardController?',
    'currentMenu',
    'checkGeneralCapability',
    'logAnalyticEvent?'
  ],

  messages: [
    { name: 'NOTIFICATION_PROMPT_TITLE', message: 'Register for Notifications!' }
  ],

  exports: ['logAnalytics'],

  requires: [
    'foam.u2.dialog.StyledModal'
  ],

  constants: [
    {
      name: 'LAST_SHOWN_TIME',
      value: 'notification-shownTimestamp'
    }
  ],

  classes: [
    {
      name: 'RequestPermissionView',
      extends: 'foam.u2.View',
      imports: ['pushRegistryAgent'],
      messages: [
        { name: 'PERMISSION_REASON', message: 'We use your on device notifications to improve the overall experience by allowing us to update you about your transaction status, latest rates & exciting promotions. Please click the button below to allow notifications to receive these updates. You can also enable notifications later from settings. ' }
      ],
      css: `
        ^ {
          color: $textSecondary;
          display: flex;
          flex-direction: column;
          gap: 2.4rem;
        }
        ^buttons {
          display: flex;
          flex-direction: column;
          gap: 1.2rem;
          width: 100%;
        }
      `,
      
      properties: [
        {
          class: 'String',
          name: 'prefix'
        }
      ],
      methods: [
        function render() {
          this
          .addClass('p-md', this.myClass())
          .start().add(this.prefix).end()
          .start().add(this.PERMISSION_REASON).end()
          .startContext({ controllerMode: 'EDIT', data: this })
            .start()
              .addClass(this.myClass('buttons'))
              .tag(this.ALLOW_NOTIFICATIONS)
              .tag(this.NOT_NOW)
              .tag(this.DONT_SHOW_AGAIN)
            .end()
          .endContext();
        }
      ],
      actions: [
        {
          name: 'allowNotifications',
          buttonStyle: 'PRIMARY',
          code: async function(X) {
            X.closeDialog();
            await X.pushRegistryAgent.requestNotificationPermission();
            X.logAnalytics('ALLOW');
          }
        },
        {
          name: 'notNow',
          buttonStyle: 'TEXT',
          code: function(X) {
            X.logAnalytics('NOT_NOW');
            X.closeDialog();
          }
        },
        {
          name: 'dontShowAgain',
          buttonStyle: 'TEXT',
          code: function(X) {
            X.logAnalytics('DONT_SHOW_AGAIN');
            localStorage.setItem('refusedNotification', true);
            X.closeDialog();
          }
        }
      ]
    }
  ],

  css: `
    ^ .foam-u2-dialog-StyledModal-modal-body {
      color: $textSecondary;
      display: flex;
      flex-direction: column;
      gap: 2.4rem;
    }
  `,

  properties: [
    {
      class: 'String',
      name: 'title',
      factory: function() {
        return this.NOTIFICATION_PROMPT_TITLE;
      }
    },
    {
      class: 'String',
      name: 'desc',
      documentation: 'Useful for displaying context about why this agent got executed (eg. due to sign up/completing a flow)'
    },
    'popup',
    {
      class: 'Boolean',
      name: 'affectUserChecks',
      description: 'If set to false, all user checks are ignored',
      value: true
    }
  ],

  methods: [
    async function execute(x) {
      // If the wizard didnt complete, return
      if ( this.wizardController && this.wizardController.status != 'COMPLETED' ) return;

      if ( await this.checkGeneralCapability(true) ) return;

      // If this agent ever needs to enable or disable this behaviour for the user it should start using a capability to render this view, but for now, this is per device so it doesnt
      let currentState = await this.pushRegistryAgent.currentState.promise;
      let systemCheck = currentState != 'DEFAULT' || ! this.pushRegistryAgent.supportsNotifications;
      let userCheck = this.affectUserChecks && localStorage.getItem('refusedNotification');
      if ( systemCheck || userCheck ) return;

      // Using timestamps as it allows us to set this to an interval later if we need to
      this.affectUserChecks && localStorage.setItem(this.LAST_SHOWN_TIME, Date.now());

      this.popup = this.StyledModal.create({ title$: this.title$, closeable: false }).tag(this.RequestPermissionView, { prefix$: this.desc$ });
      this.popup.open();

      return;
    },
    async function logAnalytics(result) {
      this.logAnalyticEvent({
        name: `NOTIFICATION_PERMISSION_${result}`,
        extra: foam.json.stringify({
          fromMenu: this.currentMenu.id
        })
      });
    }
  ]
});
