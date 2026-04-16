/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.util.concurrent;

import foam.lang.X;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.Semaphore;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * A simplified asynchronous AssemblyLine.
 *
 * executeJob() runs concurrently in a thread pool.
 * A dedicated background thread drains a channel calling
 * waitToComplete() and endJob(false) in enqueue order.
 **/
public class SimpleAsyncAssemblyLine
  implements AssemblyLine
{
  protected X                             x_;
  protected ThreadPoolExecutor            pool_;
  protected ThreadGroup                   threadGroup_;
  protected LinkedBlockingQueue<Assembly> channel_ = new LinkedBlockingQueue<>();
  protected Thread                        endThread_;
  protected String                        name_;
  protected boolean                       shutdown_ = false;

  public SimpleAsyncAssemblyLine(X x) {
    this(x, null);
  }

  public SimpleAsyncAssemblyLine(X x, String name) {
    this(x, name, Runtime.getRuntime().availableProcessors());
  }

  public SimpleAsyncAssemblyLine(X x, String name, int numberOfThreads) {
    x_    = x;
    name_ = "SimpleAsyncAssemblyLine:" + (name != null ? name : "");

    threadGroup_ = new ThreadGroup(Thread.currentThread().getThreadGroup(), name_);
    pool_ = new ThreadPoolExecutor(
      numberOfThreads,
      numberOfThreads,
      10,
      TimeUnit.SECONDS,
      new LinkedBlockingQueue<Runnable>(),
      new ThreadFactory() {
        final AtomicInteger threadNumber = new AtomicInteger(1);
        public Thread newThread(Runnable runnable) {
          Thread thread = new Thread(
            threadGroup_,
            runnable,
            name_ + "-" + threadNumber.getAndIncrement(),
            0
          );
          thread.setDaemon(true);
          thread.setPriority(Thread.NORM_PRIORITY);
          return thread;
        }
      }
    );
    pool_.allowCoreThreadTimeOut(true);

    endThread_ = new Thread(threadGroup_, name_ + "-endJob") {
      public void run() {
        while ( true ) {
          try {
            Assembly job = channel_.take();
            job.waitToComplete();
            try {
              job.endJob(false);
            } catch (Throwable t) {
              ((foam.core.logger.Logger) x_.get("logger")).error(name_, "endJob", t);
            }
          } catch (InterruptedException e) {
            return;
          }
        }
      }
    };
    endThread_.setDaemon(true);
    endThread_.start();
  }

  public void enqueue(Assembly job) {
    if ( shutdown_ ) throw new IllegalStateException("Can't enqueue into a shutdown AssemblyLine.");

    pool_.execute(() -> {
      try {
        job.executeJob();
      } catch (Throwable t) {
        ((foam.core.logger.Logger) x_.get("logger")).error(name_, "executeJob", t);
      } finally {
        job.complete();
      }
    });

    channel_.add(job);
  }

  public void shutdown() {
    try {
      Semaphore s = new Semaphore(1);
      s.acquire();

      enqueue(new AbstractAssembly() {
        public void endJob(boolean isLast) {
          s.release();
          endThread_.interrupt();
          pool_.shutdown();
        }
      });

      s.acquire();
    } catch (InterruptedException e) {
    } catch (IllegalStateException e) {
    }
    shutdown_ = true;
  }
}
