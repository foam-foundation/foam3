/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.test',
  name: 'MergeFObjectTest',
  extends: 'foam.core.test.Test',

  documentation: `AbstractF3FileJournal.mergeFObject returns the merged old
    row when the delta has the same class, and a row of the delta's class
    carrying the old values when the class changed.`,

  javaImports: [
    'foam.core.auth.User',
    'foam.core.auth.UserLifecycleTicket',
    'foam.core.ticket.Ticket',
    'foam.dao.F3FileJournal',
    'foam.lang.FObject'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        F3FileJournal journal = new F3FileJournal(x);

        // Same class: the old row is merged in place and returned.
        User old = new User(x);
        old.setId(1);
        old.setUserName("a");
        old.setJobTitle("x");
        User diff = new User(x);
        diff.setId(1);
        diff.setJobTitle("y");
        FObject merged = journal.mergeFObject(old, diff);
        test(merged == old, "same class: the old row is returned");
        test("a".equals(old.getUserName()) && "y".equals(old.getJobTitle()), "same class: old keeps its values and takes the delta's");

        // Class changed: the row takes the delta's class and carries the old values.
        Ticket base = new Ticket(x);
        base.setId("7");
        base.setTitle("same title");
        UserLifecycleTicket sub = new UserLifecycleTicket(x);
        sub.setId("7");
        FObject changed = journal.mergeFObject(base, sub);
        test(changed instanceof UserLifecycleTicket, "class change: the delta's class wins");
        test("same title".equals(((Ticket) changed).getTitle()), "class change: the old value is carried over");
      `
    }
  ]
});
