/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ticket',
  name: 'TicketNotificationNotificationCitationView',
  extends: 'foam.core.notification.NotificationCitationView',

  imports: [
    'stack',
    'ticketDAO'
  ],

  requires: [
    'foam.comics.v2.DAOControllerConfig',
    'foam.u2.stack.StackBlock'
  ],

  // TODO: This css only works in v3.17. Once this change is merged to v3.17, we need to
  // readjust the css so that this view does not look off on foam dev 
  css: `
    << {
      display: flex;
      align-items: flex-end;
      gap: 1ch;
    }

    <<link {
      border: none;
      padding: 0;
    }

    << .description {
      line-height: 1.71
    }

  `,

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.core.ticket.Ticket',
      name: 'ticket',
      hidden: true,
      transient: true
    },
    {
      class: 'Boolean',
      name: 'hasFoundTicket',
      documentation: 'Check if ticket id attached to the notification (data.ticket) is valid',
      transient: true,
      hidden: true
    },
    {
      name: 'data',
      postSet: function() {
        if ( ! this.data.ticket ) {
          this.hasFoundTicket = false;
          return;
        }

        this.ticketDAO.find(this.data.ticket).then(ticket => {
          this.hasFoundTicket = !! ticket;
          this.ticket = this.hasFoundTicket ? ticket : undefined;
        });
      }
    }
  ],

  methods: [
    function render() {
      this.SUPER();
      this
        .startContext({ data: this })
          .start(this.GO_TO_TICKET).show(this.hasFoundTicket$)
            .addClass(this.myClass('link'))
          .end()
        .endContext();
    }
  ],
  actions: [
    {
      name: 'goToTicket',
      label: 'Go to the ticket',
      buttonStyle: 'LINK',
      size: 'SMALL',
      code: async function() {

        if ( ! this.ticket ) return;

        this.stack.push(this.StackBlock.create({
          view: {
            class: 'foam.comics.v2.DAOSummaryView',
            data: this.ticket,
            of: this.ticket.cls_,
            config: this.DAOControllerConfig.create({
              daoKey: 'ticketDAO',
              of: this.ticket.cls_,
              editPredicate: foam.mlang.predicate.False.create(),
              createPredicate: foam.mlang.predicate.False.create(),
              deletePredicate: foam.mlang.predicate.False.create()
            })
          },
          parent: this.__subContext__
        }));
      }
    }
  ]
});
