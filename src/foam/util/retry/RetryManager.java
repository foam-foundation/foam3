package foam.util.retry;

import foam.lang.ContextAgent;
import foam.lang.X;
import foam.core.logger.Logger;

import java.util.Timer;
import java.util.TimerTask;
import java.util.concurrent.CountDownLatch;

public class RetryManager {
  protected final RetryStrategy retryStrategy_;
  protected final String        description_;
  protected CountDownLatch      latch_;
  protected Exception           exception_;

  class Retry {
    final X            x_;
    final ContextAgent agent_;
    final Timer        timer_ = new Timer(true);
    private boolean cancelled_ = false;

    public Retry(X x, ContextAgent agent) {
      x_     = x;
      agent_ = agent;
    }

    public void start() {
      if ( retryStrategy_.canRetry(x_) ) {
        retry();
      } else {
        ((Logger) x_.get("logger")).error(
          "RetryManager(" + description_ + ") max retry has been reached."
          , exception_);
      }
    }

    private void retry() {
      timer_.schedule(new TimerTask() {
        @Override
        public void run() {
          if ( cancelled_ ) return;

          try {
            agent_.execute(x_);
            while ( latch_.getCount() > 0 ) {
              latch_.countDown();
            }
            exception_ = null;
          } catch (Exception ex) {
            exception_ = ex;
            start();
            latch_.countDown();
          }
        }
      }, retryStrategy_.getRetryDelay(x_));
    }

    public void cancel() {
      cancelled_ = true;
    }
  }

  public RetryManager(RetryStrategy retryStrategy, String description) {
    retryStrategy_ = retryStrategy;
    description_   = description;
    latch_         = new CountDownLatch(retryStrategy_.getMaxRetry());
  }

  public void submit(X x, ContextAgent agent) {
    var retry = new Retry(x, agent);
    retry.start();
    try {
      latch_.await();
      if ( exception_ != null ) {
        if ( exception_ instanceof RuntimeException ) {
          throw (RuntimeException) exception_;
        }
        throw new RuntimeException(exception_);
      }
    } catch (InterruptedException e) {
      retry.cancel();
    }
  }
}
