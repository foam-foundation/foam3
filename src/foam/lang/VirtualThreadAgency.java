/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.lang;

import foam.core.COREService;
import foam.core.logger.Loggers;
import foam.core.pm.PM;

import java.lang.Exception;
import java.util.Collections;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

public class VirtualThreadAgency extends AbstractAgency implements COREService {
  protected final String prefix_;
  protected final boolean forceTerminationOnStop_;
  protected ExecutorService executor_;

  protected static Set<Thread> RUNNING_ = Collections.newSetFromMap(new ConcurrentHashMap<>());
  public static Set<Thread> getRunningThreads() {
    return Collections.unmodifiableSet(RUNNING_);
  }

  public VirtualThreadAgency() {
    this("virtual-thread", true);
  }

  public VirtualThreadAgency(String prefix) {
    this(prefix, true);
  }

  public VirtualThreadAgency(String prefix, boolean forceTerminationOnStop) {
    prefix_ = prefix;
    forceTerminationOnStop_ = forceTerminationOnStop;
  }

  protected void initThreadExecutor() {
    executor_ = Executors.newThreadPerTaskExecutor(
      Thread.ofVirtual().name(prefix_, 0).factory()
    );
  }

  @Override
  public void start() throws Exception {
    initThreadExecutor();
  }

  /**
   * Stop virtual thread executor.
   * <p>
   * If 'forceTerminationOnStop_' flag is set to true then shut down the executor now and kill all existing tasks,
   * otherwise wait to terminate all tasks before shutting down the executor.
   * </p>
   */
  @Override
  public void stop() {
    if ( forceTerminationOnStop_ ) {
      executor_.shutdownNow();
    } else {
      executor_.close();
    }
  }

  @Override
  public void reload() {
    stop();
    initThreadExecutor();
  }

  public Future<?> submit(X x, ContextAgent agent, String description) {
    return executor_.submit(new ContextAgentRunnable(x, agent, description));
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
