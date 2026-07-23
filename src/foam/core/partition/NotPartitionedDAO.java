/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.core.partition;

import foam.core.logger.Loggers;
import foam.dao.*;
import foam.dao.java.JDAO;
import foam.lang.*;
import foam.mlang.Expr;
import foam.mlang.order.Comparator;
import foam.mlang.predicate.*;
import foam.mlang.predicate.Predicate;
import foam.core.fs.Storage;
import java.io.File;
import java.lang.ref.SoftReference;
import java.util.HashMap;

/**
 * A non-partitioned wrapper DAO that provides memory-management via soft
 * references. The underlying DAO can be unloaded under memory pressure and
 * reloaded on-demand. Useful for large single tables where you want automatic
 * memory management without partitioning logic.
 */
public class NotPartitionedDAO
  extends AbstractPartitionedDAO
{
  protected SoftReference<DAO> delegate_ = null;
  protected DAO initialDelegate_;
  protected boolean cluster_;
  protected boolean waitReplay_ = true;
  protected boolean ndiff_;

  public NotPartitionedDAO(X x) {
    setX(x);
  }

  public NotPartitionedDAO(
    X x,
    DAO delegate,
    String journalName,
    boolean cluster,
    boolean waitReplay,
    boolean ndiff
  ) {
    setX(x);
    setOf(delegate.getOf());
    setDirName(journalName);
    initialDelegate_ = delegate;
    cluster_ = cluster;
    waitReplay_ = waitReplay;
    ndiff_ = ndiff;
  }

  public synchronized DAO getDelegate() {
    DAO dao = delegate_ != null ? delegate_.get() : null;

    if ( dao == null ) {
      if ( delegate_ != null )
        Loggers.logger(getX(), this).info("DAO was garbage collected. A new DAO will be created and cached.", getDirName());

      dao = createDAO();
      delegate_ = new SoftReference<>(dao);
    }

    return dao;
  }

  public synchronized void unload() {
    Loggers.logger(getX(), this).info("DAO unloaded.", getDirName());
    delegate_ = null;
    onReset();
  }

  public DAO createDAO() {
    String journalName = getDirName();
    Loggers.logger(getX(), this).info("Creating underlying DAO", journalName);

    DAO delegate = initialDelegate_;
    if ( delegate == null )
      delegate = new MDAO(getOf());

    JDAO jdao = new JDAO();
    jdao.setX(getX());
    jdao.setFilename(journalName);
    jdao.setCluster(cluster_);
    jdao.setWaitReplay(waitReplay_);
    jdao.setNdiff(ndiff_);
    // Setting the delegate must be last because it triggers journal replay.
    jdao.setDelegate(delegate);
    initialDelegate_ = null;

    addIndices(jdao);

    return jdao;
  }

  public FObject put_(X x, FObject obj) {
    FObject result = getDelegate().put_(x, obj);
    onPut(result);
    return result;
  }

  public FObject remove_(X x, FObject obj) {
    FObject result = getDelegate().remove_(x, obj);
    if ( result != null )
      onRemove(result);
    return result;
  }

  public FObject find_(X x, Object id) {
    return getDelegate().find_(x, id);
  }

  public foam.dao.Sink select_(
    X x, Sink sink, long skip, long limit, Comparator order, Predicate predicate) {
    return getDelegate().select_(x, sink, skip, limit, order, predicate);
  }

  public Object cmd_(X x, Object cmd) {
    Object result = super.cmd_(x, cmd);
    if ( result != null )
      return result;

    return getDelegate().cmd_(x, cmd);
  }

}
