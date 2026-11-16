/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ticket.test',
  name: 'TicketNotificationRuleActionTest',
  extends: 'foam.core.test.Test',

  documentation: `Creating a Ticket runs TicketNotificationRuleAction with no old
    ticket. The action must put one TicketNotification, broadcast and filtered
    by a TicketNotificationPredicate that holds the ticket, so it reaches the
    user the ticket is assigned to or created for. The notification carries
    the ticket id, title, status label and the menu link in its emailArgs.
    testPredicate checks who TicketNotificationPredicate picks for each kind
    of change, and testTicketDAO saves a ticket through the real
    localTicketDAO: create, internal comment, external comment and close.`,

  javaImports: [
    'foam.core.auth.User',
    'foam.core.notification.Notification',
    'foam.core.ruler.RuleEngine',
    'foam.core.ticket.Ticket',
    'foam.core.ticket.TicketComment',
    'foam.core.ticket.TicketNotification',
    'foam.core.ticket.TicketNotificationPredicate',
    'foam.core.ticket.TicketNotificationRuleAction',
    'foam.core.ticket.TicketStatus',
    'foam.dao.ArraySink',
    'foam.dao.DAO',
    'foam.dao.GUIDDAO',
    'foam.dao.MDAO',
    'foam.lang.DirectAgency',
    'foam.lang.X',
    'foam.mlang.sink.Count',
    'java.util.List',
    'java.util.Map',
    'static foam.mlang.MLang.EQ'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        DAO statusDAO = new MDAO(TicketStatus.getOwnClassInfo());
        TicketStatus open = new TicketStatus();
        open.setId(Ticket.STATUS_OPEN);
        open.setLabel("Open");
        statusDAO.put(open);

        DAO userDAO = new MDAO(User.getOwnClassInfo());
        User user = new User();
        user.setId(9001L);
        user.setFirstName("Ticket");
        user.setLastName("Creator");
        user.setGroup("ticketTestGroup");
        userDAO.put(user);

        DAO ticketDAO       = new MDAO(Ticket.getOwnClassInfo());
        DAO notificationDAO = new MDAO(Notification.getOwnClassInfo());

        X tx = x
          .put("ticketStatusDAO", statusDAO)
          .put("userDAO",         userDAO)
          .put("notificationDAO", notificationDAO);

        Ticket ticket = new Ticket();
        ticket.setId("T-1");
        ticket.setTitle("Card declined at merchant");
        ticket.setComment("Opened by test");
        ticket.setLastModifiedBy(user.getId());

        new TicketNotificationRuleAction().applyAction(tx, ticket, null,
          new RuleEngine(tx, tx, ticketDAO), null, new DirectAgency());

        List notifications = ((ArraySink) notificationDAO.select(new ArraySink())).getArray();
        test(notifications.size() == 1, "one notification on ticket create, got " + notifications.size());
        if ( notifications.size() != 1 ) return;

        Notification notif = (Notification) notifications.get(0);
        test(notif instanceof TicketNotification, "notification is a TicketNotification, got " + notif.getClass().getName());
        expect(notif.getLocaleTemplateName(), "ticketNotificationOpenClose", "create uses the open/close template");
        test(notif.getBroadcasted(), "default action broadcasts");
        test(notif.getPredicate() instanceof TicketNotificationPredicate,
          "recipients filtered by TicketNotificationPredicate, got " + notif.getPredicate());
        if ( notif.getPredicate() instanceof TicketNotificationPredicate )
          expect(((TicketNotificationPredicate) notif.getPredicate()).getTicket().getId(), "T-1",
            "the predicate holds the ticket");

        Map args = notif.getEmailArgs();
        expect(args.get("ticket"), "T-1",                         "emailArgs.ticket");
        expect(args.get("title"),  "Card declined at merchant",   "emailArgs.title");
        expect(args.get("status"), "Open",                        "emailArgs.status is the status label");
        expect(args.get("comment"), "Opened by test",             "emailArgs.comment");
        expect(args.get("user"),   user.getLegalName(),           "emailArgs.user");
        expect(args.get("menu"),   "admin.tickets/T-1",           "emailArgs.menu links to the ticket");
        expect(notif.getLocaleTranslationMappings().get("status"),
          "foam.core.ticket.TicketStatus.OPEN.label", "status translation key");

        testPredicate();
        testTicketDAO(x);
      `
    },
    {
      name: 'testPredicate',
      documentation: `One ticket per case. 1001 is the user the ticket is for,
        2002 the assignee and 3003 a member of staff.`,
      javaCode: `
        User createdFor = user(1001L, "customer");
        User assignee   = user(2002L, "support");
        User staff      = user(3003L, "support");

        // A staff reply goes to the person the ticket is for, even when the
        // assignee wrote it.
        Ticket t = ticket(1001L, 2002L, "", 2002L);
        t.setExternalComment("We have refunded you");
        expect(predicate(t).f(createdFor), true,  "(predicate) an external comment by the assignee reaches createdFor");
        expect(predicate(t).f(assignee),   false, "(predicate) the assignee who wrote it is not notified");

        // A reply from the person the ticket is for goes to the assignee.
        t = ticket(1001L, 2002L, "", 1001L);
        t.setExternalComment("Still waiting");
        expect(predicate(t).f(assignee),   true,  "(predicate) an external comment by createdFor reaches the assignee");
        expect(predicate(t).f(createdFor), false, "(predicate) createdFor who wrote it is not notified");

        // An internal note never reaches the person the ticket is for.
        t = ticket(1001L, 0L, "", 3003L);
        t.setComment("Customer is on a watch list");
        expect(predicate(t).f(createdFor), false, "(predicate) an internal comment with no assignee does not reach createdFor");
        t = ticket(1001L, 0L, "support", 3003L);
        t.setComment("Customer is on a watch list");
        expect(predicate(t).f(assignee),   true,  "(predicate) an internal comment reaches the assigned group");
        expect(predicate(t).f(createdFor), false, "(predicate) an internal comment with a group does not reach createdFor");
        expect(predicate(t).f(staff),      false, "(predicate) the staff member who wrote it is not notified");

        // A change with no comment goes to createdFor when nobody is assigned,
        // and to the changer's group when the ticket names nobody.
        t = ticket(1001L, 0L, "", 3003L);
        expect(predicate(t).f(createdFor), true, "(predicate) a change with no comment reaches createdFor");
        t = ticket(0L, 0L, "", 3003L);
        TicketNotificationPredicate p = predicate(t);
        p.setGroup("support");
        expect(p.f(assignee), true, "(predicate) a ticket naming nobody reaches the changer's group");
      `
    },
    {
      name: 'testTicketDAO',
      args: 'X x',
      documentation: `Saves one ticket through localTicketDAO, which runs the
        rule inside TicketAddCommentDAO, and reads the notifications it puts.`,
      javaCode: `
        DAO notificationDAO = new GUIDDAO(new MDAO(Notification.getOwnClassInfo()));
        X   tx              = x.put("notificationDAO", notificationDAO);
        DAO ticketDAO       = ((DAO) x.get("localTicketDAO")).inX(tx);
        DAO commentDAO      = (DAO) x.get("ticketCommentDAO");

        Ticket t = new Ticket();
        t.setTitle("Refund not received");
        t.setCreatedFor(1001L);
        t.setAssignedTo(2002L);
        t = (Ticket) ticketDAO.put(t);
        test(waitFor(notificationDAO, 1), "(dao) create sends one notification, got " + count(notificationDAO));

        t = (Ticket) t.fclone();
        t.setComment("Checked with the bank");
        t = (Ticket) ticketDAO.put(t);
        test(waitFor(notificationDAO, 2), "(dao) an internal comment sends a notification, got " + count(notificationDAO));
        Notification internal = find(notificationDAO, "Checked with the bank");
        test(internal != null && internal.getPredicate().f(user(2002L, "support")),
          "(dao) the internal comment reaches the assignee");
        test(internal != null && ! internal.getPredicate().f(user(1001L, "customer")),
          "(dao) the internal comment does not reach createdFor");

        t = (Ticket) t.fclone();
        t.setExternalComment("Your refund was sent today");
        t = (Ticket) ticketDAO.put(t);
        test(waitFor(notificationDAO, 3), "(dao) an external comment sends a notification, got " + count(notificationDAO));
        Notification external = find(notificationDAO, "Your refund was sent today");
        test(external != null && external.getPredicate().f(user(1001L, "customer")),
          "(dao) the external comment reaches createdFor");
        expect(count(commentDAO.where(EQ(TicketComment.TICKET, t.getId()))), 2L,
          "(dao) both comments are stored as TicketComments");

        t = (Ticket) t.fclone();
        t.setStatus(Ticket.STATUS_CLOSED);
        t = (Ticket) ticketDAO.put(t);
        test(waitFor(notificationDAO, 4), "(dao) a close with no comment sends a notification, got " + count(notificationDAO));
        expect(count(commentDAO.where(EQ(TicketComment.TICKET, t.getId()))), 2L,
          "(dao) a close with no comment stores no TicketComment");
        expect(t.getComment(), "", "(dao) the saved ticket has no comment left on it");
      `
    },
    {
      name: 'ticket',
      args: 'long createdFor, long assignedTo, String assignedToGroup, long lastModifiedBy',
      type: 'Ticket',
      javaCode: `
        Ticket t = new Ticket();
        t.setCreatedFor(createdFor);
        t.setAssignedTo(assignedTo);
        t.setAssignedToGroup(assignedToGroup);
        t.setLastModifiedBy(lastModifiedBy);
        return t;
      `
    },
    {
      name: 'predicate',
      args: 'Ticket ticket',
      type: 'TicketNotificationPredicate',
      javaCode: `
        TicketNotificationPredicate p = new TicketNotificationPredicate();
        p.setTicket(ticket);
        return p;
      `
    },
    {
      name: 'user',
      args: 'long id, String group',
      type: 'User',
      javaCode: `
        User u = new User();
        u.setId(id);
        u.setGroup(group);
        return u;
      `
    },
    {
      name: 'find',
      args: 'DAO dao, String comment',
      type: 'Notification',
      documentation: 'The capture DAO has GUID ids, so its order says nothing; find by the comment.',
      javaCode: `
        for ( Object o : ((ArraySink) dao.select(new ArraySink())).getArray() ) {
          Notification n = (Notification) o;
          if ( comment.equals(n.getEmailArgs().get("comment")) ) return n;
        }
        return null;
      `
    },
    {
      name: 'waitFor',
      args: 'DAO dao, long expected',
      type: 'Boolean',
      documentation: 'Polls for up to 10 seconds, because the rule puts its notification through an agency.',
      javaCode: `
        for ( int i = 0 ; i < 50 ; i++ ) {
          if ( count(dao) >= expected ) return true;
          try { Thread.sleep(200); } catch ( InterruptedException e ) { return false; }
        }
        return count(dao) >= expected;
      `
    },
    {
      name: 'count',
      args: 'DAO dao',
      type: 'Long',
      javaCode: `
        return ((Count) dao.select(new Count())).getValue();
      `
    }
  ]
});
