/**
 * @license
 * Copyright 2018 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.support.view',
  name: 'CreateTicketView',
  extends: 'foam.u2.View',

  implements: [
    'foam.mlang.Expressions'
  ],

  requires: [
    'foam.support.model.Ticket',
    'foam.support.model.TicketMessage',
    'foam.u2.PopupView',
    'foam.log.LogLevel'
  ],

  imports: [
    'ctrl',
    'notify',
    'ticketDAO',
    'subject',
    'hideSummary',
    'stack'
  ],

  exports: [
    'as data',
    'submitAsPopUp'
  ],

  css: `
    ^ {
      box-sizing: border-box;
    }
    ^ .actions {
      width: 970px;
      height: 40px;
      margin: 0 auto;
      padding: 20px 0 20px 0;
    }
    ^ .left-actions {
      display: inline-block;
      float: left;
    }
    ^ .right-actions {
      display: inline-block;
      float: right;
    }
    ^ .foam-support-view-CreateTicketView {
      margin-top:20px;
    }
    ^ .div{
      margin-top: 40px;
    }
    ^ .label{
      height: 16px;
      text-align: left;
      color: $textDefault;
      margin: 0px;
    }
    ^ .foam-u2-TextField {
      margin-bottom:20px;
      margin-top:8px;
      background-color: $backgroundDefault;
      border: solid 1px rgba(164, 179, 184, 0.5);
    }
    ^ .foam-u2-tag-TextArea {
      margin-top:8px;
    }
    ^ .property-requestorEmail,.property-requestorName{
      width: 450px;
      height: 40px;
    }
    ^ .property-message{
      width: 940px;
      height: 240px;
      border: 1px solid lightgrey;
    }
    ^ .property-subject{
      width: 940px;
      height: 40px;
    }
    ^ .New-Ticket {
      margin-top:30px;
      width: 186px;
      height: 20px;
      opacity: 0.6;
      text-align: left;
      color: $textDefault;
    }
    ^ .bg2 {
      margin-top:20px;
      border-radius: 2px;
      background-color: $backgroundDefault;
      padding: 20px;
    }
    ^ .popUpDropDown {
      padding: 0 !important;
      width: 165px;
      background: #ffffff;
      z-index: $z-popup;
      box-shadow: 0 2px 6px 0 rgba(0, 0, 0, 0.19);
    }
    ^ .popUpDropDown > div > div {
      padding: 8px 0 0 11px;
      box-sizing:border-box;
      width: 165px;
      height: 35px;
      text-align: left;
      color: $textDefault;
    }
    ^ .popUpDropDown > div > div:hover {
      background-color: rgba(89, 165, 213, 0.3);
    }
    ^ .status{
      color: white;
      display: inline-block;
      text-align: center;
    }
    ^ .Submit-as{
      float: left;
      margin-top:2px;
      margin-right:10px;
    }
    ^ .rname {
      margin-right:20px;
      float:left;
    }
  `,

  properties: [
    'submitAsMenuBtn_',
    'submitAsPopUp',
    {
      name: 'dao',
      factory: function() { return this.subject.user.tickets; }
    },
    {
      class: 'String',
      name: 'requestorEmail'
    },
    {
      class: 'String',
      name: 'requestorName'
    },
    {
      class: 'String',
      name: 'emailSubject'
    },
    {
      class: 'String',
      name: 'message',
      view: 'foam.u2.tag.TextArea'
    },
    {
      class: 'String',
      name: 'status',
      value: 'New'
    },
    {
      class: 'Int',
      name: 'ticketCount',
      value: '...'
    }
  ],

  methods: [
    function render() {
      this.hideSummary = true;

      this.dao.on.sub(this.onDAOUpdate);
      this.onDAOUpdate();

      this
        .addClass(this.myClass())
        .start().addClass('actions')
          .start().addClass('left-actions')
            .start(this.DELETE_DRAFT).end()
          .end()
          .start().addClass('right-actions')
            .start(this.SUBMIT_AS_DROP_DOWN, null, this.submitAsMenuBtn_$).end()
            .start(this.SUBMIT_AS, {
              label: this.slot(function (status) {
                return 'Submit as ' + status;
              }, this.status$)
            }).end()
          .end()
        .end()

        .start().addClass('title-light', 'New-ticket').add('New Ticket #', this.ticketCount$).end()

        .start().addClass('bg2')
        .start()
          .start().addClass('rname')
            .start().addClass('p-light', 'label')
              .add('Requestor Name')
            .end()
            .start()
              .tag(this.REQUESTOR_NAME)
            .end()
          .end()
          .start().addClass('remail')
            .start().addClass('p-light', 'label')
              .add('Requestor Email (optional)')
            .end()
            .start()
              .tag(this.REQUESTOR_EMAIL)
            .end()
          .end()
        .end()
          .start().addClass('p-light', 'label')
            .add('Subject')
          .end()
          .start()
            .tag(this.EMAIL_SUBJECT)
          .end()
          .start().addClass('p-light', 'label')
            .add('Description')
          .end()
          .start()
            .tag(this.MESSAGE)
          .end()
        .end()
    }
  ],

  actions: [
    {
      name: 'deleteDraft',
      code: function(X) {
        this.hideSummary = false;
        X.stack.back();
      }
    },
    {
      name: 'submitAs',
      code: function (X) {
        var self = this;

        var ticket = this.Ticket.create({
          requestorEmail: this.requestorEmail,
          requestorName: this.requestorName,
          userId: this.subject.user.id,
          subject: this.subject,
          status: this.status
        });

        this.dao.put(ticket).then(function(ticket) {
          if (self.message == "") return;
          var message = self.TicketMessage.create({
            senderId: self.subject.user.id,
            dateCreated: new Date(),
            message: self.message,
            type: 'Internal'
          });
          ticket.messages.put(message).then(function(a) {
            self.notify('Ticket Created!', '', self.LogLevel.INFO, true);
          });
        });
        this.stack.push({ class: 'foam.support.view.TicketView' });
      }
    },
    {
      name: 'submitAsDropDown',
      label: '',
      code: function(X) {
        var self = this;
        if ( this.submitAsPopUp ) {
          this.submitAsPopUp = null;
          return;
        }

        // create popup view
        this.submitAsPopUp = foam.u2.PopupView.create({
          width: 165,
          x: -137,
          y: 40
        });

        // add items
        this.submitAsPopUp.addClass('popUpDropDown')
          .add(this.slot(function (status) {
            var statuses = ['New', 'Pending', 'Open', 'Updated', 'Solved'].filter(function (status) {
              return status !== self.status;
            });

            return this.E().forEach(statuses, function (status) {
              this
                .start('div').addClass('p-label-light')
                .start().add('Submit as').addClass('Submit-as').end()
                .start().addClass(status).addClass('p-xs', 'status').add(status).end()
                .on('click', function () {
                  self.status = status;
                  self.submitAsPopUp.close();
                })
                .end();
            })
          }, this.status$));

        this.submitAsMenuBtn_.add(this.submitAsPopUp);
      }
    }
  ],

  listeners: [
    {
      name: 'onDAOUpdate',
      isFramed: true,
      code: function() {
        var self = this;
        this.dao.select(this.COUNT()).then(function(count) {
          self.ticketCount = count.value + 1;
        });
      }
    }
  ]
});
