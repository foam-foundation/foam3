/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.util.concurrent;

import foam.core.logger.Loggers;
import foam.lang.XLocator;

/**
 * A compound Assembly that batches multiple Assemblies together.
 * Each Assembly method iterates over all children in order. A child that
 * throws is logged and the rest of the batch carries on, as each child would
 * had the AssemblyLine run it alone.
 **/
public class CompoundAssembly
  extends AbstractAssembly
{
  protected Assembly[] jobs_;
  protected int        size_ = 0;

  public CompoundAssembly(int capacity) {
    jobs_ = new Assembly[capacity];
  }

  public void add(Assembly job) {
    jobs_[size_++] = job;
  }

  public int size() {
    return size_;
  }

  public boolean isFull() {
    return size_ >= jobs_.length;
  }

  public void executeJob() {
    for ( int i = 0 ; i < size_ ; i++ ) {
      try {
        jobs_[i].executeJob();
      } catch (Throwable t) {
        Loggers.logger(XLocator.get(), this).error("executeJob", t);
      }
    }
  }

  public void endJob(boolean isLast) {
    for ( int i = 0 ; i < size_ ; i++ ) {
      try {
        jobs_[i].endJob(isLast);
      } catch (Throwable t) {
        Loggers.logger(XLocator.get(), this).error("endJob", t);
      }
    }
  }
}
