/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */
foam.CLASS({
  package: 'foam.core.crunch.ruler',
  name: 'UserCapabilityTicketRuleAction',

  documentation: 'Grant Capability to User',

  implements: [
    'foam.core.ruler.RuleAction'
  ],

  javaImports: [
    'foam.lang.ContextAgent',
    'foam.lang.X',
    'foam.dao.DAO',
    'foam.core.auth.User',
    'foam.core.auth.Subject',
    'foam.core.crunch.CapabilityJunctionStatus',
    'foam.core.crunch.UserCapabilityTicket',
    'foam.core.crunch.CrunchService'
  ],

  methods: [
    {
      name: 'applyAction',
      javaCode: `
        agency.submit(x, new ContextAgent() {
          @Override
          public void execute(X x) {
            UserCapabilityTicket ticket = (UserCapabilityTicket) obj;
            CrunchService crunchService = (CrunchService) x.get("crunchService");
            DAO dao = (DAO) x.get("userDAO");

            for ( var id : ticket.getCreatedForUsers() ) {
              User user = (User) dao.find(id);
              Subject sub = new Subject(user);
              crunchService.updateUserJunction(x, sub, ticket.getCapability(), null, CapabilityJunctionStatus.GRANTED);
            }

            ticket.setStatus("CLOSED");
          }
        }, "UserCapabilityTicketRuleAction");
      `
    }
  ]
})
