/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.lang;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

public class VirtualThreadAgency extends AbstractAgency {
  protected final String prefix_;
  protected ExecutorService executor_;

  public VirtualThreadAgency() {
    this("virtual-thread");
  }

  public VirtualThreadAgency(String prefix) {
    prefix_ = prefix;
    executor_ = newExecutor();
  }

  protected ExecutorService newExecutor() {
    return Executors.newThreadPerTaskExecutor(
      Thread.ofVirtual().name(prefix_, 0).factory()
    );
  }

  public Future<?> submit(X x, ContextAgent agent, String description) {
    return executor_.submit(new ContextAgentRunnable(x, agent, description));
  }

  /**
   * Restart virtual thread executor.
   * @param forceTermination - if true shut down the executor now then re-initiate a new instance
   *                         , otherwise wait to terminate all tasks before shutting down and re-initiating the executor.
   */
  public void restart(boolean forceTermination) {
    if ( forceTermination ) {
      executor_.shutdownNow();
    } else {
      executor_.close();
    }
    executor_ = newExecutor();
  }
}
