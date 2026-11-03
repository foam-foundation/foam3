/**
 * @license
 * Copyright 2018 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.support.view',
  name: 'MessageCard',
  extends: 'foam.u2.View',

  documentation: 'Card for message views',

  requires: [
    'foam.support.model.Ticket',
    'foam.support.model.TicketMessage'
  ],

  imports: [
    'userDAO',
    'ticketDAO',
    'ticketMessageDAO'
  ],

  css: `
    << {
      box-sizing: border-box;
    }
    << .bg {
      border-radius: 2px;
      background-color: $backgroundDefault;
      padding-bottom: 30px;
    }
    << .company-name {
      margin-right: 10px;
      float: left;
      text-align: left;
      color: $textDefault;
      padding-left: 20px;
      padding-top: 10px;
      padding-right: 0px;
    }
    << .date {
      line-height: 0.8;
      text-align: left;
      color: #a4b3b8;
      padding: 14px 14px 0 0;
      display: inline-block;
    }
    << .text {
      text-align: left;
      color: $textDefault;
      margin-left:20px;
      padding: 30px 0 0 60px;
    }
    << .person {
      width: 40;
      height: 40px;
      object-fit: contain;
      display: inline-block;
      float: left;
      margin-left: 10px;
      padding-left: 10px;
    }
    << .tb {
      display: inline-block;
      float: left;
      width: 0px;
    }
    hr {
      margin: 1px;
      border: 0;
    }
    << .spaceline {
      padding-top: 15px;
    }
    << .internal-status {
      display: inline-block;
      height: 16px;
      padding: 2px 8px 2px 8px;
      border-radius: 100px;
      background-color: #1cc2b7;
      color: white;
    }
  `,

  properties: [
    'message',
    'requestName'
  ],

  methods: [
    function render() {
      var self = this;
      //find requestorName associated to ticketMessages
      this.userDAO.find(this.message.senderId).then(function(a) {
        if ( ! a ) return;
        self.requestName = a.firstName + " " + a.lastName;
      });

      this
        .addClass(this.myClass())
        .start('div').addClass('bg')
          .start('hr').end()
            .start().addClass('spaceline')
              .start({ class:'foam.u2.tag.Image', data:'images/person.svg' }).addClass('person')
              .start()
                .start().add(this.requestName$).addClass('p-label', 'company-name').end()
                .start().add(foam.Date.formatDate(this.message.dateCreated, false)).addClass('p-xs', 'date').end()
                .callIf(this.message.type == 'Internal', function(){
                  this.start().addClass('p-label-light', 'internal-status')
                    .add('Internal Note')
                  .end()
                })
              .end()
              .start().add(this.message.message).addClass('p-legal-light', 'text').end()
          .end()
        .end();
    }
  ]
});
