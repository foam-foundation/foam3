/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.lang;

import foam.core.logger.Loggers;
import foam.core.pm.PM;

import java.util.Collections;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
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

  protected static Set<Thread> RUNNING_ = Collections.newSetFromMap(new ConcurrentHashMap<>());
  public static Set<Thread> getRunningThreads() {
    return Collections.unmodifiableSet(RUNNING_);
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

  protected class ContextAgentRunnable implements Runnable {
    protected X            x_;
    protected ContextAgent agent_;
    protected String       description_;

    public ContextAgentRunnable(X x, ContextAgent agent, String description) {
      x_           = x;
      agent_       = agent;
      description_ = description;
    }

    public String toString() {
      return description_;
    }

    public void run() {
      PM pm = PM.create(x_, "VirtualThreadAgency", agent_.getClass().getSimpleName() + ":" + description_);

      X oldX = ((ProxyX) XLocator.get()).getX();

      try {
        XLocator.set(x_);
        RUNNING_.add(Thread.currentThread());
        agent_.execute(x_);
      } catch (Throwable t) {
        Loggers.logger(x_, this).error(agent_.getClass().getSimpleName(), description_, t.getMessage(), t);
      } finally {
        RUNNING_.remove(Thread.currentThread());
        XLocator.set(oldX);
        pm.log(x_);
      }
    }
  }
}
