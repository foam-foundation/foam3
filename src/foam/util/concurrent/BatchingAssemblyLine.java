/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.util.concurrent;

/**
 * An AssemblyLine decorator that batches jobs into CompoundAssemblies
 * of a configured size before enqueuing them into a delegate.
 * Reduces per-job thread synchronization overhead.
 **/
public class BatchingAssemblyLine
  implements AssemblyLine
{
  protected AssemblyLine     delegate_;
  protected int              batchSize_;
  protected CompoundAssembly batch_;

  public BatchingAssemblyLine(AssemblyLine delegate) {
    this(delegate, 128);
  }

  public BatchingAssemblyLine(AssemblyLine delegate, int batchSize) {
    delegate_  = delegate;
    batchSize_ = batchSize;
    batch_     = new CompoundAssembly(batchSize);
  }

  public void enqueue(Assembly job) {
    batch_.add(job);

    if ( batch_.isFull() ) {
      delegate_.enqueue(batch_);
      batch_ = new CompoundAssembly(batchSize_);
    }
  }

  public void shutdown() {
    if ( batch_.size() > 0 ) {
      delegate_.enqueue(batch_);
    }
    delegate_.shutdown();
  }
}
