/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.util.concurrent;

import foam.lang.X;
import java.util.concurrent.LinkedBlockingQueue;
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
  protected X                               x_;
  protected ThreadPoolExecutor              pool_;
  protected ThreadGroup                     threadGroup_;
  protected LinkedBlockingQueue<Assembly>[] channels_;
  protected Thread[]                        endThreads_;
  protected final Assembly                  last_     = new AbstractAssembly() {};
  protected String                          name_;
  protected boolean                         shutdown_ = false;

  public SimpleAsyncAssemblyLine(X x) {
    this(x, null);
  }

  public SimpleAsyncAssemblyLine(X x, String name) {
    this(x, name, Math.max(1, Runtime.getRuntime().availableProcessors()-1));
  }

  public SimpleAsyncAssemblyLine(X x, String name, int numberOfThreads) {
    this(x, name, numberOfThreads, 1);
  }

  /**
   * With more than one shard, endJob() runs on that many threads. Every job
   * goes to every shard in enqueue order, and each shard ends only the jobs,
   * or children of a CompoundAssembly, whose first requested lock hashes to
   * it. Jobs sharing a lock therefore end on one thread in enqueue order.
   **/
  @SuppressWarnings("unchecked")
  public SimpleAsyncAssemblyLine(X x, String name, int numberOfThreads, int shards) {
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

    channels_   = new LinkedBlockingQueue[shards];
    endThreads_ = new Thread[shards];
    for ( int i = 0 ; i < shards ; i++ ) {
      final int                           shard   = i;
      final LinkedBlockingQueue<Assembly> channel = channels_[i] = new LinkedBlockingQueue<>(128);
      endThreads_[i] = new Thread(threadGroup_, name_ + "-endJob-" + i) {
        public void run() {
          // Carry forward XLocator Context to this thread
          foam.lang.XLocator.set(x_);

          while ( true ) {
            Assembly job;
            try {
              job = channel.take();
            } catch (InterruptedException e) {
              return;
            }
            if ( job == last_ ) return;
            job.waitToComplete();
            if ( job instanceof CompoundAssembly ) {
              CompoundAssembly batch = (CompoundAssembly) job;
              for ( int j = 0 ; j < batch.size() ; j++ ) end(batch.get(j), shard);
            } else {
              end(job, shard);
            }
          }
        }
      };
      endThreads_[i].setDaemon(true);
      endThreads_[i].start();
    }
  }

  public void enqueue(Assembly job) {
    if ( shutdown_ ) throw new IllegalStateException("Can't enqueue into a shutdown AssemblyLine.");

    pool_.execute(() -> {
      // Carry forward XLocator Context to this thread
      foam.lang.XLocator.set(x_);

      try {
        job.executeJob();
      } catch (Throwable t) {
        ((foam.core.logger.Logger) x_.get("logger")).error(name_, "executeJob", t);
      } finally {
        job.complete();
      }
    });

    try {
      for ( LinkedBlockingQueue<Assembly> channel : channels_ ) channel.put(job);
    } catch (InterruptedException e) {
    }
  }

  /** Ends the job on this shard if its first requested lock belongs here. **/
  protected void end(Assembly job, int shard) {
    if ( channels_.length > 1 ) {
      Object[] locks = job.requestLocks();
      Object   key   = locks == null || locks.length == 0 ? null : locks[0];
      if ( ( key == null ? 0 : Math.floorMod(key.hashCode(), channels_.length) ) != shard ) return;
    }
    try {
      job.endJob(false);
    } catch (Throwable t) {
      ((foam.core.logger.Logger) x_.get("logger")).error(name_, "endJob", t);
    }
  }

  public void shutdown() {
    try {
      enqueue(last_);
      for ( Thread t : endThreads_ ) t.join();
    } catch (InterruptedException e) {
    } catch (IllegalStateException e) {
    }
    pool_.shutdown();
    shutdown_ = true;
  }
}
