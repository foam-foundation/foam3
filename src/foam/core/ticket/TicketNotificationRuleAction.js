/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ticket',
  name: 'TicketNotificationRuleAction',
  documentation: 'RuleAction for sending notifications on Ticket status change and comment updates',

  implements: [ 'foam.core.ruler.RuleAction' ],

  javaImports: [
    'foam.core.auth.User',
    'foam.core.auth.Subject',
    'foam.core.logger.Logger',
    'foam.core.logger.Loggers',
    'foam.core.notification.Notification',
    'foam.dao.DAO',
    'foam.lang.ContextAgent',
    'foam.lang.X',
    'foam.mlang.predicate.Predicate',
    'java.util.HashMap',
    'java.util.Map',
    'foam.util.SafetyUtil'
  ],

  properties: [
    {
      name: 'ticketNotificationOpenClose',
      class: 'String',
      value: 'ticketNotificationOpenClose'
    },
    {
      name: 'ticketNotificationUpdate',
      class: 'String',
      value: 'ticketNotificationUpdate'
    },
    {
      name: 'ticketNotificationUpdateAssigned',
      class: 'String',
      value: 'ticketNotificationUpdateAssigned'
    }
  ],

  methods: [
    {
      name: 'applyAction',
      javaCode: `
      Logger logger = Loggers.logger(x, this);
      Ticket ticket = null;
      Ticket oldTicket = null;
      TicketStatus status = null;
      TicketStatus oldStatus = null;
      String comment = null;
      String localeTemplate = getTicketNotificationOpenClose();

      HashMap<String, Object> emailArgs = new HashMap<>();
      HashMap<String, String> translationMappings = new HashMap();

        ticket = (Ticket) obj;
        comment = ticket.getComment(); 
        if ( SafetyUtil.isEmpty(comment) )
          comment = ticket.getExternalComment();

        if ( oldObj != null ) {
          oldTicket = (Ticket) oldObj;

          // Only notify when a user modifiable propery has changed.
          Map diff = oldTicket.diff(ticket);
          if ( diff.size() == 0 && SafetyUtil.isEmpty(comment) )
            return;
          if ( diff.size() > 0 ) {
            diff.remove(Ticket.CREATED.getName());
            diff.remove(Ticket.CREATED_BY.getName());
            diff.remove(Ticket.LAST_MODIFIED.getName());
            diff.remove(Ticket.LAST_MODIFIED_BY.getName());
            if ( diff.size() == 0 && SafetyUtil.isEmpty(comment) )
              return;
          }

          localeTemplate = getTicketNotificationUpdate();
          if ( ticket.getAssignedTo() != 0 ||
               ticket.getCreatedFor() != 0 ||
               ! SafetyUtil.isEmpty(ticket.getAssignedToGroup()) )
            localeTemplate = getTicketNotificationUpdateAssigned();
 
          oldStatus = (TicketStatus) ((DAO) x.get("ticketStatusDAO")).find(oldTicket.getStatus());  // no null check, if null the system is completely broken

          emailArgs.put("oldStatus", oldStatus.getLabel());
          translationMappings.put("oldStatus", "foam.core.ticket.TicketStatus."+oldStatus.getId()+".label");
        }

        status = (TicketStatus) ((DAO) x.get("ticketStatusDAO")).find(ticket.getStatus());  // no null check, if null the system is completely broken
        emailArgs.put("status", status.getLabel());
        translationMappings.put("status", "foam.core.ticket.TicketStatus."+status.getId()+".label");
        if ( oldStatus != null &&
             ! status.getId().equals(oldStatus.getId()) && status.getId().equals(Ticket.STATUS_CLOSED) ) {
          localeTemplate = getTicketNotificationOpenClose();
        }

        DAO userDAO = (DAO) x.get("userDAO");
        User user = (User) userDAO.find(ticket.getLastModifiedBy());
        if ( user == null ) {
          Subject subject = (Subject) x.get("subject");
          if ( subject != null )
            user = subject.getRealUser();
        }
        if ( user != null ) {
          emailArgs.put("user", user.getLegalName());
        }

        User assignedTo = (User) userDAO.find(ticket.getAssignedTo());
        if ( assignedTo != null )
          emailArgs.put("assignedTo", assignedTo.getLegalName());

        User createdFor = (User) userDAO.find(ticket.getCreatedFor());
        if ( createdFor != null )
          emailArgs.put("createdFor", createdFor.getLegalName());

        emailArgs.put("ticket", ticket.getId());
        emailArgs.put("title", ticket.getTitle());
        emailArgs.put("comment", comment);

        emailArgs.put("menu", "admin.tickets/" + ticket.getId());

        final Notification notif = getNotification(x, user, ticket, oldTicket);
        notif.setLocaleTemplateName(localeTemplate);
        // notif.setEmailName(emailTemplate); - leave email for the application layer

        addAdditionalArgs(x, user, ticket, oldTicket, emailArgs, translationMappings);

        notif.setEmailArgs(emailArgs);
        notif.setLocaleTranslationMappings(translationMappings);

        Predicate pred = getBroadcastPredicate(ruler.getX(), user, ticket, oldTicket);
        if ( pred != null ) {
          notif.setBroadcasted(true);
          notif.setPredicate(pred);
        }

        agency.submit(x, new ContextAgent() {
          public void execute(X x) {
            ((DAO) x.get("notificationDAO")).put(notif);
          }
        }, "TicketNotificationRuleAction");
      `
    },
    {
      name: 'getNotification',
      args: 'X x, User user, Ticket ticket, Ticket oldTicket',
      type: 'Notification',
      javaCode: `
        return new TicketNotification(x);
      `
    },
    {
      name: 'addAdditionalArgs',
      args: 'X x, User user, Ticket ticket, Ticket oldTicket, Map emailArgs, Map translationMappings',
      javaCode: `
        // nop
      `
    },
    {
      name: 'getBroadcastPredicate',
      args: 'X x, User user, Ticket ticket, Ticket oldTicket',
      type: 'Predicate',
      documentation: 'Predicate for filter user when broadcasting.',
      javaCode: `
        TicketNotificationPredicate pred = new TicketNotificationPredicate(x);
        pred.setTicket(ticket);
        if ( user != null )
          pred.setGroup(user.getGroup());
        return pred;
      `
    },
  ]
})
