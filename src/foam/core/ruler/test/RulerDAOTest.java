package foam.core.ruler.test;


import foam.lang.ContextAwareAgent;
import foam.lang.X;
import foam.dao.ArraySink;
import foam.dao.DAO;
import foam.dao.MDAO;
import foam.mlang.predicate.Predicate;
import foam.core.auth.LifecycleState;
import foam.core.auth.User;
import foam.core.dao.Operation;
import foam.core.ruler.*;
import foam.core.test.Test;
import foam.test.TestUtils;

import java.util.List;

import static foam.mlang.MLang.*;

public class RulerDAOTest extends Test {
  Rule rule1, rule2, rule3, rule4, rule5, rule5_async, rule6, rule6_async, rule7, rule8, rule9, rule10;
  User user1, user2;
  DAO localRuleDAO, userDAO, ruleHistoryDAO,rgDAO;
  int asyncWait = 1000;

  public void runTest(X x) {
    x = TestUtils.mockDAO(x, "localRuleDAO");
    x = TestUtils.mockDAO(x, "localUserDAO");
    x = TestUtils.mockDAO(x, "ruleHistoryDAO");

    localRuleDAO = (DAO) x.get("localRuleDAO");
    userDAO = new RulerDAO(x, (DAO) x.get("localUserDAO"), "localUserDAO");
    ruleHistoryDAO = (DAO) x.get("ruleHistoryDAO");
    RuleGroup rg = new RuleGroup();
    rg.setId("users:email filter");
    rgDAO = ((DAO) (x.get("ruleGroupDAO")));
    rgDAO.put(rg);
    RuleGroup rg2 = new RuleGroup();
    rg2.setId("users:change lastName");
    rgDAO.put(rg2);
    createRule(x);
    testUsers(x);
    testRuleHistory(x);
    testUpdatedRule(x);
    removeData(x);
    testCompositeRuleAction(x);
    removeData(x);
    testAfterRules(x);
    testThrowingRuleBlocksPut(x);
    testAgencyThrowBlocksPut(x);
    testNoAfterRuleWritesOnce(x);
  }

  /**
   * put_ only clones a second time and deep-compares when an 'after' rule can
   * run. Both sides of that branch have to keep behaving: no rule returns the
   * object untouched, and a rule that mutates still gets written back.
   */
  public void testAfterRules(X x) {
    // Its own dao key, so the rules the rest of this test registers against
    // localUserDAO cannot reach it and 'no after rule' really means none.
    DAO afterDAO = new RulerDAO(x, new MDAO(User.getOwnClassInfo()), "afterUserDAO");

    // Nothing targets this dao key yet, so the 'after' block has no work.
    User quiet = new User();
    quiet.setId(20);
    quiet.setFirstName("Nadia");
    quiet.setLastName("Original");
    quiet = (User) afterDAO.put_(x, quiet);
    test(quiet != null, "A put with no 'after' rule returns the object");
    test(quiet.getLastName().equals("Original"),
      "A put with no 'after' rule returns it unchanged");

    RuleGroup rg = new RuleGroup();
    rg.setId("users:after rule");
    rgDAO.put(rg);

    Rule afterRule = new Rule();
    afterRule.setId("after1");
    afterRule.setName("rule. after rule renames");
    afterRule.setRuleGroup("users:after rule");
    afterRule.setDaoKey("afterUserDAO");
    afterRule.setOperation(Operation.CREATE);
    afterRule.setAfter(true);
    afterRule.setLifecycleState(LifecycleState.ACTIVE);
    afterRule.setAction((x1, obj, oldObj, ruler, rule, agent) -> ((User) obj).setLastName("Renamed"));
    afterRule = (Rule) localRuleDAO.put_(x, afterRule);

    User renamed = new User();
    renamed.setId(21);
    renamed.setFirstName("Omar");
    renamed.setLastName("Original");
    renamed = (User) afterDAO.put_(x, renamed);
    test(renamed.getLastName().equals("Renamed"),
      "An 'after' rule mutation shows on the returned object");

    // The mutation happens on a clone, so it only survives if put_ noticed the
    // change and wrote it back to the delegate.
    User found = (User) afterDAO.find_(x, 21L);
    test(found != null && found.getLastName().equals("Renamed"),
      "An 'after' rule mutation is written back to the delegate");

    localRuleDAO.remove_(x, afterRule);
  }

