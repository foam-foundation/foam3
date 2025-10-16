/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.auth',
  name: 'UserLifecycleTicketRuleAction',

  documentation: 'Change User Lifecycle state with consideration of associated data.',

  implements: [
    'foam.core.ruler.RuleAction'
  ],

  javaImports: [
    'foam.lang.ContextAgent',
    'foam.lang.Detachable',
    'foam.lang.FObject',
    'foam.lang.PropertyInfo',
    'foam.lang.X',
    'foam.dao.AbstractSink',
    'foam.dao.DAO',
    'foam.dao.Sink',
    'static foam.mlang.MLang.*',
    'foam.core.session.Session',
    'foam.core.crunch.UserCapabilityJunction',
    'foam.core.logger.Logger',
    'foam.core.logger.Loggers',
    'foam.core.logger.PrefixLogger',
    'foam.core.ticket.Ticket',
    'foam.core.ticket.TicketComment',
    'foam.util.SafetyUtil',
    'java.util.ArrayList',
    'java.util.List'
  ],

  methods: [
    {
      name: 'applyAction',
      javaCode: `
        agency.submit(x, new ContextAgent() {
          @Override
          public void execute(X x) {
            User admin = new User();
            admin.setId(1);
            admin.setGroup("admin");
            UserLifecycleTicket ticket = (UserLifecycleTicket) obj;
            DAO dao = (DAO) ruler.getX().get("userDAO");
            User user = (User) dao.find(ticket.getCreatedFor());
            LifecycleState old = user.getLifecycleState();
            LifecycleState nu = ticket.getRequestedLifecycleState();

            // Save ticket comment
            if ( ! SafetyUtil.isEmpty(ticket.getComment()) ) {
              var ticketComment = new TicketComment();
              ticketComment.setComment(ticket.getComment());
              ticketComment.setTicket(ticket.getId());
              ((DAO) x.get("ticketCommentDAO")).put_(x, ticketComment);
            }

            // Previous updated list is stored in current for this run,
            // and saved back to updated if the run was aborted.
            ticket.setCurrent(ticket.getUpdated()); // List.copyOf(ticket.getUpdated()));
            UserLifecycleTicket.UPDATED.clear(ticket);

            try {
              // run if
              // 1. state is different or
              // 2. state is the same, but nothing was updated last run.
              // This second case occurs if the system determines that
              // a full DISABLED or DELETED should not occur, for example,
              // and the user is DISABLED to block login,
              // but nothing else is altered. The operation can be run
              // again when the offending scenario has changed.
              if ( old != nu ||
                   old == nu &&
                   ticket.getCurrent().size() == 0 ) {
                if ( old == LifecycleState.DELETED &&
                     nu == LifecycleState.ACTIVE ) {
                  verifyReActivation(x, user);
                }

                if ( ticket.getIncludeRelationships() ) {
                  updateUserAssociations(
                    ruler.getX()
                      .put("logger", new PrefixLogger(new Object[] { "UserLifecycleTicket", user.getId() }, (Logger) x.get("logger")))
                      .put(UserLifecycleTicket.class, ticket),
                    user, nu);
                  user = (User) user.fclone();
                  user.setLifecycleState(nu);
                  ((Logger) x.get("logger")).info("UserLifecycleTicket", user.getId(), old, nu);
                  ((DAO) ruler.getX().get("localUserDAO")).put(user);
                } else if ( nu == LifecycleState.DISABLED ||
                            nu == LifecycleState.DELETED ) {
                  user.setLifecycleState(LifecycleState.DISABLED);
                  updateSessions(x, user, LifecycleState.DELETED);
                  ((DAO) ruler.getX().get("localUserDAO")).put(user);
                } else {
                  user.setLifecycleState(LifecycleState.ACTIVE);
                  ((DAO) ruler.getX().get("localUserDAO")).put(user);
                }
              }
              ticket.setMessage(null);
              ticket.setComment(old.getName()+" -> "+nu.getName()+" successful");
            } catch (Throwable t) {
              ticket.setMessage(t.getMessage());
              ticket.setComment(old.getName()+" -> "+nu.getName()+" failed: "+t.getMessage());
              if ( ! ( t instanceof IllegalStateException ) ) {
                ((Logger) x.get("logger")).warning(ticket.getComment(), t);
              }
              if ( nu == LifecycleState.DISABLED ||
                   nu == LifecycleState.DELETED ) {
                user.setLifecycleState(LifecycleState.DISABLED);
                updateSessions(x, user, LifecycleState.DELETED);
                ((Logger) x.get("logger")).warning("UserLifecycleTicket", user.getId(), "Failed",ticket.getRequestedLifecycleState(), "only disabling", t.getMessage());
                ((DAO) ruler.getX().get("localUserDAO")).put(user);
              }
              ticket.setUpdated(ticket.getCurrent());
              ticket.setStatus(((Ticket)oldObj).getStatus());
            }
          }
        }, "UserLifecycleTicketRuleAction");
      `
    },
    {
      documentation: 'On re-activation ensure username is still unique',
      name: 'verifyReActivation',
      args: 'X x, User user',
      javaCode: `
      User active = (User) ((DAO) x.get("localUserDAO")).find(
        AND(
          EQ(User.USER_NAME, user.getUserName()),
          EQ(User.SPID, user.getSpid()),
          NEQ(User.ID, user.getId()),
          NEQ(User.LIFECYCLE_STATE, LifecycleState.DELETED)
        )
      );
      if ( active != null ) {
        throw new DuplicateUserNameException(String.valueOf(active.getId()));
      }
      `
    },
    {
      documentation: 'Hook for application refinements',
      name: 'updateUserAssociations',
      args: 'X x, User user, LifecycleState state',
      javaCode: `
      updateSessions(x, user, state);
      updateUCJs(x, user, state);
      updateCredentials(x, user, state);
      updateReferralCodes(x, user, state);
      updatePushRegistrations(x, user, state);
      updateDocuments(x, user, state);
      // TODO: updateApprovalRequests(x, user, state);
      `
    },
    {
      name: 'updateSessions',
      args: 'X x, User user, LifecycleState state',
      javaCode: `
      if ( state == LifecycleState.DISABLED ||
           state == LifecycleState.DELETED )  {
      AuthService auth = (AuthService) x.get("auth");
      ((DAO) getX().get("sessionDAO")).where(
          OR(
            EQ(Session.USER_ID, user.getId()),
            EQ(Session.AGENT_ID, user.getId())
          )
        ).select(new AbstractSink() {
          @Override
          public void put(Object obj, Detachable sub) {
            Session session = (Session) obj;
            auth.logout(session.getContext());
          }
        });
      }
      `
    },
    {
      name: 'updateUCJs',
      args: 'X x, User user, LifecycleState state',
      javaCode: `
      // NOTE: put to bareUserCapabilityJunctionDAO to prevent rules on
      // userCapabilityJunctionDAO from firing which could invoke sudo-ing
      // as the deleted user then fails.
      DAO dao = (DAO) x.get("bareUserCapabilityJunctionDAO");
      dao = dao.where(EQ(UserCapabilityJunction.SOURCE_ID, user.getId()));
      dao.select(
        new UserLifecycleTicketSink(x, state, "bareUserCapabilityJunctionDAO"));
      `
    },
    {
      name: 'updateCredentials',
      args: 'X x, User user, LifecycleState state',
      javaCode: `
      user.getCredentials(x).select(
        new UserLifecycleTicketSink(x, state, "credentialDAO"));
      `
    },
    {
      name: 'updateReferralCodes',
      args: 'X x, User user, LifecycleState state',
      javaCode: `
      user.getReferralCodes(x).select(
        new UserLifecycleTicketSink(x, state, "referralCodeDAO"));
      `
    },
    {
      name: 'updateDocuments',
      args: 'X x, User user, LifecycleState state',
      javaCode: `
      // user.getRepoDocuments()
      `
    },
    {
      name: 'updatePushRegistrations',
      args: 'X x, User user, LifecycleState state',
      javaCode: `
      user.getPushRegistrations(x).select(
        new UserLifecycleTicketSink(x, state, "pushRegistrationDAO"));
      `
    },
  ]
});
