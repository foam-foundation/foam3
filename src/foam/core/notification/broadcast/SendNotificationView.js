/**
* @license
* Copyright 2022 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.core.notification.broadcast',
  name: 'SendNotificationView',
  extends: 'foam.u2.View',

  requires: [
    'foam.core.notification.broadcast.BroadcastNotificationFacade',
    'foam.core.notification.NotificationRowView',
    'foam.core.notification.broadcast.BroadcastNotification',
    'foam.u2.stack.BreadcrumbView',
    'foam.u2.layout.Rows',
    'foam.u2.borders.CardBorder',
    'foam.u2.detail.VerticalDetailView'
  ],
  imports: [
    'notificationDAO'
  ],
  implements: [
    'foam.mlang.Expressions'
  ],

  // Make an abstract SummaryView with this CSS and props for title and primary action,
  // everything else can be populated by the parent view, maybe a border??
  css: `
    ^ {
      padding: 32px;
    }
    ^container > * + * {
      margin-top: 32px;
    }
    ^button {
      align-self: flex-end;
    }
  `,

  properties: [
    {
      name: 'notificationType',
      class: 'Class',
      factory: function() {
        return 'foam.core.notification.broadcast.BroadcastNotificationFacade';
      },
      view: {
        class: 'foam.u2.view.StrategizerChoiceView',
        desiredModelId: 'foam.core.notification.broadcast.BroadcastNotificationFacade'
      },
      postSet: function(_, n) {
        if ( n && n.id ) {
          this.data = n.create({}, this);
        }
      }
    },
    {
      class: 'FObjectProperty',
      of: 'foam.core.notification.broadcast.BroadcastNotificationFacade',
      name: 'data',
      factory: function() {
        return this.BroadcastNotificationFacade.create();
      }
    }
  ],
  methods: [
    function render() {
      this.data.created = new Date();
      this
      .addClass()
      .start(this.Rows)
        .addClass(this.myClass('container'))
        .start()
          .add('Send Notifications')
          .addClass('h100')
        .end()
        .startContext({ data: this })
          .tag(this.NOTIFICATION_TYPE.__)
        .endContext()
        .start(this.CardBorder)
          .addClass(this.myClass('sectionWrapper'))
          .tag(this.VerticalDetailView, { data$: this.data$ })
          .start().add('Preview').addClass('p-semiBold').end()
          .start(this.NotificationRowView, { data$: this.data$, of: this.BroadcastNotification.id })
            .addClass(this.myClass('button'))
          .end()
        .end()
      .end();
    }
  ]
});

