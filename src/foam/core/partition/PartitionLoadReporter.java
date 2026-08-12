/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.core.partition;

import foam.dao.DAO;
import foam.lang.X;

/**
 * Publishes journal-replay progress for one partition load into
 * partitionLoadStatusDAO. Owned by the single thread running the load;
 * puts are throttled so a fast replay does not storm the status DAO.
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
    return (DAO) x_.get("partitionLoadStatusDAO");
  }

  public void start(long totalBytes) {
    total_ = totalBytes;
    put(true);
  }

  public synchronized void addChars(long n) {
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
    dao.put(s);
  }

  public void done() {
    DAO dao = dao();
    if ( dao == null ) return;

    PartitionLoadStatus s = new PartitionLoadStatus();
    s.setId(id_);
    dao.remove(s);
  }
}
