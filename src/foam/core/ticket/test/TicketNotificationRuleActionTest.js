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
    ticket. The action must put one TicketNotification, addressed to the group
    of the user who last modified the ticket, carrying the ticket id, title,
    status label and the menu link in its emailArgs.`,

  javaImports: [
    'foam.core.auth.User',
    'foam.core.notification.Notification',
    'foam.core.ruler.RuleEngine',
    'foam.core.ticket.Ticket',
    'foam.core.ticket.TicketNotification',
    'foam.core.ticket.TicketNotificationRuleAction',
    'foam.core.ticket.TicketStatus',
    'foam.dao.ArraySink',
    'foam.dao.DAO',
    'foam.dao.MDAO',
    'foam.lang.DirectAgency',
    'foam.lang.X',
    'java.util.List',
    'java.util.Map'
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
        expect(notif.getGroupId(), "ticketTestGroup", "notification goes to the last modifier's group");
        expect(notif.getLocaleTemplateName(), "ticketNotificationUpdate", "create uses the update template");
        test(! notif.getBroadcasted(), "default action does not broadcast");

        Map args = notif.getEmailArgs();
        expect(args.get("ticket"), "T-1",                         "emailArgs.ticket");
        expect(args.get("title"),  "Card declined at merchant",   "emailArgs.title");
        expect(args.get("status"), "Open",                        "emailArgs.status is the status label");
        expect(args.get("comment"), "Opened by test",             "emailArgs.comment");
        expect(args.get("user"),   user.getLegalName(),           "emailArgs.user");
        expect(args.get("menu"),   "admin.tickets/T-1",           "emailArgs.menu links to the ticket");
        expect(notif.getLocaleTranslationMappings().get("status"),
          "foam.core.ticket.TicketStatus.OPEN.label", "status translation key");
      `
    }
  ]
});
