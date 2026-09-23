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
import java.util.HashSet;
import java.util.Set;
import java.util.TreeSet;

import static foam.mlang.MLang.EQ;

public class PartitionedDAO
  extends AbstractPartitionedDAO // generated from AbstractPartitionDAO.js
{

  protected final static String NO_PART = "".intern();

  /** Every partition owns a directory, and its journal lives inside under this
      fixed name. That keeps two namespaces apart structurally rather than by
      delimiter: the partition value is a directory name, and the journal's own
      bookkeeping -- generations, snapshots, half-written temps -- are file
      names beneath it. A partition value can then be anything the filesystem
      accepts, and removing a partition is removing its directory. */
  public final static String PART_JOURNAL = "journal";

  // Doesn't need to be concurrent since the getDelgate() method synchronizes on it explicitly
  protected final HashMap<String, SoftReference<DAO>> delegates_ = new HashMap<>();

  // Partitions currently mid-replay in getDelegate(). Concurrent so peeks
  // (isLoading, publishQueued) never wait on a partition lock during a load.
  protected final java.util.Set<String> loading_ = java.util.concurrent.ConcurrentHashMap.newKeySet();

  // A Sink decorator which allows the delegate Sink to be fed to the select()
  // method of multiple DAOs. If one of the DAOs detaches the isDetached()
  // method will return true. This means the Sink doesn't need to be passed
  // to the remaining DAOs. The eof() method is NOP-ed but needs to be called
  // at the end of feeding the Sink to multiple DAOs.
  public static class DetachableSink extends ProxySink implements Detachable {

    protected boolean isDetached_ = false;

    public DetachableSink(Sink delegate) {
      super(delegate);
    }

    public void put(Object obj, Detachable sub) {
      if ( isDetached() ) return;

      getDelegate().put(obj, this);

      if ( isDetached() && sub != null ) sub.detach();
    }

    public void eof() {
      // NOP because will be fed to multiple DAOs
    }

    public boolean isDetached() {
      return isDetached_;
    }

    public void detach() {
      // System.err.println("***************** DETACHING SINK");
      isDetached_ = true;
    }
  } // DetachableSink

  public PartitionedDAO(X x) {
    setX(x);
  }

  public PartitionedDAO(X x, ClassInfo of, String dirName, Expr partitionProperty) {
    setX(x);
    setOf(of);
    setDirName(dirName);
    setPartitionProperty(partitionProperty);
  }

  public DAO getDelegate(String part) {
    if ( part == null ) part = NO_PART;

    // Sync on the part name instead of using a global lock to improve concurrency
    // This might become a problem in the future if we try to load too many at once.
    // A simpler and safer but maybe slower solution would be to just synchronize the
    // whole method.
    synchronized ( part.intern() ) {
      SoftReference<DAO> ref;
      synchronized ( delegates_ ) {
        ref = delegates_.get(part);
      }

      DAO dao = ref != null ? ref.get() : null;

      if ( dao == null ) {
        if ( ref != null )
          Loggers.logger(getX(), this).info("This DAO Partition was garbage collected. A new DAO will be created and cached:", part);
        loadingStarted(part);
        try {
          dao = createDAO(part);
          synchronized ( delegates_ ) {
            delegates_.put(part, new SoftReference<>(dao));
          }
        } finally {
          loadingEnded(part);
        }
      }

      return dao;
    }
  }

  public void loadingStarted(String part) {
    loading_.add(part);
  }

  public void loadingEnded(String part) {
    loading_.remove(part);
  }

  /** True while createDAO() (journal replay) is running for this partition. */
  public boolean isLoading(String part) {
    return loading_.contains(part);
  }

  /** Manual quiesce-then-unload only: an in-flight writer holding an old
      delegate reference plus a new reader racing getDelegate() to recreate
      it can briefly double-append to one journal file. Routine/automated
      eviction needs draining semantics first -- follow-up ticket. */
  public void unload() {
    Loggers.logger(getX(), this).info("Unloading all partitions.", getDirName());
    synchronized ( delegates_ ) {
      delegates_.clear();
    }
  }

  /** Cheap cache peek: true when a live (non-garbage-collected) delegate is
      already cached for this partition. No creation; guarded by the
      delegates_ monitor, same as getDelegate(), so it never waits on a
      partition lock while another thread replays. */
  public boolean isLoaded(String part) {
    if ( part == null ) part = NO_PART;
    SoftReference<DAO> ref;
    synchronized ( delegates_ ) {
      ref = delegates_.get(part);
    }
    return ref != null && ref.get() != null;
  }

  /** Compaction is per-journal, and each partition has one. Forwarding rather
      than handling means every partition is compacted and each one's report is
      accumulated on the command.

      Partitions are independent journals, so one that cannot be compacted must
      not strand the others. Its failure is recorded on the command -- which
      already carries per-partition results -- and the loop continues. Only the
      synchronous half of compaction can throw here; once dispatched, the
      rewrite records its own errors the same way. */
  public Object cmd_(X x, Object cmd) {
    if ( cmd instanceof foam.dao.compaction.CompactionCmd ) {
      foam.dao.compaction.CompactionCmd cc = (foam.dao.compaction.CompactionCmd) cmd;
      for ( String part : getPartitions() ) {
        try {
          getDelegate(part).cmd_(x, cc);
        } catch ( Throwable t ) {
          cc.addError(journalNameFor(part) + ": " + t.getMessage());
          Loggers.logger(getX(), this).error("compaction", part, t);
        }
      }
      return cc;
    }
    return super.cmd_(x, cmd);
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

  /** Journal name for a raw partition value, exactly as createDAO builds it
      for the JDAO: the partition's own directory plus PART_JOURNAL. Callers
      needing the id-prefix / cache key should keep using the raw part (see
      getPartition_'s round-trip). */
  protected String journalNameFor(String part) {
    return partitionDirFor(part) + PART_JOURNAL;
  }

  /** The directory a partition owns. Chained levels build their child's
      dirName from this, so every level is the same shape. */
  protected String partitionDirFor(String part) {
    return getDirName() + part + "/";
  }

  public DAO createDAO(String part) {
    Loggers.logger(getX(), this).info("Creating partiion " + part);

    String rawPart     = part;
    String journalName = journalNameFor(part);

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

    PartitionLoadReporter reporter = new PartitionLoadReporter(getX(), journalName, getServiceName(), rawPart);
    try {
      reporter.start(journalSize(journalName));
      X loadX = getX().put(PartitionLoadReporter.CTX_KEY, reporter);

      // When the model's id is a String, assign composite <partition>~<seqNo>
      // ids per partition so find can route by the id prefix (see getPartition_).
      // Long-id models stay flat (no prefix), preserving non-composite usage.
      // Guard is required: PartitionedSequenceNumberDAO.getObjId casts the id to
      // String, so wrapping a Long-id model throws ClassCastException on every put_.
      foam.lang.PropertyInfo idProp = getIdProperty();
      if ( idProp != null && String.class.equals(idProp.getValueClass()) ) {
        // The sequence wrapper sits INSIDE the JDAO: journal replay flows
        // through SequenceNumberDAO.put_, which advances the counter past
        // every already-stamped id, so the sequence resumes correctly after
        // an unload/reload or restart with no rescan. Writes stay correct
        // because the journal formats the object AFTER the delegate stamps
        // it (AbstractF3FileJournal.put executes dao.put_ under lock first).
        DAO seq = new foam.core.partition.PartitionedSequenceNumberDAO.Builder(loadX)
          .setProperty("id")
          .setDelegate(new foam.dao.MDAO(getOf()))
          .build();
        JDAO jdao = new JDAO(loadX, seq, journalName);
        addIndices(jdao);
        return jdao;
      }

      JDAO jdao = new JDAO(loadX, getOf(), journalName);
      addIndices(jdao);
      return jdao;
    } finally {
      reporter.done();
    }
  }

  protected DAO getDelegate(X x, FObject obj) {
    return getDelegate(getPartition(getID(obj)));
  }

  public String objToPath(FObject obj) {
    String id = getID(obj);

    if ( id != null ) return getPartition(id);

    return getPartition(obj);
  }

  public FObject put_(X x, FObject obj) {
    String part = getPartition(obj);
    // -1 keeps the trailing empty segment: an unset id arrives here as "" at
    // depth 1 and as "<a>~" at depth 2, and dropping that empty tail would
    // re-append the previous level's key as the sequence segment.
    String[] a = getID(obj).split(SEPARATOR, -1);
    if ( a.length <= getDepth() ) {
      StringBuilder sb = new StringBuilder();
      for ( int i = 0 ; i < getDepth()-1 ; i++ ) {
        sb.append(a[i]);
        sb.append(SEPARATOR);
      }
      sb.append(part);
      sb.append(SEPARATOR);
      sb.append(a[a.length-1]);
      setID(obj, sb.toString());
    }
    FObject ret = getDelegate(part).put_(x, obj);
    // Listeners registered via listen_ live on this DAO, not on the
    // soft-referenced partition delegates (they would be lost on unload), so
    // fire them here. Same as NotPartitionedDAO.
    if ( ret != null ) onPut(ret);
    return ret;
  }

  public FObject remove_(X x, FObject obj) {
    FObject ret = getDelegate(x, obj).remove_(x, obj);
    if ( ret != null ) onRemove(ret);
    return ret;
  }

  public FObject find_(X x, Object id) {
    String part = id instanceof String ? getPartition((String) id) : objToPath((FObject) id);

    if ( part == null ) return null;

    return getDelegate(part).find_(x, id);
  }

  /** Every partition with a journal on disk, sorted by name.

      Unlike DatePartitionedDAO, whose partition names are computable by
      stepping a Calendar, a partition keyed on something like a programId can
      only be discovered, so this reads the directory. Names are recovered by
      inverting createDAO's naming: a partition's journal is "<dirName><part>"
      every partition -- leaf or chained -- owns a directory, so the entries
      that are directories are the partitions and their names are the partition
      values. Nothing has to be parsed. */
  public String[] getPartitions() {
    Storage storage = (Storage) getX().get(foam.core.fs.FileSystemStorage.class);
    String  dirName = getDirName();
    File[]  entries;
    String  prefix  = "";

    if ( dirName.endsWith("/") ) {
      // dirName owns its directory, so every entry in it is one of ours.
      File dir = storage.get(dirName);
      if ( dir == null || ! dir.isDirectory() ) return new String[0];
      entries = dir.listFiles();
    } else {
      // A flat dirName shares its parent with unrelated journals, so only
      // entries carrying its basename as a prefix are ours.
      File probe = storage.get(dirName);
      File dir   = probe == null ? null : probe.getParentFile();
      if ( dir == null || ! dir.isDirectory() ) return new String[0];
      prefix = probe.getName();
      final String p = prefix;
      entries = dir.listFiles((d, name) -> name.startsWith(p));
    }

    if ( entries == null ) return new String[0];

    Set<String> names = new HashSet<>();
    for ( File f : entries ) {
      // A partition is a directory. Loose files beside them -- an unrelated
      // journal sharing the parent, a stray temp -- are not partitions.
      if ( f.isDirectory() ) names.add(f.getName());
    }

    Set<String> parts = new TreeSet<>();
    for ( String name : names ) {
      parts.add(name.substring(prefix.length()));
    }

    return parts.toArray(new String[0]);
  }

  /** The partitions a select has to visit: every one of them when the
      predicate carries an AllPartitions naming this level's property,
      otherwise the single one an EQ routes to. */
  public String[] resolvePartitions(Predicate predicate) {
    if ( hasAllPartitions(predicate) ) return getPartitions();

    Object part = extractPredicateValue(predicate);

    if ( part == null ) {
      String prop = ((PropertyInfo) getPartitionProperty()).getName();
      // Previously this fell through to getDelegate(String.valueOf(null)),
      // which loaded a partition literally named "null" -- an empty result
      // plus a stray journal file. A fully partitioned DAO requires the
      // selector in the query (see design.md), so say so.
      throw new UnsupportedOperationException(
        "select() on " + getDirName() + " needs '" + prop +
        "' in the query to pick a partition, or AllPartitions(" + prop +
        ") to visit every partition.");
    }

    if ( ! ( part instanceof Object[] ) ) return new String[] { String.valueOf(part) };

    // IN over the partition property: one partition per listed value, same
    // fan-out as AllPartitions. A repeated value still names one partition.
    Set<String> parts = new java.util.LinkedHashSet<>();
    for ( Object p : (Object[]) part ) parts.add(String.valueOf(p));
    return parts.toArray(new String[0]);
  }

  /** True when the predicate asks for every partition of THIS level. Mirrors
      extractPredicateValue's traversal: a bare term, or any arg of an AND.
      Comparing arg1 by reference matches how extractPredicateValue matches the
      partition property. */
  protected boolean hasAllPartitions(Predicate predicate) {
    if ( predicate instanceof AllPartitions )
      return ((AllPartitions) predicate).getArg1() == getPartitionProperty();

    if ( predicate instanceof And ) {
      for ( Predicate arg : ((And) predicate).getArgs() ) {
        if ( hasAllPartitions(arg) ) return true;
      }
    }

    return false;
  }

  public foam.dao.Sink select_(X x, Sink sink, long skip, long limit, Comparator order, Predicate predicate) {
    String[] parts = resolvePartitions(predicate);

    // One partition: hand the whole query down so the delegate can use its
    // indices, exactly as before.
    if ( parts.length == 1 )
      return getDelegate(parts[0]).select_(x, sink, skip, limit, order, predicate);

    Sink s2 = decorateSink(null, sink, skip, limit, order, predicate);

    // decorateSink only inserts an OrderedSink when the ordering would really
    // be applied -- it skips one for Count/Sum/Min/Max/Average, where order is
    // meaningless -- so look for the sink it actually built rather than just
    // testing order != null.
    //
    // An OrderedSink buffers every record fed to it and sorts on eof(), so
    // ordering across N partitions would hold all N partitions' matching
    // records in memory at once, and the LimitedSink nested inside it could
    // never detach early to cut the walk short. Refuse instead: unordered, the
    // walk streams one partition at a time and a limit still stops it early.
    // Walk only the links decorateSink added (stop at the caller's own sink,
    // which may legitimately be a ProxySink of its own).
    if ( parts.length > 1 ) {
      for ( Sink s = s2 ; s != sink && s instanceof ProxySink ; s = ((ProxySink) s).getDelegate() ) {
        if ( s instanceof OrderedSink )
          throw new UnsupportedOperationException(
            "Cannot order a select() spanning " + parts.length + " partitions of " +
            getDirName() + ": ordering would have to load them all at once. Drop " +
            "the order, or narrow the query to a single partition.");
      }
    }

    DetachableSink s3 = new DetachableSink(s2);

    for ( int i = 0 ; i < parts.length ; i++ ) {
      // Pass the predicate down, but not skip/limit/order: those apply to the
      // merged stream and s2 already owns them, whereas each partition would
      // otherwise apply its own. The predicate has to go down because a
      // delegate may itself be a partitioned DAO that routes on it (PADDAO's
      // inner DatePartitionedDAO would otherwise see no predicate and fall
      // back to its default time window); a leaf delegate can also use it to
      // hit an index. s2's PredicatedSink filters again, which is harmless.
      getDelegate(parts[i]).select_(x, s3, 0, AbstractDAO.MAX_SAFE_INTEGER, null, predicate);
      if ( s3.isDetached() ) break;
    }

    s2.eof();

    return sink;
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
        if ( predicate.getClass() == In.class ) {
          Object values = expr.getArg2().f(expr);
          if ( values instanceof Object[] ) return values;
          if ( values instanceof java.util.List ) return ((java.util.List) values).toArray();
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

  /** Path of the leaf partition this object routes to, one segment per
      level ("<a>~<b>" for two levels), built the same way put_ routes. A
      nested partitioned delegate is asked for its own segment; a leaf ends
      the path. */
  public String leafPath(FObject obj) {
    String part = getPartition(obj);
    DAO    d    = getDelegate(part);
    return d instanceof PartitionedDAO ? part + SEPARATOR + ((PartitionedDAO) d).leafPath(obj) : part;
  }

  /** A blank instance of `of` carrying only the partition-key properties of
      obj, at every level. The values, not the partition names: partitionPredicate
      turns them back into the terms the router understands. */
  public FObject partitionKey(FObject obj) {
    try {
      FObject key = (FObject) getOf().newInstance();
      copyPartitionKey(obj, key);
      return key;
    } catch ( java.lang.Exception e ) {
      throw new RuntimeException(e);
    }
  }

  protected void copyPartitionKey(FObject from, FObject to) {
    PropertyInfo prop = (PropertyInfo) getPartitionProperty();
    prop.set(to, prop.get(from));
    DAO d = getDelegate(getPartition(from));
    if ( d instanceof PartitionedDAO ) ((PartitionedDAO) d).copyPartitionKey(from, to);
  }

  /** The predicate that routes to exactly the leaf holding `key` and is true
      for every row in it, at every level. Equality on the partition property
      here; DatePartitionedDAO answers with the partition's date range. */
  public Predicate partitionPredicate(FObject key) {
    Predicate mine = levelPredicate(key);
    DAO       d    = getDelegate(getPartition(key));
    return d instanceof PartitionedDAO
      ? foam.mlang.MLang.AND(mine, ((PartitionedDAO) d).partitionPredicate(key))
      : mine;
  }

  protected Predicate levelPredicate(FObject key) {
    return EQ(getPartitionProperty(), getPartitionProperty().f(key));
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
