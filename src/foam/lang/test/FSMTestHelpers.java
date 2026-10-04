/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.lang.test;

import foam.core.auth.Subject;
import foam.core.auth.User;
import foam.dao.DAO;
import foam.dao.FSMDAO;
import foam.dao.MDAO;
import foam.lang.PropertyInfo;
import foam.lang.StateTransition;
import foam.lang.X;

/**
 * Shared helpers for FSM/FSMDAO Java regression tests.
 *
 * Use a fresh helper-built DAO per test so state is fully isolated.
 */
public class FSMTestHelpers {

  /** Build an FSMDAO wrapping an in-memory MDAO of TestStateMachineHolder. */
  public static DAO buildFSMDAO(X x) {
    DAO mdao = new MDAO(TestStateMachineHolder.getOwnClassInfo());
    PropertyInfo prop = (PropertyInfo)
      TestStateMachineHolder.getOwnClassInfo().getAxiomByName("status");
    return new FSMDAO(x, prop, mdao);
  }

  /** Build a Subject with a User authorized for one permission string. */
  public static Subject subjectWithPermission(X x, final String allowed) {
    User u = new User.Builder(x).setId(101L).setUserName("test-user").build();
    return new Subject.Builder(x).setUser(u).setRealUser(u).build();
  }

  /** Assert history array has exactly the from/to pairs expected. */
  public static void assertHistoryEquals(
    foam.core.test.Test t, StateTransition[] history, String[][] expected
  ) {
    t.test(history.length == expected.length,
      "history length: expected " + expected.length + " got " + history.length);
    for ( int i = 0 ; i < expected.length && i < history.length ; i++ ) {
      String from = expected[i][0], to = expected[i][1];
      t.test(from.equals(history[i].getFrom()) && to.equals(history[i].getTo()),
        "history[" + i + "]: expected " + from + "→" + to +
        ", got " + history[i].getFrom() + "→" + history[i].getTo());
    }
  }
}
