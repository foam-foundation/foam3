/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.core.ruler.test;

import foam.core.auth.LifecycleState;
import foam.core.auth.User;
import foam.core.ruler.Rule;
import foam.core.ruler.RuleAction;
import foam.core.ruler.RuleEngine;
import foam.core.test.Test;
import foam.dao.DAO;
import foam.dao.MDAO;
import foam.lang.FObject;
import foam.lang.X;
import jakarta.servlet.http.HttpServletRequest;
import java.lang.reflect.Proxy;
import java.util.concurrent.atomic.AtomicReference;

/**
 * An async rule runs after the web request that triggered it has been answered.
 * Jetty 12 ee11 throws a NullPointerException on every read of a finished
 * request, so the rule's action must see no request in its context. Here the
 * triggering context holds a request whose every read throws, as a finished one
 * does, and the async action records what it finds under HttpServletRequest.
 */
public class RuleEngineFinishedRequestTest extends Test {

  /** Runs one async rule to completion on the calling thread. */
  static class InlineAsyncRuleEngine extends RuleEngine {
    InlineAsyncRuleEngine(X userX, X systemX, DAO delegate) {
      super(userX, systemX, delegate);
    }

    void runAsync(Rule rule, FObject obj) {
      applyAsyncRule(rule, obj, null);
      asyncAgency_.execute(getX());
    }
  }

  public void runTest(X x) {
    HttpServletRequest finished = (HttpServletRequest) Proxy.newProxyInstance(
      HttpServletRequest.class.getClassLoader(),
      new Class[] { HttpServletRequest.class },
      (proxy, method, args) -> { throw new NullPointerException("finished request: " + method.getName()); });
    X userX = x.put(HttpServletRequest.class, finished);

    DAO users = new MDAO(User.getOwnClassInfo());
    User user = new User();
    user.setId(9910L);
    user.setFirstName("Async");
    users.put(user);

    AtomicReference<Object> seen = new AtomicReference<>("action did not run");
    RuleAction action = (actionX, obj, oldObj, ruler, rule, agency) -> seen.set(actionX.get(HttpServletRequest.class));

    Rule rule = new Rule();
    rule.setId("finished-request-async-rule");
    rule.setName("finished-request-async-rule");
    rule.setAsync(true);
    rule.setLifecycleState(LifecycleState.ACTIVE);
    rule.setPredicate(foam.mlang.MLang.TRUE);
    rule.setAction(action);

    try {
      new InlineAsyncRuleEngine(userX, x, users).runAsync(rule, user);
    } catch ( Throwable t ) {
      test(false, "The async rule must not fail on a finished request: " + t);
    }
    test(seen.get() == null,
      "The async rule's action sees no HttpServletRequest in its context (got " + seen.get() + ")");
  }
}