  /**
   * A rule that throws has to stop the put. The 'before' phase runs ahead of
   * the delegate put, so nothing may reach the delegate.
   */
  public void testThrowingRuleBlocksPut(X x) {
    DAO throwDAO = new RulerDAO(x, new MDAO(User.getOwnClassInfo()), "throwUserDAO");

    RuleGroup rg = new RuleGroup();
    rg.setId("users:throwing rule");
    rgDAO.put(rg);

    Rule thrower = new Rule();
    thrower.setId("throw1");
    thrower.setName("rule. before rule rejects the put");
    thrower.setRuleGroup("users:throwing rule");
    thrower.setDaoKey("throwUserDAO");
    thrower.setOperation(Operation.CREATE);
    // Both defaults, spelled out: the rule runs ahead of the delegate put and
    // its action runs inline, so the exception reaches the caller of put().
    thrower.setAfter(false);
    thrower.setAsync(false);
    thrower.setLifecycleState(LifecycleState.ACTIVE);
    thrower.setAction((x1, obj, oldObj, ruler, rule, agent) -> {
      throw new RuntimeException("rejected by rule");
    });
    thrower = (Rule) localRuleDAO.put_(x, thrower);

    User rejected = new User();
    rejected.setId(22);
    rejected.setFirstName("Yasmine");
    try {
      throwDAO.put_(x, rejected);
      test(false, "A throwing 'before' rule makes put_ throw");
    } catch ( RuntimeException e ) {
      test("rejected by rule".equals(e.getMessage()),
        "A throwing 'before' rule makes put_ throw: " + e.getMessage());
    }
    test(throwDAO.find_(x, 22L) == null,
      "A throwing 'before' rule leaves nothing in the delegate");

    localRuleDAO.remove_(x, thrower);

    // An 'after' rule runs once the delegate already holds the object, so the
    // same throw cannot unwind the write. Pinned here so a change to that
    // ordering shows up as a test failure rather than as stored rows.
    Rule lateThrower = new Rule();
    lateThrower.setId("throw2");
    lateThrower.setName("rule. after rule throws");
    lateThrower.setRuleGroup("users:throwing rule");
    lateThrower.setDaoKey("throwUserDAO");
    lateThrower.setOperation(Operation.CREATE);
    lateThrower.setAfter(true);
    lateThrower.setAsync(false);
    lateThrower.setLifecycleState(LifecycleState.ACTIVE);
    lateThrower.setAction((x1, obj, oldObj, ruler, rule, agent) -> {
      throw new RuntimeException("too late");
    });
    lateThrower = (Rule) localRuleDAO.put_(x, lateThrower);

    User late = new User();
    late.setId(24);
    late.setFirstName("Selim");
    try {
      throwDAO.put_(x, late);
      test(false, "A throwing 'after' rule makes put_ throw");
    } catch ( RuntimeException e ) {
      test("too late".equals(e.getMessage()),
        "A throwing 'after' rule makes put_ throw: " + e.getMessage());
    }
    test(throwDAO.find_(x, 24L) != null,
      "A throwing 'after' rule leaves the delegate write in place");

    localRuleDAO.remove_(x, lateThrower);
  }

  /**
   * An action that hands its work to the agency runs where the agency runs it,
   * not inline, so its exception surfaces after the action returns. It still
   * has to reach the caller: a rule that fails is a put that failed, however
   * the action chose to run its work.
   */
  public void testAgencyThrowBlocksPut(X x) {
    DAO agencyDAO = new RulerDAO(x, new MDAO(User.getOwnClassInfo()), "agencyUserDAO");

    RuleGroup rg = new RuleGroup();
    rg.setId("users:agency rule");
    rgDAO.put(rg);

    Rule agencyRule = new Rule();
    agencyRule.setId("agency1");
    agencyRule.setName("rule. action throws inside the agency");
    agencyRule.setRuleGroup("users:agency rule");
    agencyRule.setDaoKey("agencyUserDAO");
    agencyRule.setOperation(Operation.CREATE);
    agencyRule.setAfter(false);
    agencyRule.setAsync(false);
    agencyRule.setLifecycleState(LifecycleState.ACTIVE);
    agencyRule.setAction((x1, obj, oldObj, ruler, rule, agency) ->
      agency.submit(x1, y -> { throw new RuntimeException("thrown in the agency"); }, "throwing agent"));
    agencyRule = (Rule) localRuleDAO.put_(x, agencyRule);

    User submitted = new User();
    submitted.setId(25);
    submitted.setFirstName("Hala");
    try {
      agencyDAO.put_(x, submitted);
      test(false, "An agency exception makes put_ throw");
    } catch ( RuntimeException e ) {
      Throwable cause = e.getCause();
      test(cause != null && "thrown in the agency".equals(cause.getMessage()),
        "An agency exception makes put_ throw, carrying the cause: " + ( cause == null ? "no cause" : cause.getMessage() ));
    }
    // The agency runs as the 'before' phase finishes, so the throw still lands
    // ahead of the delegate write.
    test(agencyDAO.find_(x, 25L) == null,
      "An agency exception leaves nothing in the delegate");

    localRuleDAO.remove_(x, agencyRule);
  }

