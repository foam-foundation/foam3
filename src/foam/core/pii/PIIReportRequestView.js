/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.pii',
  name: 'PIIReportRequestView',
  extends: 'foam.u2.View',
  implements: [ 'foam.mlang.Expressions' ],

  documentation: 'End user view to request pii report',

  classes: [
    {
      name: 'GenerateRequest',
      imports: [
        'notify',
        'subject',
        'ticketDAO',
        'window'
      ],
      requires: [
        'foam.core.pii.PIIReportTicket'
      ],

      properties: [
        'parent'
      ],

      actions: [
        {
          name: 'generate',
          label: 'Generate and Send',
          buttonStyle: 'PRIMARY',
          code: function(X) {
            var self = this;
            let user = this.subject.user;
            var ticket = this.PIIReportTicket.create({
              createdFor: user.id,
              spid: user.spid
            });
            this.ticketDAO.put(ticket).then(function(t) {
              t.status = 'CLOSED';
              self.ticketDAO.put(t);
              self.parent.sent = true;
              X.notify("PII Report Sent Successfully");
            });
          }
        }
      ]
    }
  ],

  imports: [
    'subject',
    'ticketDAO'
  ],

  requires: [
    'foam.core.pii.PIIReportTicket',
    'foam.core.ticket.Ticket'
  ],

  css: `
    << {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: start;
      gap: 1rem;
      padding: 2.4rem 3.2rem;
      width: clamp(400px, 100%, 700px);
      max-width: 90vw;
      text-align: center;
      margin: auto;
    }
  `,

  messages: [
    { name: 'TITLE', message: 'Personal Identifiable Information Report' },
    { name: 'HELP_TEXT_1', message: 'In compliance with General Data Protection Regulations (GDPR), this service will generate a report containing Personal Identifiable Information (PII) held by this system.' },
    { name: 'HELP_TEXT_2', message: 'The report will be emailed to ${email}.', template: true },
    { name: 'HELP_TEXT_3', message: 'Only one report will be generated in a ${requestTtl} hour period.', template: true },
    { name: 'MSG_CONFIRMATION', message: 'A PII Report has been emailed to ${email}.', template: true },
    { name: 'MSG_ALREADY', message: 'A PII Report has been requested recently, you can request another in ${retryHours} hours.', template: true }
  ],

  properties: [
    {
      documentation: 'Allow one request per time window - in hours',
      name: 'requestTtl',
      class: 'Long',
      units: 'h',
      value: 24
    },
    {
      class: 'FObjectProperty',
      of: 'foam.core.pii.PIIReportRequestView.GenerateRequest',
      name: 'data',
      factory: function() {
        return this.GenerateRequest.create({parent: this});
      }
    },
    {
      name: 'sent',
      value: false
    }
  ],

  methods: [
    async function render() {
      this.SUPER();
      var self = this;
      let user = this.subject.user;
      var t = await this.ticketDAO.orderBy(
        this.DESC(this.Ticket.CREATED)
      ).find(
        this.AND(
          this.EQ(this.Ticket.TYPE, this.PIIReportTicket.name),
          this.EQ(this.Ticket.CREATED_FOR, user.id)
        )
      );
      var delta = 0;
      if ( t ) {
        delta = Math.ceil(this.requestTtl - ((new Date().getTime() - t.created.getTime()) / 3600000));
      }
      var alreadySent = ( delta > 0 && delta <= this.requestTtl );

      this
        .addClass()
        .start().addClass('h400').add(this.TITLE).end()
        .start()
        .addClass('p')
        .add(this.HELP_TEXT_1)
        .end()
        .start()
        .addClass('p')
        .add(this.HELP_TEXT_2({email: user.email}))
        .callIf(this.requestTtl > 0, function() {
          self.add(self.HELP_TEXT_3({requestTtl: self.requestTtl}))
        })
        .end()
        .start()
        .addClass('p')
        .add(this.slot(function(sent) {
          let e = this.E();
          if ( alreadySent ) {
            e.add(self.MSG_ALREADY({retryHours: delta}));
          } else if ( sent ) {
            e.add(self.MSG_CONFIRMATION({email: user.email}));
          } else {
            e.tag(self.data.GENERATE);
          }
          return e;
        }))
        .end();
    }
  ]
});
