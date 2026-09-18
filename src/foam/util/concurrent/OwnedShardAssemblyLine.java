/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.util.concurrent;

import foam.lang.X;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.Semaphore;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * An AssemblyLine whose workers parse and apply, with no thread dedicated to
 * either.
 *
 * P worker threads each own one shard. Enqueued jobs get a sequence number
 * and go round-robin to the workers. A worker that takes a job runs
 * executeJob(), buckets the job - or each child of a CompoundAssembly - by the
 * hash of its first requested lock into P sub-batches, and hands each worker
 * its sub-batch under that sequence number, empty ones included so every
 * shard sees a dense sequence. A worker that takes a sub-batch applies
 * (endJob) the ones for its shard strictly in sequence order, holding early
 * arrivals back. Jobs sharing a lock therefore end on one thread in enqueue
 * order; different locks end concurrently; and a journal with nothing to
 * merge costs no more threads than the parse alone. In-flight jobs are capped
 * so the parse cannot run unboundedly ahead of the slowest shard.
 **/
public class OwnedShardAssemblyLine
  implements AssemblyLine
{
  protected static class SubBatch {
    final long           seq;
    final List<Assembly> jobs;
    final AtomicInteger  remaining;  // shards yet to apply this batch
    final boolean        last;

    SubBatch(long seq, List<Assembly> jobs, AtomicInteger remaining, boolean last) {
      this.seq = seq; this.jobs = jobs; this.remaining = remaining; this.last = last;
    }
  }

  protected static class Job {
    final long     seq;
    final Assembly assembly;
    final boolean  last;

    Job(long seq, Assembly assembly, boolean last) {
      this.seq = seq; this.assembly = assembly; this.last = last;
    }
  }

  protected class Worker extends Thread {
    final int                         shard_;
    final LinkedBlockingQueue<Object> inbox_    = new LinkedBlockingQueue<>();
    final Map<Long, SubBatch>         pending_  = new HashMap<>();
    long                              expected_ = 0;

    Worker(int shard) {
      super(threadGroup_, name_ + "-" + shard);
      shard_ = shard;
      setDaemon(true);
    }

    public void run() {
      foam.lang.XLocator.set(x_);
      while ( true ) {
        Object item;
        try {
          item = inbox_.take();
        } catch (InterruptedException e) {
          return;
        }
        if ( item instanceof Job ) {
          parse((Job) item);
        } else {
          SubBatch sb = (SubBatch) item;
          pending_.put(sb.seq, sb);
          if ( apply() ) return;
        }
      }
    }

    /** Run the parallel part, then hand every worker its share. **/
    void parse(Job job) {
      try {
        job.assembly.executeJob();
      } catch (Throwable t) {
        ((foam.core.logger.Logger) x_.get("logger")).error(name_, "executeJob", t);
      }

      @SuppressWarnings("unchecked")
      List<Assembly>[] buckets = new List[workers_.length];
      for ( int i = 0 ; i < buckets.length ; i++ ) buckets[i] = new ArrayList<>();
      if ( job.assembly instanceof CompoundAssembly ) {
        CompoundAssembly batch = (CompoundAssembly) job.assembly;
        for ( int i = 0 ; i < batch.size() ; i++ ) buckets[shardOf(batch.get(i))].add(batch.get(i));
      } else if ( ! job.last ) {
        buckets[shardOf(job.assembly)].add(job.assembly);
      }

      AtomicInteger remaining = new AtomicInteger(workers_.length);
      for ( int i = 0 ; i < workers_.length ; i++ ) workers_[i].inbox_.add(new SubBatch(job.seq, buckets[i], remaining, job.last));
      job.assembly.complete();
    }

    /** Apply every pending sub-batch that is next in sequence; true once the last one is done. **/
    boolean apply() {
      SubBatch sb;
      while ( (sb = pending_.remove(expected_)) != null ) {
        expected_++;
        for ( Assembly job : sb.jobs ) {
          try {
            job.endJob(false);
          } catch (Throwable t) {
            ((foam.core.logger.Logger) x_.get("logger")).error(name_, "endJob", t);
          }
        }
        if ( sb.remaining.decrementAndGet() == 0 ) inFlight_.release();
        if ( sb.last ) return true;
      }
      return false;
    }
  }

  protected X           x_;
  protected ThreadGroup threadGroup_;
  protected Worker[]    workers_;
  protected Semaphore   inFlight_ = new Semaphore(128);
  protected long        seq_      = 0;
  protected String      name_;
  protected boolean     shutdown_ = false;

  public OwnedShardAssemblyLine(X x, String name) {
    this(x, name, Math.max(1, Runtime.getRuntime().availableProcessors()-1));
  }

  public OwnedShardAssemblyLine(X x, String name, int numberOfThreads) {
    x_    = x;
    name_ = "OwnedShardAssemblyLine:" + (name != null ? name : "");

    threadGroup_ = new ThreadGroup(Thread.currentThread().getThreadGroup(), name_);
    workers_ = new Worker[numberOfThreads];
    for ( int i = 0 ; i < numberOfThreads ; i++ ) {
      workers_[i] = new Worker(i);
      workers_[i].start();
    }
  }

  protected int shardOf(Assembly job) {
    Object[] locks = job.requestLocks();
    Object   key   = locks == null || locks.length == 0 ? null : locks[0];
    return foam.dao.BulkLoadDAO.shardOf(key, workers_.length);
  }

  protected void enqueue(Assembly job, boolean last) {
    if ( shutdown_ ) throw new IllegalStateException("Can't enqueue into a shutdown AssemblyLine.");

    long seq = seq_++;
    try {
      inFlight_.acquire();
    } catch (InterruptedException e) {
      return;
    }
    workers_[(int) (seq % workers_.length)].inbox_.add(new Job(seq, job, last));
  }

  public void enqueue(Assembly job) {
    enqueue(job, false);
  }

  /** Flushes every shard in sequence order; every worker exits after its last sub-batch. **/
  public void shutdown() {
    enqueue(new AbstractAssembly() {}, true);
    try {
      for ( Worker w : workers_ ) w.join();
    } catch (InterruptedException e) {
    }
    shutdown_ = true;
  }
}