  /**
   * With no 'after' rule there is nothing to write back, so the delegate must
   * see exactly one put. put_ decides that by cloning the result and deep
   * comparing it, which only answers 'unchanged' while a property setter is
   * idempotent - a setter that rewrites its value on every set (a Date
   * normalized with a division that rounds the wrong way for pre-epoch
   * values, say) makes the clone differ from its source and every put write
   * twice.
   */
  public void testNoAfterRuleWritesOnce(X x) {
    CountingDAO counting = new CountingDAO(new MDAO(User.getOwnClassInfo()));
    DAO countDAO = new RulerDAO(x, counting, "countUserDAO");

    User u = new User();
    u.setId(23);
    u.setFirstName("Tarek");
    // 1900-01-01: getTime() is negative, where a truncating day floor rounds
    // toward zero instead of down.
    u.setBirthday(new java.util.Date(-2208988800000L));

    test(u.equals(u.fclone()), "A pre-epoch Date survives fclone unchanged");

    counting.puts = 0;
    User ret = (User) countDAO.put_(x, u);
    test(counting.puts == 1,
      "A put with no 'after' rule reaches the delegate once, was " + counting.puts);

    User found = (User) countDAO.find_(x, 23L);
    test(found != null && found.getBirthday().equals(ret.getBirthday()),
      "put_ returns the Date the delegate stored");

    // Re-putting what came back must not move the value either.
    counting.puts = 0;
    User again = (User) countDAO.put_(x, found);
    test(again.getBirthday().equals(found.getBirthday()),
      "Re-putting the stored object leaves its Date alone");
    test(counting.puts == 1,
      "Re-putting with no 'after' rule reaches the delegate once, was " + counting.puts);
  }

  /** Counts the puts that make it past the ruler. */
  static class CountingDAO extends foam.dao.ProxyDAO {
    int puts = 0;

    CountingDAO(DAO delegate) {
      setDelegate(delegate);
    }

    @Override
    public foam.lang.FObject put_(X x, foam.lang.FObject obj) {
      puts++;
      return getDelegate().put_(x, obj);
    }
  }

  public void testUsers(X x) {
    user1 = new User();
    user1.setId(10);
    user1.setFirstName("Kristina");
    user1.setEmail("core@core.net");
    user1 = (User) userDAO.put_(x, user1).fclone();
    test(user1 instanceof User, "No exception thrown: first rule prevented execution of the rule 3, and rule 7 with erroneous predicate is not executed.");
    //test
    test(user1.getEmail().equals("foam@core.net"), "RulerDAO changes the email for passed user object");
    test(user1.getLastName().equals("Smirnova"), "the last rule updated user's last name");
    user1.setEmail("core@core.net");
    user1 = (User) userDAO.put_(x, user1);
    test(user1.getEmail().equals("core@core.net"), "user's email is core@core.net: on object update 'create' rules are not executed");
    test(user1.getLastName().equals("Unknown"), "user's lastName is 'Unknown': update rule was executed");
    test(user1.getEmailVerified(), "Set emailVerified to true in rule 9");
    Rule executeRule = (Rule) localRuleDAO.find(EQ(foam.core.ruler.Rule.NAME, "executeRule"));
    test(executeRule != null, "Test rule from executor was added successfully");
    test(executeRule.getRuleGroup().equals("fake test group"), "Test rule's group name is fake test group.");

    int i = 0;
    while ( i++ < 10 ) {
      // wait for async
      try {
        Thread.sleep(asyncWait + 100);
      } catch (InterruptedException e) {
        break;
      }

      user1 = (User) userDAO.find(user1.getId());
      if ( user1.getLastName().equals("Smith") ) {
        break;
      }
    }
    test(user1.getLastName().equals("Smith"), "user's lastName is 'Smith': async update rule was executed. "+user1.getLastName());
  }

