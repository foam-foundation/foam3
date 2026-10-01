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
  package: 'foam.core.license',
  name: 'LicenseAlertNotificationCitationView',
  extends: 'foam.core.notification.NotificationCitationView',

  requires: [
    'foam.u2.ControllerMode'
  ],

  css: `
    ^{
      padding: 4px 0 0 0;
    }
  `,

  messages: [
    { name: 'LICENSE_ALERT_MSG', message: ' · License Alert / ' }
  ],

  methods: [
    function render() {
      this
        .addClass()
        .startContext({ controllerMode: this.ControllerMode.VIEW })
        .start()
          .start().addClass('p-legal-light', this.myClass('created'))
            .add(this.data.clientName)
            .add(this.LICENSE_ALERT_MSG)
            .add(this.created)
          .end()
          .start().addClass('p', this.myClass('title'))
            .add(this.data.toastMessage)
          .end()
        .endContext()
    }
  ]
});

foam.CLASS({
  package: 'foam.core.license',
  name: 'LicenseAlertNotificationMessageModal',
  extends: 'foam.core.notification.NotificationMessageModal',

  requires: [ 'foam.u2.HTMLView' ],

  messages: [
    {
      name: 'CLIENT_MSG',
      message: 'Client'
    },
    {
      name: 'LICENSE_MSG',
      messageMap: {
        en: 'License name',
        fr: 'Nom de la licence'
      }
    }
  ],

  css: `
    ^ {
      max-width: initial;
      max-height: 80vh;
      min-width: auto;
      overflow: auto;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
    }
    ^link {
      margin-top: 8px;
      margin-bottom: 8px;
      align-self: flex-end;
    }
  `,

  methods: [
    function render() {
      this
        .addClass()
        .start(this.Rows)
          .addClass(this.myClass('container'))
            .start().addClass('p-bold').add(this.CREATED_MSG).end()
            .start().add(this.created).end()
        .end()
        .start(this.Rows)
          .addClass(this.myClass('container'))
            .start().addClass('p-bold').add(this.CLIENT_MSG).end()
            .start().add(this.data.clientName).end()
        .end()
        .start(this.Rows)
          .addClass(this.myClass('container'))
            .start().addClass('p-bold').add(this.LICENSE_MSG).end()
            .start().add(this.data.licenseName).end()
        .end()
        .start(this.Rows)
          .addClass(this.myClass('container'))
            .start().addClass('p-bold').add(this.MESSAGE_MSG).end()
            .start(this.HTMLView, { data$: this.description$ }).addClass(this.myClass('message')).end()
        .end()
        .startContext({data: this})
          .start(this.GO_TO_LICENSE) // Link to the License
            .addClass(this.myClass('link'))
        .end()
      .endContext();
    }
  ],

  actions: [
    {
      name: 'goToLicense',
      label: 'Go to License',
      buttonStyle: 'TEXT',
      size: 'SMALL',
      code: async function(X) {
        // Create a url to the License
        const url = new URL(window.location.href);
        X.window.history.pushState({}, '', url);
        X.window.params = undefined;

        // Go to the License's entry in the Menu
        X.routeTo('#licenses/%7B%22daoKey%22%3D%22' + this.data.daoKey + '%22%2C%22spid%22%3D%22' + this.data.spid + '%22%7D?mode=VIEW');

        // Close the modal
        X.popup.close();
      }
    }
  ]
});