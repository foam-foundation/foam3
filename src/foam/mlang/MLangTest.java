/**
 * @license
 * Copyright 2018 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.mlang;

import foam.lang.X;
import foam.core.auth.*;
import foam.mlang.predicate.Eq;
import static foam.mlang.MLang.*;

public class MLangTest
  extends foam.core.test.Test
{
  public void runTest(X x) {
    // Test INSTANCE_OF
    test(
      INSTANCE_OF(User.class).f(new User()),
      "INSTANCE_OF detects instance with class");

    test(
      ! INSTANCE_OF(User.class).f(new Group()),
      "INSTANCE_OF rejects non instance with class");

    test(
      INSTANCE_OF(User.getOwnClassInfo()).f(new User()),
      "INSTANCE_OF detects instance with ClassInfo");

    test(
      ! INSTANCE_OF(User.getOwnClassInfo()).f(new Group()),
      "INSTANCE_OF rejects non instance with ClassInfo");

    // IN over a property whose value is a list asks whether the list holds the value.
    User tagged = new User();
    tagged.setDisabledTopics(new String[] { "tag1", "tag2" });

    // A single value, which is what the query parser builds for `topics HAS tag1`.
    test(
      IN(User.DISABLED_TOPICS, "tag1").f(tagged),
      "IN matches a value the array holds");

    test(
      ! IN(User.DISABLED_TOPICS, "tag9").f(tagged),
      "IN rejects a value the array lacks");

    test(
      IN(User.DISABLED_TOPICS, new Object[] { "tag2", "tag9" }).f(tagged),
      "IN matches when the array holds one of the candidates");

    test(
      ! IN(User.DISABLED_TOPICS, new Object[] { "tag8", "tag9" }).f(tagged),
      "IN rejects when the array holds none of the candidates");

    test(
      ! IN(User.DISABLED_TOPICS, "tag1").f(new User()),
      "IN rejects an empty array");

    // partialEval turns IN with one candidate into EQ. On a list-valued
    // property EQ would compare the whole list to the candidate, so IN stays.
    // A Constant holding the array is what the JSON parser hands the server
    // for a query built on the client; an ArrayConstant is never collapsed.
    test(
      IN(User.DISABLED_TOPICS, new Constant(new Object[] { "tag1" }))
        .partialEval().f(tagged),
      "partialEval keeps IN over a list, one candidate the list holds");

    test(
      ! IN(User.DISABLED_TOPICS, new Constant(new Object[] { "tag9" }))
        .partialEval().f(tagged),
      "partialEval keeps IN over a list, one candidate the list lacks");

    test(
      IN(User.ID, new Constant(new Object[] { 5L })).partialEval()
        instanceof Eq,
      "partialEval still collapses IN with one candidate to EQ on a value");
  }
}
