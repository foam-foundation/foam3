/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.lang;

import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class TimeoutAgency extends ProxyAgency {
  // Timeout (in milliseconds) for task submitted to the agency
  protected final long                timeout_;
  protected ScheduledExecutorService  executor_;

  public TimeoutAgency(Agency delegate) {
    // 10-minute default timeout
    this(delegate, 600000);
  }

  public TimeoutAgency(Agency delegate, long timeout) {
    setDelegate(delegate);
    timeout_ = timeout;
  }

  public ScheduledExecutorService getExecutor() {
    if ( executor_ == null ) {
      executor_ = Executors.newScheduledThreadPool(2, Thread.ofPlatform().name("timeout-agency", 0).factory());
    }
    return executor_;
  }

  @Override
  public Future<?> submit(X x, ContextAgent agent, String description) {
    var result = getDelegate().submit(x, agent, description);
    getExecutor().schedule(() -> {
      if ( ! result.isDone() ) {
        if ( agent instanceof TimeoutContextAgent ta ) ta.onTimeout();
        result.cancel(true);
      }
    }, getTimeout(agent), TimeUnit.MILLISECONDS);
    return result;
  }

  protected long getTimeout(ContextAgent agent) {
    if ( agent instanceof TimeoutContextAgent ta && ta.getTimeout() > 0 )
      return ta.getTimeout();
    else
      return timeout_;
  }
}
