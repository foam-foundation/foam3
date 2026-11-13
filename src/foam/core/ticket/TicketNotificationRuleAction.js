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
    'java.util.Map'
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
      TicketComment ticketComment = null;
      String comment = null;
      String localeTemplate = getTicketNotificationOpenClose();
      User user = null;

      HashMap<String, Object> emailArgs = new HashMap<>();
      HashMap<String, String> translationMappings = new HashMap();
      try {
        if ( obj instanceof TicketComment ) {
          ticketComment = (TicketComment) obj;
          comment = ticketComment.getComment();
          ticket = (ticketComment.findTicket(x));
          localeTemplate = getTicketNotificationUpdate();
          user = (User) ((DAO) x.get("userDAO")).find(ticketComment.getLastModifiedBy());
        } else {
          ticket = (Ticket) obj;
          comment = ticket.getComment(); // last comment
          localeTemplate = getTicketNotificationUpdate();
          user = (User) ((DAO) x.get("userDAO")).find(ticket.getLastModifiedBy());

          if ( oldObj != null ) {
            oldTicket = (Ticket) oldObj;

            // Only notify when a user modifiable propery has changed.
            Map diff = oldTicket.diff(ticket);
            if ( diff.size() == 0 )
              return;
            if ( diff.size() > 0 ) {
              diff.remove(Ticket.CREATED.name);
              diff.remove(Ticket.CREATED_BY.name);
              diff.remove(Ticket.LAST_MODIFIED.name);
              diff.remove(Ticlet.LAST_MODIFIED_BY.name);
              if ( diff.size() == 0 )
                return;
            }

            oldStatus = (TicketStatus) ((DAO) x.get("ticketStatusDAO")).find(oldTicket.getStatus());
            emailArgs.put("oldStatus", oldStatus.getLabel());
            translationMappings.put("oldStatus", "foam.core.ticket.TicketStatus."+oldStatus.getId()+".label");
          }
        }
        status = (TicketStatus) ((DAO) x.get("ticketStatusDAO")).find(ticket.getStatus());
        emailArgs.put("status", status.getLabel());
        translationMappings.put("status", "foam.core.ticket.TicketStatus."+status.getId()+".label");
        if ( oldStatus != null &&
             ! status.getId().equals(oldStatus.getId()) && status.getId().equals(Ticket.STATUS_CLOSED) ) {
          localeTemplate = getTicketNotificationOpenClose();
        }

        final Notification notif = getNotification(x, user, ticket, oldTicket, ticketComment);
        notif.setLocaleTemplateName(localeTemplate);
        // notif.setEmailName(emailTemplate); - leave email for the application layer

        emailArgs.put("ticket", ticket.getId());
        emailArgs.put("title", ticket.getTitle());
        emailArgs.put("comment", comment);

        if ( user == null ) {
          Subject subject = (Subject) x.get("subject");
          if ( subject != null )
            user = subject.getRealUser();
        }
        if ( user != null ) {
          emailArgs.put("user", user.getLegalName());
        }

        emailArgs.put("menu", "admin.tickets/" + ticket.getId());

        addAdditionalArgs(x, user, ticket, oldTicket, ticketComment, emailArgs, translationMappings);

        notif.setEmailArgs(emailArgs);
        notif.setLocaleTranslationMappings(translationMappings);

        Predicate pred = getBroadcastPredicate(ruler.getX(), user, ticket, oldTicket, ticketComment);
        if ( pred != null ) {
          notif.setBroadcasted(true);
          notif.setPredicate(pred);
        }

        agency.submit(x, new ContextAgent() {
          public void execute(X x) {
            ((DAO) x.get("notificationDAO")).put(notif);
          }
        }, "TicketNotificationRuleAction");
      } catch ( Throwable e ) {
        logger.error(e.getMessage());
      }
      `
    },
    {
      name: 'getNotification',
      args: 'X x, User user, Ticket ticket, Ticket oldTicket, TicketComment comment',
      type: 'Notification',
      documentation: 'defaults to sending by group.',
      javaCode: `
        TicketNotification notif = new TicketNotification(x);
        if ( user != null )
          notif.setGroupId(user.getGroup());
        return notif;
      `
    },
    {
      name: 'addAdditionalArgs',
      args: 'X x, User user, Ticket ticket, Ticket oldTicket, TicketComment comment, Map emailArgs, Map translationMappings',
      javaCode: `
        // nop
      `
    },
    {
      name: 'getBroadcastPredicate',
      args: 'X x, User user, Ticket ticket, Ticket oldTicket, TicketComment comment',
      type: 'Predicate',
      documentation: 'Predicate for filter user when broadcasting.',
      javaCode: `
        return null;
      `
    },
  ]
})
