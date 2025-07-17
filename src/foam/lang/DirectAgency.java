/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.lang;

import java.util.concurrent.Future;

/**
 * AsyncAgency is passed to async rule.action
 * for immediate execution of agent.
 */
public class DirectAgency extends AbstractAgency {
  public Future<?> submit(X x, ContextAgent agent, String description) {
    agent.execute(x);
    return null;
  }
}
