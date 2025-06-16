/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.pii',
  name: 'PIIReportUserRefines',
  refines: 'foam.core.auth.User',

  imports: [
    'notify',
    'routeTo',
    'ticketDAO?'
  ],

  requires: [
    'foam.log.LogLevel',
    'foam.core.auth.LifecycleState',
    'foam.core.pii.PIIReportTicket',
    'foam.core.ticket.Ticket'
  ],

  messages: [
    { name: 'PII_ALREADY_OPEN',    message: 'PII Report Ticket already Open.' },
  ],

  actions: [
    {
      documentation: 'Generate a PII Report Ticket',
      name: 'pii',
      label: 'PII Report',
      toolTip: 'Create a Personal Identifiable Information (PII) Report Ticket',
      availablePermissions: ['user.action.pii'],
      isAvailable: async function(id, type, lifecycleState) {
        return id && type == 'User' &&
          lifecycleState != this.LifecycleState.DELETED;
      },
      code: function(X) {
        var self = this;
        this.ticketDAO?.find(
          this.AND(
            this.EQ(this.Ticket.TYPE, this.PIIReportTicket.name),
            this.EQ(this.Ticket.CREATED_FOR, this.id),
            this.EQ(this.Ticket.STATUS, "OPEN")
          )
        ).then(t => {
          if ( t ) {
            self.notify(self.PII_ALREADY_OPEN, '', self.LogLevel.INFO);
            self.routeTo(self.ticketMenu+"/"+t.id);
          } else {
            var ticket = self.PIIReportTicket.create({
              createdFor: self.id,
              spid: self.spid
            });
            self.ticketDAO.put(ticket).then(function(t) {
              self.routeTo(self.ticketMenu+"/"+t.id);
            });
          }
        }, e => {
          self.notify(e, '', self.LogLevel.ERROR);
        });
      }
    }
  ]
});
