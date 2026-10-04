/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.core.partition;

import foam.core.boot.CSpec;
import foam.core.boot.CSpecStatus;
import foam.core.logger.Loggers;
import foam.dao.*;
import foam.dao.index.AddIndexCommand;
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
  protected EasyDAO easy_;

  public NotPartitionedDAO(X x) {
    setX(x);
  }

  public NotPartitionedDAO(X x, ClassInfo of, String journalName) {
    setX(x);
    setOf(of);
    setDirName(journalName);
  }

  /** Set by EasyDAO so createDAO() can rebuild the same journalled chain on every reload. */
  public void setEasyDAO(EasyDAO easy) {
    easy_ = easy;
  }

  public synchronized DAO getDelegate() {
    DAO dao = delegate_ != null ? delegate_.get() : null;

    if ( dao == null ) {
      if ( delegate_ != null )
        updateStatus(CSpecStatus.UNLOADED, "Unload", "garbage collected", getDirName());
      // The replay that follows reports its own start/progress/complete.

      loadingStarted("");
      try {
        dao = createDAO();
        delegate_ = new SoftReference<>(dao);
      } finally {
        loadingEnded("");
      }
    }

    return dao;
  }

  public synchronized void unload() {
    updateStatus(CSpecStatus.UNLOADED, "Unload", getDirName());
    delegate_ = null;
  }

  protected void updateStatus(Object... args) {
    CSpec cspec = getCSpec();
    if ( cspec != null ) {
      cspec.updateStatus(args);
    } else {
      Loggers.logger(getX(), this).info(args);
    }
  }

  public DAO createDAO() {
    String journalName = getDirName();
    Loggers.logger(getX(), this).info("Creating underlying DAO", journalName);

    PartitionLoadReporter reporter = new PartitionLoadReporter(getX(), journalName, getServiceName(), "");
    DAO jdao;
    try {
      reporter.start(journalSize(journalName));
      X loadX = getX().put(PartitionLoadReporter.CTX_KEY, reporter);
      if ( easy_ != null ) {
        jdao = easy_.createJournalledDelegate(loadX, getIndices());
      } else {
        // The indexes go in before the JDAO replays into the MDAO, so its bulk
        // load builds them all at once instead of each one after the fact.
        MDAO mdao = new MDAO(getOf());
        addIndices(mdao);
        jdao = new JDAO(loadX, mdao, journalName);
      }
    } finally {
      reporter.done();
    }

    return jdao;
  }

  public FObject put_(X x, FObject obj) {
    FObject ret = getDelegate().put_(x, obj);
    // Listeners registered via listen_ live on this DAO, not the soft-referenced
    // delegate (they would be lost on unload), so fire them here.
    if ( ret != null ) onPut(ret);
    return ret;
  }

  public FObject remove_(X x, FObject obj) {
    FObject ret = getDelegate().remove_(x, obj);
    if ( ret != null ) onRemove(ret);
    return ret;
  }

  public void removeAll_(X x, long skip, long limit, Comparator order, Predicate predicate) {
    getDelegate().removeAll_(x, skip, limit, order, predicate);
    onReset();
  }

  public FObject find_(X x, Object id) {
    return getDelegate().find_(x, id);
  }

  public foam.dao.Sink select_(
    X x, Sink sink, long skip, long limit, Comparator order, Predicate predicate) {
    return getDelegate().select_(x, sink, skip, limit, order, predicate);
  }

  public Object cmd_(X x, Object cmd) {
    if ( UNLOAD_CMD.equals(cmd) ) {
      unload();
      return true;
    }

    // Sent once the service script has returned, so every index it added is
    // recorded and goes into the replay's bulk load.
    if ( DAO.LOAD_CMD.equals(cmd) ) return getDelegate().cmd_(x, cmd);

    if ( cmd instanceof AddIndexCommand ) {
      getIndices().add(cmd);

      synchronized ( this ) {
        if ( delegate_ == null ) return true;
      }
    }

    synchronized ( this ) {
      if ( delegate_ == null ) return false;
    }

    return getDelegate().cmd_(x, cmd);
  }
}
