package foam.core.ruler.test;


import foam.lang.X;
import foam.dao.DAO;
import foam.core.auth.LifecycleState;
import foam.core.auth.User;
import foam.core.dao.Operation;
import foam.core.ruler.Rule;
import foam.core.ruler.RuleAction;
import foam.core.ruler.RuleGroup;
import foam.core.ruler.RulerDAO;
import foam.core.test.Test;
import foam.test.TestUtils;

import java.util.concurrent.atomic.AtomicInteger;

import static foam.mlang.MLang.*;

/**
 * Verifies that the RulerDAO rule cache (UpdateRulesListSink) correctly
 * evicts stale entries when a rule's bucket-defining properties change.
 *
 * The cache has 9 buckets keyed by (operation, after, async). A rule
 * lives in every bucket whose predicate matches it. When a property
 * shifts the rule out of a bucket, the old entry must be removed —
 * otherwise the rule keeps firing on operations the user never asked for.
 *
 * Each sub-test isolates itself via a per-test rule predicate that filters
 * on the user's email. A stale rule leaked from one sub-test cannot fire
 * on another sub-test's user, so failures point at the bug under test.
 */
public class RulerCacheEvictionTest extends Test {

  public void runTest(X x) {
    x = TestUtils.mockDAO(x, "localRuleDAO");
    x = TestUtils.mockDAO(x, "localUserDAO");
    x = TestUtils.mockDAO(x, "ruleHistoryDAO");

    DAO localRuleDAO = (DAO) x.get("localRuleDAO");
    DAO userDAO      = new RulerDAO(x, (DAO) x.get("localUserDAO"), "localUserDAO");
    DAO rgDAO        = (DAO) x.get("ruleGroupDAO");

    testOperationNarrowing(x, localRuleDAO, userDAO, rgDAO);
    testAfterToggle(x, localRuleDAO, userDAO, rgDAO);
    testRuleGroupChange(x, localRuleDAO, userDAO, rgDAO);
    testLifecycleStateDeleted(x, localRuleDAO, userDAO, rgDAO);
  }

  /**
   * Bug: rule with operation=CREATE_OR_UPDATE is cached in BOTH the
   * createBefore and updateBefore buckets. Narrowing to operation=CREATE
   * must remove the stale entry from updateBefore.
   */
  public void testOperationNarrowing(X x, DAO localRuleDAO, DAO userDAO, DAO rgDAO) {
    RuleGroup g = new RuleGroup(); g.setId("op-narrow-group"); rgDAO.put(g);
    AtomicInteger count = new AtomicInteger(0);
    String email = "op-narrow@core.net";

    Rule r = makeCountingRule("op-narrow", "op-narrow-group", Operation.CREATE_OR_UPDATE, false, email, count);
    localRuleDAO.put_(x, r);

    User u = new User(); u.setId(2001); u.setEmail(email);
    u = (User) userDAO.put_(x, u).fclone();          // CREATE
    u = (User) userDAO.put_(x, u).fclone();          // UPDATE
    test(count.get() == 2,
      "[op-narrow] sanity: CREATE_OR_UPDATE fires on both CREATE and UPDATE; got=" + count.get());

    count.set(0);
    r.setOperation(Operation.CREATE);
    localRuleDAO.put_(x, r);

    u = (User) userDAO.put_(x, u).fclone();          // UPDATE
    test(count.get() == 0,
      "[op-narrow] narrowed rule MUST NOT fire on UPDATE; got count=" + count.get()
        + " (stale entry left in updateBefore bucket)");

    localRuleDAO.remove_(x, r);
    userDAO.remove_(x, u);
  }

  /**
   * Bug: rule with after=false is cached in updateBefore. Toggling to
   * after=true must remove the stale entry from updateBefore. Otherwise
   * the rule fires twice (once before, once after) on every UPDATE.
   */
  public void testAfterToggle(X x, DAO localRuleDAO, DAO userDAO, DAO rgDAO) {
    RuleGroup g = new RuleGroup(); g.setId("after-toggle-group"); rgDAO.put(g);
    AtomicInteger count = new AtomicInteger(0);
    String email = "after-toggle@core.net";

    Rule r = makeCountingRule("after-toggle", "after-toggle-group", Operation.UPDATE, false, email, count);
    localRuleDAO.put_(x, r);

    User u = new User(); u.setId(2002); u.setEmail(email);
    u = (User) userDAO.put_(x, u).fclone();          // CREATE - rule scoped to UPDATE, no fire
    u = (User) userDAO.put_(x, u).fclone();          // UPDATE - fires once (before)
    test(count.get() == 1,
      "[after-toggle] sanity: before-rule fires once on UPDATE; got=" + count.get());

    count.set(0);
    r.setAfter(true);
    localRuleDAO.put_(x, r);

    u = (User) userDAO.put_(x, u).fclone();          // UPDATE - should fire once (after only)
    test(count.get() == 1,
      "[after-toggle] toggled rule must fire EXACTLY ONCE (after-only) on UPDATE; got=" + count.get()
        + " (stale entry left in updateBefore bucket — rule firing twice)");

    localRuleDAO.remove_(x, r);
    userDAO.remove_(x, u);
  }