  public void testRuleHistory(X x) {
    user2 = new User();
    user2.setId(11);
    user2.setEmail("user2@core.net");
    user2 = (User) userDAO.put_(x, user2).fclone();
    user2.setLastName("Smith");
    user2 = (User) userDAO.put_(x, user2);
    // test
    List list = ((ArraySink) ruleHistoryDAO.select(new ArraySink())).getArray();
    RuleHistory ruleHistory = (RuleHistory) list.get(0);
    test(list.size() == 1 && ruleHistory.getResult().equals("Pending"),
      "Create rule history with result = Pending in rule 6 action"
    );

    // wait for async
    try {
      for (int i = 0; i < 2000; i++) {
        Thread.sleep(asyncWait + 100);
        ruleHistory = (RuleHistory) ruleHistoryDAO.find(ruleHistory.getId());
        if ( ! ruleHistory.getResult().equals("Pending") )
          break;
      }
    } catch (InterruptedException e) { }
    test(ruleHistory.getResult().equals("Done"),
      "Expected: Update rule history result = Done in rule 6 async action. Actual: " + ruleHistory.getResult()
    );
  }

  public void testCompositeRuleAction(X x){
    rule10 = (Rule) rule2.fclone();
    rule10.setId("10");
    rule10.setName("rule10. composite rule action");
    //test null array of rule actions
    CompositeRuleAction compositeAction = new CompositeRuleAction();
    Predicate pred10 = EQ(DOT(NEW_OBJ, foam.core.auth.User.EMAIL), "core@core.net");
    rule10.setPredicate(pred10);
    rule10.setOperation(Operation.CREATE_OR_UPDATE);
    rule10.setLifecycleState(LifecycleState.ACTIVE);

    // test array of 1 action
    RuleAction[] actions = new RuleAction[1];
    RuleAction r1 = (x12, obj, oldObj, ruler, rule10, agent) -> {
      User user = (User) obj;
      user.setEmail("action1"+user.getEmail());
    };
    actions[0] = r1;
    compositeAction.setRuleActions(actions);
    rule10.setAction(compositeAction);
    localRuleDAO.put(rule10);
    user1.setEmail("core@core.net");
    user1 = (User) userDAO.put_(x, user1).fclone();
    test(user1.getEmail().equals("action1core@core.net"), "one rule action changed user email as expected: "+ user1.getEmail());

    //test array of 2 actions
    actions = new RuleAction[2];
    actions[0] = r1;
    actions[1] = (x12, obj, oldObj, ruler, rule10, agent) -> {
      User user = (User) obj;
      user.setEmail("action2"+user.getEmail());
    };
    compositeAction.setRuleActions(actions);
    rule10.setAction(compositeAction);
    localRuleDAO.put(rule10);
    user1.setEmail("core@core.net");
    user1 = (User) userDAO.put_(x, user1).fclone();
    test(user1.getEmail().equals("action2action1core@core.net"), "Both rule actions changed user email as expected: "+user1.getEmail());
  }

  public void testUpdatedRule(X x) {

    //the rule with the highest priority in "users:email filter" group and stops execution of the rest.
    rule7 = new Rule();
    rule7.setId("7");
    rule7.setName("rule7. userDAO email filter");
    rule7.setRuleGroup("users:email filter");
    rule7.setDaoKey("localUserDAO");
    rule7.setOperation(Operation.CREATE);
    rule7.setAfter(false);
    rule7.setPriority(100);
    rule7.setLifecycleState(LifecycleState.ACTIVE);
    RuleAction action7 = (x1, obj, oldObj, ruler, rule7, agent) -> ruler.stop();
    rule7.setAction(action7);
    rule7 = (Rule) localRuleDAO.put_(x, rule7);

    user1 = new User();
    user1.setId(12);
    user1.setFirstName("Kristina");
    user1.setLastName("Smir");
    user1.setEmail("core@core.net");
    user1 = (User) userDAO.put_(x, user1).fclone();
    test(user1.getEmail().equals("core@core.net"), "new rule stops execution of others within `userDAO email filter` group. " +
    " Email is not upated");
    test(user1.getLastName().equals("Smirnova"), "Last name was updated based on the rule4 from a different group");

    localRuleDAO.remove_(x, rule4);
    localRuleDAO.remove_(x, rule5);

    user1.setLastName("foam");
    user1 = (User) userDAO.put_(x, user1).fclone();
    test(user1.getLastName().equals("foam"), "Last name is not updated after rules were removed");
  }

