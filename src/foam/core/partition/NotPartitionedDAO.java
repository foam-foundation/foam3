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

  public NotPartitionedDAO(X x) {
    setX(x);
  }

  public NotPartitionedDAO(X x, ClassInfo of, String journalName) {
    setX(x);
    setOf(of);
    setDirName(journalName);
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
  }

  public DAO createDAO() {
    String journalName = getDirName();
    Loggers.logger(getX(), this).info("Creating underlying DAO", journalName);

    System.err.println("******************************** CREATING UNLOADABLE DAO " + journalName);

    DAO jdao = new JDAO(getX(), getOf(), journalName);

    addIndices(jdao);

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

  public FObject find_(X x, Object id) {
    return getDelegate().find_(x, id);
  }

  public foam.dao.Sink select_(
    X x, Sink sink, long skip, long limit, Comparator order, Predicate predicate) {
    return getDelegate().select_(x, sink, skip, limit, order, predicate);
  }

}