  /**
   * Bug: changing ruleGroup must remove the rule from the old group's
   * entry in every bucket. Otherwise the rule fires twice — once under
   * the old group (stale) and once under the new group (current).
   */
  public void testRuleGroupChange(X x, DAO localRuleDAO, DAO userDAO, DAO rgDAO) {
    RuleGroup gA = new RuleGroup(); gA.setId("group-change-A"); rgDAO.put(gA);
    RuleGroup gB = new RuleGroup(); gB.setId("group-change-B"); rgDAO.put(gB);
    AtomicInteger count = new AtomicInteger(0);
    String email = "group-change@core.net";

    Rule r = makeCountingRule("group-change", "group-change-A", Operation.UPDATE, false, email, count);
    localRuleDAO.put_(x, r);

    User u = new User(); u.setId(2003); u.setEmail(email);
    u = (User) userDAO.put_(x, u).fclone();          // CREATE
    u = (User) userDAO.put_(x, u).fclone();          // UPDATE - fires under group A
    test(count.get() == 1,
      "[group-change] sanity: rule fires once under group A; got=" + count.get());

    count.set(0);
    r.setRuleGroup("group-change-B");
    localRuleDAO.put_(x, r);

    u = (User) userDAO.put_(x, u).fclone();          // UPDATE - should fire once under group B
    test(count.get() == 1,
      "[group-change] rule must fire EXACTLY ONCE after group move; got=" + count.get()
        + " (stale entry left in old group — rule firing in both groups)");

    localRuleDAO.remove_(x, r);
    userDAO.remove_(x, u);
  }

  /**
   * Bug: setting lifecycleState=DELETED via put_ (rather than remove_)
   * must evict the rule from the cache. The current Dec-2025 fix handles
   * this for buckets where the predicate still matches; this test pins
   * that behavior so the upcoming refactor doesn't regress it.
   */
  public void testLifecycleStateDeleted(X x, DAO localRuleDAO, DAO userDAO, DAO rgDAO) {
    RuleGroup g = new RuleGroup(); g.setId("lc-deleted-group"); rgDAO.put(g);
    AtomicInteger count = new AtomicInteger(0);
    String email = "lc-deleted@core.net";

    Rule r = makeCountingRule("lc-deleted", "lc-deleted-group", Operation.UPDATE, false, email, count);
    localRuleDAO.put_(x, r);

    User u = new User(); u.setId(2004); u.setEmail(email);
    u = (User) userDAO.put_(x, u).fclone();          // CREATE
    u = (User) userDAO.put_(x, u).fclone();          // UPDATE - fires
    test(count.get() == 1,
      "[lc-deleted] sanity: ACTIVE rule fires; got=" + count.get());

    count.set(0);
    r.setLifecycleState(LifecycleState.DELETED);
    localRuleDAO.put_(x, r);

    u = (User) userDAO.put_(x, u).fclone();          // UPDATE - should NOT fire
    test(count.get() == 0,
      "[lc-deleted] soft-deleted rule MUST NOT fire; got=" + count.get());

    localRuleDAO.remove_(x, r);
    userDAO.remove_(x, u);
  }

  // -------- helpers --------

  private Rule makeCountingRule(String id, String group, Operation op, boolean after,
                                String targetEmail, AtomicInteger counter) {
    Rule r = new Rule();
    r.setId(id);
    r.setName(id);
    r.setRuleGroup(group);
    r.setDaoKey("localUserDAO");
    r.setOperation(op);
    r.setAfter(after);
    r.setLifecycleState(LifecycleState.ACTIVE);
    r.setPriority(50);
    r.setPredicate(EQ(DOT(NEW_OBJ, foam.core.auth.User.EMAIL), targetEmail));
    RuleAction action = (x1, obj, oldObj, ruler, rule, agent) -> counter.incrementAndGet();
    r.setAction(action);
    return r;
  }
}
