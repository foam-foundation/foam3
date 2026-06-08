/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.core.partition;

import foam.core.logger.Loggers;
import foam.core.script.BeanShellExecutor;
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

public class PartitionedDAO
  extends AbstractPartitionedDAO // generated from AbstractPartitionDAO.js
{

  // Doesn't need to be concurrent since the getDelgate() method is synchronized
  // protected final ConcurrentHashMap<String, DAO> delegates_ = new ConcurrentHashMap<String, DAO>();
  protected final HashMap<String, SoftReference<DAO>> delegates_ = new HashMap<>();

  public PartitionedDAO(X x, ClassInfo of, String dirName, Expr partitionProperty) {
    setX(x);
    setOf(of);
    setDirName(dirName);
    setPartitionProperty(partitionProperty);
  }

  public PartitionedDAO(X x, ClassInfo of, String dirName, Expr id, Expr partitionProperty) {
    this(x, of, dirName, partitionProperty);
    setIdentityExpr(id);
  }

  public synchronized DAO getDelegate(String part) {
    synchronized ( part.intern() ) {
      SoftReference<DAO> ref = delegates_.get(part);

      DAO dao = ref != null ? ref.get() : null;

      if ( dao == null ) {
        if ( ref != null )
          Loggers.logger(getX(), this).info("This DAO Partition was garbage collected. A new DAO will be created and cached:", part);
        dao = createDAO(part);
        delegates_.put(part, new SoftReference<>(dao));
      }

      return dao;
    }
  }

  public String getID(FObject o) {
    return (String) getIdentityExpr().f(o);
  }

  public String getPartition(FObject o) {
    return String.valueOf(getPartitionProperty().f(o));
  }

  public String getPartition(String id) {
    String ret = getPartition_(id);
    System.out.println("****** PARTITION " + id + " -> " + ret);
    return ret;
  }

  /** Attempt to extract partition from prefix of a primary key. **/
  public String getPartition_(String id) {
    var i = id.indexOf('-');

    if ( i == -1 ) return null;

    return id.substring(0, i);
  }

  public DAO createDAO(String part) {
    Loggers.logger(getX(), this).info("Creating partiion " + part);

    String journalName = getDirName() + "_" + part;

    // TODO: directory creation would be better done by JDAO itself
    Storage storage = (Storage) getX().get(Storage.class);
    File    parent  = storage.get(journalName).getParentFile();
    if ( parent != null && ! parent.isDirectory() && ! parent.mkdirs() ) {
      throw new RuntimeException("Failed to create directory " + parent);
    }

    JDAO jdao = new JDAO(getX(), getOf(), journalName);
    return jdao;
  }

  protected DAO getDelegate(X x, FObject obj) {
    return getDelegate(getID(obj));
  }

/*
  protected DAO getDelegate(X x, Predicate pred) {
    return getDelegate();
  }
*/

  public FObject put_(X x, FObject obj) {
    String id   = getID(obj);
    String part = null;

    System.out.println("******* PART put " + obj + " " + id);

    part = ( id == null ) ? getPartition(obj) : getPartition(id);
    System.out.println("******* PART put part " + part);

    return getDelegate(part).put_(x, obj);
  }

  public FObject remove_(X x, FObject obj) {
    return getDelegate(x, obj).remove_(x, obj);
  }

  public FObject find_(X x, Object id) {
    if ( id instanceof FObject ) {
      id = getID((FObject) id);
    }
    // TODO: if id is empty we could skip the find
    return getDelegate((String) id).find_(x, id);
  }

  public foam.dao.Sink select_(X x, Sink sink, long skip, long limit, Comparator order, Predicate predicate) {
    Object part = extractPredicateValue(predicate, (PropertyInfo) getPartitionProperty());
    // TODO: extract partition match or range
    // return sink;
    return getDelegate(String.valueOf(part)).select_(x, sink, skip, limit, order, predicate);
  }

  public Object extractPredicateValue(Predicate predicate, PropertyInfo property) {
    if ( predicate == null || property == null ) {
      return null;
    }

    if ( predicate instanceof Binary ) {
      Binary expr = (Binary) predicate;

      // Check if this binary predicate applies to our target property
      if ( expr.getArg1() == property ) {
        if ( predicate.getClass() == Eq.class ) {
          return expr.getArg2().f(expr);
        }
        /*
        // For range predicates, you could return a Range object or array
        if ( predicate.getClass().equals(Gt.class)  ||
             predicate.getClass().equals(Gte.class) ||
             predicate.getClass().equals(Lt.class)  ||
             predicate.getClass().equals(Lte.class) ) {
          return expr.getArg2().f(expr);
        }
        */
      }
    } else if ( predicate instanceof And ) {
      And andPredicate = (And) predicate;

      // Process each argument in the AND predicate
      for ( Predicate arg : andPredicate.getArgs() ) {
        Object value = extractPredicateValue(arg, property);
        if ( value != null ) {
          return value;
        }
      }
    }

    return null;
  }

//  No implementation needed for removeAll_() because it just calls select_().
//  public void removeAll_(X x, long skip, long limit, Comparator order, Predicate predicate) {
}
