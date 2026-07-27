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

public class PartitionedDAO
  extends AbstractPartitionedDAO // generated from AbstractPartitionDAO.js
{

  protected final static String NO_PART = "".intern();

  // Doesn't need to be concurrent since the getDelgate() method is synchronized
  // protected final ConcurrentHashMap<String, DAO> delegates_ = new ConcurrentHashMap<String, DAO>();
  protected final HashMap<String, SoftReference<DAO>> delegates_ = new HashMap<>();

  public PartitionedDAO(X x) {
    setX(x);
  }

  public PartitionedDAO(X x, ClassInfo of, String dirName, Expr partitionProperty) {
    setX(x);
    setOf(of);
    setDirName(dirName);
    setPartitionProperty(partitionProperty);
  }

  public synchronized DAO getDelegate(String part) {
    if ( part == null ) part = NO_PART;

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
    return (String) getIdProperty().f(o);
  }

  public void setID(FObject o, String id) {
    getIdProperty().set(o, id);
  }

  public String getPartition(FObject o) {
    return String.valueOf(getPartitionProperty().f(o));
  }

  public String getPartition(String id) {
    String ret = getPartition_(id);
    System.out.println("****** PARTITION " + id + " -> " + ret);
    return ret;
  }

  /** Attempt to extract partition from a SEPARATOR-delimited primary key.
      Chained partitions (e.g. "<a>~<b>~<key>") read their own segment by
      depth: depth 1 reads <a>, depth 2 reads <b>. **/
  public String getPartition_(String id) {
    String[] a = id.split(SEPARATOR);

    if ( a.length < getDepth() ) return null;

    return a[getDepth()-1];
  }

  public DAO createDAO(String part) {
    Loggers.logger(getX(), this).info("Creating partiion " + part);

    // The '_' escape is for the FILENAME only — the id prefix below keeps the
    // raw partition value so getPartition_(id) round-trips to the same key
    // getDelegate() caches on.
    String rawPart = part;
    if ( part.startsWith("_") || part.equals("") ) {
      part = "_" + part;
    }

    String journalName = getDirName() + part;

    // TODO: directory creation would be better done by JDAO itself
    // Create the directory in the WRITABLE FileSystemStorage where JDAO writes the
    // journal, not the Storage.class read storage — the two differ when
    // resource.journals.dir is set (read journals come from a resource/jar), so
    // mkdirs on Storage.class would target the wrong root and the write would fail.
    Storage storage = (Storage) getX().get(foam.core.fs.FileSystemStorage.class);
    File    parent  = storage.get(journalName).getParentFile();
    if ( parent != null && ! parent.isDirectory() && ! parent.mkdirs() ) {
      throw new RuntimeException("Failed to create directory " + parent);
    }

    JDAO jdao = new JDAO(getX(), getOf(), journalName);

    // When the model's id is a String, assign composite <partition>~<seqNo>
    // ids per partition so find can route by the id prefix (see getPartition_).
    // Long-id models stay flat (no prefix), preserving non-composite usage.
    // Guard is required: PartitionedSequenceNumberDAO.getObjId casts the id to
    // String, so wrapping a Long-id model throws ClassCastException on every put_.
    foam.lang.PropertyInfo idProp = getIdProperty();
    if ( idProp != null && String.class.equals(idProp.getValueClass()) ) {
      return new foam.core.partition.PartitionedSequenceNumberDAO.Builder(getX())
        .setPrefix(rawPart + SEPARATOR)
        .setProperty("id")
        .setDelegate(jdao)
        .build();
    }

    addIndices(jdao);

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

  public String objToPath(FObject obj) {
    String id = getID(obj);

    if ( id != null ) return getPartition(id);

    return getPartition(obj);
  }

  public FObject put_(X x, FObject obj) {
    String part = getPartition(obj);
    String[] a = getID(obj).split(SEPARATOR);
    System.err.println("**** PUT id: " + getID(obj) + "  part: " + part + "  len: " + a.length);
    if ( a.length <= getDepth() ) {
      StringBuilder sb = new StringBuilder();
      for ( int i = 0 ; i < getDepth()-1 ; i++ ) {
        sb.append(a[i]);
        sb.append(SEPARATOR);
      }
      sb.append(part);
      sb.append(SEPARATOR);
      sb.append(a[a.length-1]);
      System.err.println("**** PUT2 " + sb.toString());
      setID(obj, sb.toString());
    }
    return getDelegate(part).put_(x, obj);
  }

  public FObject remove_(X x, FObject obj) {
    return getDelegate(x, obj).remove_(x, obj);
  }

  public FObject find_(X x, Object id) {
    String part = id instanceof String ? getPartition((String) id) : objToPath((FObject) id);

    if ( part == null ) return null;

    return getDelegate(part).find_(x, id);
  }

  public foam.dao.Sink select_(X x, Sink sink, long skip, long limit, Comparator order, Predicate predicate) {
    Object part = extractPredicateValue(predicate);
    // TODO: extract partition match or range
    // return sink;
    return getDelegate(String.valueOf(part)).select_(x, sink, skip, limit, order, predicate);
  }

  public Object extractPredicateValue(Predicate predicate) {
    if ( predicate == null ) {
      return null;
    }

    if ( predicate instanceof Binary ) {
      Binary expr = (Binary) predicate;

      // Check if this binary predicate applies to our target property
      if ( expr.getArg1() == getPartitionProperty() ) {
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
        Object value = extractPredicateValue(arg);
        if ( value != null ) {
          return value;
        }
      }
    }

    return null;
  }

  /** Copy a legacy single-file journal's records into this DAO's per-partition
      journals, rewrite references held by other DAOs (discovered via
      ReferencePropertyInfo when daoKey is given), validate, and archive the
      legacy journal. Delegates to SingleToPartitionMigrator. */
  public void migrateFrom(X x, String legacyJournalName, String daoKey) {
    new SingleToPartitionMigrator().run(x, legacyJournalName, this, daoKey);
  }

  public void migrateFrom(X x, String legacyJournalName) {
    migrateFrom(x, legacyJournalName, null);
  }

//  No implementation needed for removeAll_() because it just calls select_().
//  public void removeAll_(X x, long skip, long limit, Comparator order, Predicate predicate) {
}
