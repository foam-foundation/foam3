/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.lang;

import foam.core.logger.Loggers;
import foam.core.pm.PM;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

public class VirtualThreadAgency extends AbstractAgency {
  protected final ExecutorService executor_;

  public VirtualThreadAgency() {
    this("virtual-thread");
  }

  public VirtualThreadAgency(String prefix) {
    executor_ = Executors.newThreadPerTaskExecutor(
      Thread.ofVirtual().name(prefix, 0).factory()
    );
  }

  public Future<?> submit(X x, ContextAgent agent, String description) {
    return executor_.submit(new ContextAgentRunnable(x, agent, description));
  }
}
