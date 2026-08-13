/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.core.partition;

import foam.core.logger.Loggers;
import foam.dao.DAO;
import foam.lang.X;

/**
 * Publishes journal-replay progress for one partition load into
 * partitionLoadStatusDAO. Not thread-safe: owned by the single thread
 * running the load. Puts are throttled so a fast replay does not storm
 * the status DAO.
 */
public class PartitionLoadReporter {
  public final static String CTX_KEY             = "partitionLoadReporter";
  protected final static long MIN_PUT_INTERVAL_MS = 250;

  protected final X              x_;
  protected final String         id_;
  protected final String         serviceName_;
  protected final String         partition_;
  protected final java.util.Date start_ = new java.util.Date();
  protected long total_   = 0;
  protected long read_    = 0;
  protected long lastPut_ = 0;

  public PartitionLoadReporter(X x, String id, String serviceName, String partition) {
    x_           = x;
    id_          = id;
    serviceName_ = serviceName;
    partition_   = partition;
  }

  protected DAO dao() {
    // The service itself is open server-side; read-only protection lives in
    // the CLIENT stanza (a ReadOnlyDAO decorator on the client EasyDAO), so
    // server-side writers use the resolved service directly.
    return (DAO) x_.get("partitionLoadStatusDAO");
  }

  public void start(long totalBytes) {
    total_ = totalBytes;
    put(true);
  }

  public void addChars(long n) {
    read_ += n;
    put(false);
  }

  public long getBytesRead() {
    return read_;
  }

  protected void put(boolean force) {
    DAO dao = dao();
    if ( dao == null ) return; // early boot, no status DAO yet

    long now = System.currentTimeMillis();
    if ( ! force && now - lastPut_ < MIN_PUT_INTERVAL_MS ) return;
    lastPut_ = now;

    PartitionLoadStatus s = new PartitionLoadStatus();
    s.setId(id_);
    s.setServiceName(serviceName_);
    s.setPartition(partition_);
    s.setTotalBytes(total_);
    s.setBytesRead(read_);
    s.setStartTime(start_);
    try {
      dao.put(s);
    } catch ( Throwable t ) {
      // Best-effort progress channel -- must never break the replay it's
      // reporting on, whatever partitionLoadStatusDAO gets wrapped in later.
      Loggers.logger(x_, this).warning("Failed to publish partition-load status row", t);
    }
  }

  public void done() {
    DAO dao = dao();
    if ( dao == null ) return;

    PartitionLoadStatus s = new PartitionLoadStatus();
    s.setId(id_);
    try {
      dao.remove(s);
    } catch ( Throwable t ) {
      Loggers.logger(x_, this).warning("Failed to clear partition-load status row", t);
    }
  }
}
