/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.auth.test',
  name: 'UserLifecycleTicketTest',
  extends: 'foam.core.test.Test',

  documenation: `
// create user
// add ucj
// change user state - disabled
// check that ucj state also changed
// change user stage - deleted
// check all deleted - no teardown required
`,

  javaImports: [
    'foam.core.auth.*',
    'foam.core.crunch.*',
    'foam.core.logger.Loggers',
    'foam.core.ticket.Ticket',
    'foam.dao.ArraySink',
    'foam.dao.DAO',
    'foam.dao.MDAO',
    'foam.lang.X',
    'static foam.mlang.MLang.*',
    'foam.mlang.sink.Count',
    'foam.test.TestUtils',
    'foam.util.Auth',
    'java.util.List'
  ],

  methods: [
    {
      name: 'setup',
      args: 'X x',
      type: 'X',
      javaCode: `
      return x;
      `
    },
    {
      name: 'runTest',
      javaCode: `
      try {
        x = setup(x);
    DAO userDAO = (DAO) x.get("userDAO");
    DAO ticketDAO = (DAO) x.get("ticketDAO");
    DAO capabilityDAO = (DAO) x.get("capabilityDAO");
    DAO userCapabilityJunctionDAO = (DAO) x.get("userCapabilityJunctionDAO");
    DAO prerequisiteCapabilityJunctionDAO = (DAO) x.get("prerequisiteCapabilityJunctionDAO");

    User user = new User();
    user.setUserName(this.getClass().getSimpleName());
    user.setFirstName(user.getUserName());
    user.setLastName(user.getUserName());
    user.setSpid("test");
    user.setGroup("test");
    user.setEmail(user.getUserName()+"@foamdev.com");
    user.setEmailVerified(true);
    user.setLoginEnabled(true); // delete rule looking for this.
    user = (User) userDAO.put(user);

    X userX = Auth.sudo(x, user);

    Capability dep = new Capability();
    dep.setId(user.getUserName()+"-dep");

    Capability pre = new Capability();
    pre.setId(user.getUserName()+"-pre");

    dep = (Capability) capabilityDAO.put(dep);
    pre = (Capability) capabilityDAO.put(pre);

    // CapabilityCapabilityJunction ccjunction = new CapabilityCapabilityJunction();
    // ccjunction.setSourceId(dep.getId());
    // ccjunction.setTargetId(pre.getId());
    // prerequisiteCapabilityJunctionDAO.put_(userX, ccjunction);

    UserCapabilityJunction ucjunction = new UserCapabilityJunction();
    ucjunction.setSourceId(user.getId());
    ucjunction.setTargetId(dep.getId());
    userCapabilityJunctionDAO.put_(userX, ucjunction);

    List<UserCapabilityJunction> userCapabilityJunctions = (List<UserCapabilityJunction>) ((ArraySink) userCapabilityJunctionDAO
        .where(EQ(UserCapabilityJunction.SOURCE_ID, user.getId()))
        .select(new ArraySink()))
        .getArray();

    test(userCapabilityJunctions.size() > 0, "UCJs created > 0 "+userCapabilityJunctions.size());

    var ticket = new UserLifecycleTicket();
    ticket.setCreatedFor(user.getId());
    ticket.setSpid(user.getSpid());
    ticket.setRequestedLifecycleState(LifecycleState.DISABLED);
    ticket.setIncludeRelationships(true);
    ticket = (UserLifecycleTicket) ticketDAO.put(ticket).fclone();
    ticket.setStatus("CLOSED");
    ticket = (UserLifecycleTicket) ticketDAO.put(ticket);
    ticket = (UserLifecycleTicket) ticketDAO.find(ticket.getId()).fclone();
    test ( ticket.getStatus() == "CLOSED", "ticket CLOSED "+ticket.getMessage());
    test ( ticket.getUpdated().size() > 0, "ticket updated data "+ ticket.getUpdated().size());

    user = (User) ((DAO) x.get("userDAO")).find(user.getId());
    test ( user.getLifecycleState() == LifecycleState.DISABLED, "User ACTIVE -> DISABLED "+ user.getLifecycleState().toString());

    userCapabilityJunctions = (List<UserCapabilityJunction>) ((ArraySink) userCapabilityJunctionDAO
        .where(EQ(UserCapabilityJunction.SOURCE_ID, user.getId()))
        .select(new ArraySink()))
        .getArray();
    for ( UserCapabilityJunction ucj : userCapabilityJunctions ) {
      test ( ucj.getLifecycleState() == LifecycleState.DISABLED, "UCJ ACTIVE -> DISABLED "+ ucj.getLifecycleState().toString());
    }

    ticket.setRequestedLifecycleState(LifecycleState.ACTIVE);
    ticket.setRevertRelationships(true);
    ticket.setStatus("OPEN");
    ticket = (UserLifecycleTicket) ticketDAO.put(ticket).fclone();
    ticket.setStatus("CLOSED");
    ticket = (UserLifecycleTicket) ticketDAO.put(ticket).fclone();

    user = (User) ((DAO) x.get("userDAO")).find(user.getId());
    test ( user.getLifecycleState() == LifecycleState.ACTIVE, "User DISABLED -> ACTIVE "+ user.getLifecycleState().toString());

    userCapabilityJunctions = (List<UserCapabilityJunction>) ((ArraySink) userCapabilityJunctionDAO
        .where(EQ(UserCapabilityJunction.SOURCE_ID, user.getId()))
        .select(new ArraySink()))
        .getArray();
    test(userCapabilityJunctions.size() > 0, "UCJs active > 0 "+userCapabilityJunctions.size());

    // Delete in Active state - will trigger
    // 1. LifecycleAwareDAO which will map remove to put lifecycleState DELETED
    // 2. which in turn triggers UserLifecycleDeletedRuleAction to create ticket
    // and delete associated data.
    Count beforeCount = (Count) ticketDAO.select(COUNT());
    ((DAO) x.get("userDAO")).remove(user);
    user = (User) ((DAO) x.get("userDAO")).find(user.getId());
    test ( user == null || user.getLifecycleState() == LifecycleState.DELETED, "user deleted: " + (user != null ? user.getLifecycleState().toString() : "null"));

    try {
      Thread.currentThread().sleep(500);
    } catch (InterruptedException e) {
      // nop
    }

    Count afterCount = (Count) ticketDAO.select(COUNT());
    test ( ((Long)afterCount.getValue()) - ((Long)beforeCount.getValue()) == 1, "Auto generated ticket created" );
    UserLifecycleTicket triggerTicket = (UserLifecycleTicket) ticketDAO.find(AND(EQ(Ticket.CREATED_FOR, user.getId()), EQ(Ticket.TYPE, "UserLifecycleTicket")));
    test ( triggerTicket != null && ticket.getId() != triggerTicket.getId(), "Found auto generated ticket");
    if ( triggerTicket != null ) {
      test ( triggerTicket.getStatus().equals("CLOSED"), "Auto generated Ticket CLOSED "+ triggerTicket.getStatus() + " " + triggerTicket.getMessage());
    }

    userCapabilityJunctions = (List<UserCapabilityJunction>) ((ArraySink) userCapabilityJunctionDAO
        .where(EQ(UserCapabilityJunction.SOURCE_ID, user.getId()))
        .select(new ArraySink()))
        .getArray();
    for ( UserCapabilityJunction ucj : userCapabilityJunctions ) {
      test ( ucj.getLifecycleState() == LifecycleState.DELETED, "UCJ ACTIVE -> DELETED "+ ucj.getLifecycleState().toString());
    }

    capabilityDAO.remove(dep);
    capabilityDAO.remove(pre);
    ticketDAO.remove(ticket);
      } catch ( Throwable t ) {
        Loggers.logger(x, this).error(t);
      } finally {
        teardown(x);
      }
      `
    },
    {
      name: 'teardown',
      args: 'X x',
      javaCode: `
      // nop
      `
    },
  ]
});
