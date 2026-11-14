/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ticket',
  name: 'TicketNotificationPredicate',
  extends: 'foam.mlang.predicate.AbstractPredicate',

  documentation: `Predicate which determines which users should receive
a Ticket related notification.
Send to assignedTo, else createdFor, else all in assignedToGroup, and
finally everyone in instigators group.
  `,

  javaImports: [
    'foam.core.auth.User',
    'foam.lang.X',
    'foam.util.SafetyUtil'
  ],

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.core.ticket.Ticket',
      name: 'ticket',
    },
    {
      class: 'Reference',
      of: 'foam.core.auth.Group',
      name: 'group'
    }
  ],

  methods: [
    {
      name: 'f',
      javaCode: `
        X x = getX();
        User user = (User) obj;

        // Don't notify the instigator of the notification
        if ( user.getId() == getTicket().getLastModifiedBy() )
          return false;

        if ( getTicket().getAssignedTo() != 0 ) 
          return user.getId() == getTicket().getAssignedTo();

        if ( ! SafetyUtil.isEmpty(getTicket().getAssignedToGroup()) )
          return user.getGroup().equals(getTicket().getAssignedToGroup());

        if ( getTicket().getCreatedFor() != 0 )
          return user.getId() == getTicket().getCreatedFor();

        if ( ! SafetyUtil.isEmpty(getGroup()) )
          return user.getGroup().equals(getGroup());

        return false;
      `
    },
    {
      type: 'FObject',
      name: 'fclone',
      javaCode: 'return this;'
    }
  ]
});