  public void createRule(X x) {
    // first rule stops execution of rules with a lower priority within the same group
    rule1 = new Rule();
    rule1.setId("1");
    rule1.setName("rule1. userDAO email filter");
    rule1.setRuleGroup("users:email filter");
    rule1.setDaoKey("localUserDAO");
    rule1.setOperation(Operation.CREATE);
    rule1.setAfter(false);
    rule1.setPriority(60);
    RuleAction action1 = (x1, obj, oldObj, ruler, rule1, agent) -> ruler.stop();
    rule1.setAction(action1);
    rule1.setLifecycleState(LifecycleState.ACTIVE);
    rule1 = (Rule) localRuleDAO.put_(x, rule1);

    //the rule has a higher priority than the first rule, changes user's email from core@core.net to foam@core.net
    rule2 = new Rule();
    rule2.setId("2");
    rule2.setName("rule2. userDAO email filter");
    rule2.setRuleGroup("users:email filter");
    rule2.setDaoKey("localUserDAO");
    rule2.setOperation(Operation.CREATE);
    rule2.setLifecycleState(LifecycleState.ACTIVE);
    rule2.setAfter(false);
    rule2.setPriority(80);
    Predicate predicate2 = AND(
      EQ(DOT(NEW_OBJ, foam.core.auth.User.EMAIL), "core@core.net"),
      EQ(DOT(NEW_OBJ, INSTANCE_OF(foam.core.auth.User.class)), true)
    );
    rule2.setPredicate(predicate2);
    RuleAction action2 = (x12, obj, oldObj, ruler, rule2, agent) -> {
      User user = (User) obj;
      user.setEmail("foam@core.net");
    };
    rule2.setAction(action2);
    rule2 = (Rule) localRuleDAO.put_(x, rule2);

    //the rule has lower priority than the first one => should never be executed
    rule3 = new Rule();
    rule3.setId("3");
    rule3.setName("rule3. userDAO email filter");
    rule3.setRuleGroup("users:email filter");
    rule3.setDaoKey("localUserDAO");
    rule3.setOperation(Operation.CREATE);
    rule3.setLifecycleState(LifecycleState.ACTIVE);
    rule3.setAfter(false);
    rule3.setPriority(20);
    RuleAction action3 = (x14, obj, oldObj, ruler, rule3, agent) -> {
      throw new RuntimeException("this rule is not supposed to be executed");
    };
    rule3.setAction(action3);
    rule3 = (Rule) localRuleDAO.put_(x, rule3);

    //the rule has lower priority than the first one but has different group so should be executed
    rule4 = new Rule();
    rule4.setId("4");
    rule4.setName("rule4. userDAO lastName filter");
    rule4.setRuleGroup("users:change lastName");
    rule4.setDaoKey("localUserDAO");
    rule4.setOperation(Operation.CREATE);
    rule4.setAfter(false);
    rule4.setPriority(10);
    rule4.setLifecycleState(LifecycleState.ACTIVE);
    Predicate predicate4 = EQ(DOT(NEW_OBJ, INSTANCE_OF(foam.core.auth.User.class)), true);
    rule4.setPredicate(predicate4);
    RuleAction action4 = (x15, obj, oldObj, ruler, rule4, agent) -> {
      User user = (User) obj;
      user.setLastName("Smirnova");
    };
    rule4.setAction(action4);
    rule4 = (Rule) localRuleDAO.put_(x, rule4);

    //the rule has lower priority than the first one but has different group so should be executed
    rule5 = new Rule();
    rule5.setId("5");
    rule5.setName("rule5. userDAO lastName filter");
    rule5.setRuleGroup("users:change lastName");
    rule5.setDaoKey("localUserDAO");
    rule5.setOperation(Operation.UPDATE);
    rule5.setAfter(false);
    rule5.setLifecycleState(LifecycleState.ACTIVE);
    Predicate predicate5 = AND(
      EQ(DOT(NEW_OBJ, INSTANCE_OF(foam.core.auth.User.class)), true),
      NEQ(DOT(NEW_OBJ, User.LAST_NAME), "Smith")
    );
    rule5.setPredicate(predicate5);
    RuleAction action5 = (x17, obj, oldObj, ruler, rule5, agency) -> {
      User user = (User) obj;
      user.setLastName("Unknown");
      Rule executeRule = new Rule();
      executeRule.setId("100");
      executeRule.setName("executeRule");
      RuleGroup rg = new RuleGroup();
      rg.setId("fake test group");
      rgDAO.put(rg);
      executeRule.setRuleGroup("fake test group");
      executeRule.setDaoKey("fakeDaoKey");
      agency.submit(x, new ContextAwareAgent() {
        @Override
        public void execute(X x) {
          localRuleDAO.put(executeRule);
        }
      }, "RulerDAOTest add fake rule");

    };
    rule5.setAction(action5);
    rule5 = (Rule) localRuleDAO.put_(x, rule5);

    rule5_async = (Rule) rule5.fclone();
    rule5_async.setId("5_async");
    rule5_async.setAsync(true);
    RuleAction asyncAction5 = (x18, obj, oldObj, ruler, rule5, agent) -> {
      // simulate async
      try {
        Thread.sleep(asyncWait);
      } catch (InterruptedException e) { }

      User user = (User) obj;
      user.setLastName("Smith");
      userDAO.put(user);
    };
    rule5_async.setAction(asyncAction5);
    rule5_async = (Rule) localRuleDAO.put_(x, rule5_async);

    //the rule only applied to user2
    rule6 = new Rule();
    RuleGroup rg = new RuleGroup();
    rg.setId("user2 update");
    rgDAO.put(rg);
    rule6.setId("6");
    rule6.setName("rule6. user2 update");
    rule6.setRuleGroup("user2 update");
    rule6.setDaoKey("localUserDAO");
    rule6.setOperation(Operation.UPDATE);
    rule6.setSaveHistory(true);
    rule6.setLifecycleState(LifecycleState.ACTIVE);
    rule6.setPredicate(EQ(DOT(NEW_OBJ, foam.core.auth.User.EMAIL), "user2@core.net"));
    RuleAction action6 = (x19, obj, oldObj, ruler, rule6, agent) -> ruler.putResult(rule6.getId(), "Pending");
    rule6.setAction(action6);
    rule6 = (Rule) localRuleDAO.put_(x, rule6);

    rule6_async = (Rule) rule6.fclone();
    rule6_async.setId("6_async");
    rule6_async.setAsync(true);
    RuleAction asyncAction6 = (x110, obj, oldObj, ruler, rule6, agent) -> {
      // simulate async
      try {
        Thread.sleep(asyncWait);
      } catch (InterruptedException e) { }

      ruler.putResult(rule6_async.getId(), "Done");
    };
    rule6_async.setAction(asyncAction6);
    rule6_async = (Rule) localRuleDAO.put_(x, rule6_async);

    //the rule with erroneous predicate
    rule8 = new Rule();
    rule8.setId("8");
    rule8.setName("rule8. Erroneous rule predicate");
    RuleGroup rg2 = new RuleGroup();
    rg2.setId("user created");
    rgDAO.put(rg2);
    rule8.setRuleGroup("user created");
    rule8.setDaoKey("localUserDAO");
    rule8.setOperation(Operation.CREATE);
    rule8.setAfter(false);
    rule8.setLifecycleState(LifecycleState.ACTIVE);
    rule8.setPredicate(new DummyErroneousPredicate());
    RuleAction action8 = (x111, obj, oldObj, ruler, rule8, agent) -> ruler.stop();
    rule8.setAction(action8);
    rule8 = (Rule) localRuleDAO.put_(x, rule8);

    //the rule with FObject predicate
    rule9 = new Rule();
    rule9.setId("9");
    rule9.setName("rule9. FObject rule predicate");
    RuleGroup rg3 = new RuleGroup();
    rg3.setId("user updated");
    rgDAO.put(rg3);
    rule9.setRuleGroup("user updated");
    rule9.setDaoKey("localUserDAO");
    rule9.setOperation(Operation.UPDATE);
    rule9.setAfter(false);
    rule9.setPredicate(EQ(foam.core.auth.User.EMAIL, "core@core.net"));
    rule9.setLifecycleState(LifecycleState.ACTIVE);
    RuleAction action9 = (x113, obj, oldObj, ruler, rule9, agent) -> {
      User user = (User) obj;
      user.setEmailVerified(true);
    };
    rule9.setAction(action9);
    rule9 = (Rule) localRuleDAO.put_(x, rule9);
  }
  public void removeData(X x) {
    localRuleDAO.remove_(x, rule1);
    localRuleDAO.remove_(x, rule2);
    localRuleDAO.remove_(x, rule3);
    localRuleDAO.remove_(x, rule6);
    localRuleDAO.remove_(x, rule7);
    localRuleDAO.remove_(x, rule8);
    localRuleDAO.remove_(x, rule9);
    localRuleDAO.remove_(x, rule10);
    userDAO.remove_(x, user1);
    userDAO.remove_(x, user2);
  }
}
