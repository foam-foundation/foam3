/**
 * @license
 * Copyright 2018 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.mlang;

import foam.lang.X;
import foam.core.auth.*;
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
  }
}
