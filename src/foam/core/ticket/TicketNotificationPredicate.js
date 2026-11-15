/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ticket',
  name: 'TicketNotificationPredicate',
  extends: 'foam.mlang.predicate.AbstractPredicate',

  documentation: `Decides which users receive a notification about a ticket
    change. The user who made the change is never notified. Otherwise the
    first rule that applies decides:

    - An external comment, a reply the ticket's subject can see, written by
      anyone but the createdFor user goes to the createdFor user.
    - The assignedTo user, when the ticket has one.
    - The users of assignedToGroup, when the ticket has one.
    - An internal comment, for staff only, goes to nobody else.
    - The createdFor user, when the ticket has one.
    - The users of group, the group of whoever made the change.

    The ticket is read in memory when the notification is expanded, before
    TicketAddCommentDAO clears its comment. Notification.predicate is
    transient, so the ticket is never stored with the notification.`,

  javaImports: [
    'foam.core.auth.User',
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
        User   user   = (User) obj;
        Ticket ticket = getTicket();

        if ( user.getId() == ticket.getLastModifiedBy() )
          return false;

        boolean internalComment = ! SafetyUtil.isEmpty(ticket.getComment());
        boolean externalComment = ! internalComment && ! SafetyUtil.isEmpty(ticket.getExternalComment());

        // A reply from staff goes to the person the ticket is for. A reply
        // from that person falls through to whoever handles the ticket.
        if ( externalComment && ticket.getCreatedFor() != 0 &&
             ticket.getLastModifiedBy() != ticket.getCreatedFor() )
          return user.getId() == ticket.getCreatedFor();

        if ( ticket.getAssignedTo() != 0 )
          return user.getId() == ticket.getAssignedTo();

        if ( ! SafetyUtil.isEmpty(ticket.getAssignedToGroup()) )
          return ticket.getAssignedToGroup().equals(user.getGroup());

        // An internal comment on a ticket nobody handles yet must not reach
        // the createdFor user, who would read a staff-only note.
        if ( internalComment )
          return false;

        if ( ticket.getCreatedFor() != 0 )
          return user.getId() == ticket.getCreatedFor();

        if ( ! SafetyUtil.isEmpty(getGroup()) )
          return getGroup().equals(user.getGroup());

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
