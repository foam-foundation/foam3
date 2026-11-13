/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ticket',
  name: 'TicketNotificationNotificationCitationView',
  extends: 'foam.core.notification.NotificationCitationView',

  requires: [
    'foam.u2.ControllerMode'
  ],

  css: `
    <<{
      padding: 4px 0 0 0;
    }
  `,

  methods: [
    function render() {
      var args = this.data.emailArgs;
      this
        .addClass()
        .startContext({ controllerMode: this.ControllerMode.VIEW })
        .start()
          .start().addClass('p-legal-light', this.myClass('created'))
            .add(this.created)
          .end()
          .start().addClass('p', this.myClass('title'))
            .add(args["toastMessage"])
          .end()
        .endContext()
    }
  ]
});

foam.CLASS({
  package: 'foam.core.ticket',
  name: 'TicketNotificationNotificationMessageModal',
  extends: 'foam.core.notification.NotificationMessageModal',

  properties: [
    {
      class: 'String',
      name: 'title',
      expression: function(data$emailArgs) {
        var args = data$emailArgs;
        if ( args["toastMessage"] )
          return args["toastMessage"] +
          ( args["toastSubMessage"] ? "\n" + args["toastSubMessage"] : "" );
      }
    }
  ],

  css: `
    << {
      max-width: initial;
      max-height: 80vh;
      min-width: auto;
      overflow: auto;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
    }
    <<link {
      margin-top: 8px;
      margin-bottom: 8px;
      align-self: flex-end;
    }
  `,

  methods: [
    function render() {
      var args = this.data.emailArgs;
      this
      .addClass()
      .start(this.Rows)
        .addClass(this.myClass('container'))
        .start().addClass('p-bold').add(this.CREATED_MSG).end()
        .start().add(this.created).end()
      .end()
      .start(this.Rows)
        .addClass(this.myClass('container'))
        .start().addClass('p-bold').add(this.MESSAGE_MSG).end()
        .start().addClass(this.myClass('message')).add(this.title$).end()
        .start().addClass(this.myClass('message')).add(this.description$).end()
      .end()
      .startContext({data: this})
      .start(this.GO_TO_TICKET) 
        .addClass(this.myClass('link'))
      .end()
      .endContext();
    }
  ],

  actions: [
    {
      name: 'goToTicket',
      label: 'Go to Ticket',
      buttonStyle: 'TEXT',
      size: 'SMALL',
      code: async function(X) {
        var args = this.data.emailArgs;

        const url = new URL(window.location.href);
        X.window.history.pushState({}, '', url);
        X.window.params = undefined;

        X.routeTo(args["menu"]);

        X.popup.close();
      }
    }
  ]
});
