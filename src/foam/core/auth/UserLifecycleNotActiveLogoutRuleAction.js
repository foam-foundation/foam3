/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.auth',
  name: 'UserLifecycleNotActiveLogoutRuleAction',

  documentation: `On transition from Active, logout user.
Transition to DELETED is handled by UserLifecycleDeletedRuleAction.
Compatible with UserLifecycleTicket system, as Disable action also removes session.`,

  implements: [
    'foam.core.ruler.RuleAction'
  ],

  javaImports: [
    'foam.core.logger.Logger',
    'foam.core.logger.Loggers',
    'foam.core.session.Session',
    'foam.dao.AbstractSink',
    'foam.dao.DAO',
    'foam.dao.Sink',
    'foam.lang.ContextAgent',
    'foam.lang.Detachable',
    'foam.lang.X',
    'static foam.mlang.MLang.*'
  ],

  methods: [
    {
      name: 'applyAction',
      javaCode: `
      final Logger logger = Loggers.logger(x, this);
      agency.submit(x, new ContextAgent() {
        public void execute(X x) {
          User user = (User) obj;

          // log out by deleting session
          try {
            AuthService auth = (AuthService) x.get("auth");
              ((DAO) x.get("sessionDAO")).where(
                OR(
                  EQ(Session.USER_ID, user.getId()),
                  EQ(Session.AGENT_ID, user.getId())
                )
              ).select(new AbstractSink() {
                public void put(Object obj, Detachable sub) {
                  Session session = (Session) obj;
                  auth.logout(session.getContext());
                }
              });
          } catch (Throwable t) {
            logger.error("Failed to logout", "user", user.getId(), t);
          }
        }
      }, "UserLifecycleNotActiveLogoutRuleAction");
      `
    }
  ]
});
