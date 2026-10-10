/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.core.partition;

import foam.core.logger.Loggers;
import foam.dao.*;
import foam.dao.index.AddIndexCommand;
import foam.lang.*;
import foam.mlang.order.Comparator;
import foam.mlang.predicate.*;
import foam.mlang.sink.Count;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static foam.mlang.MLang.AND;
import static foam.mlang.MLang.EQ;

/**
 * Routes a query by a property the partitions are not keyed on.
 *
 * Per indexed property the decorator keeps one PartitionIndexEntry for each
 * distinct (value, leaf partition) pair, in its own PartitionedDAO of small
 * journals under "index-<dirName>/<property>/" beside the partitioned DAO's
 * directory, spread over BUCKETS journals by a hash of the value.
 * A select or removeAll whose predicate carries EQ or IN on an indexed property,
 * alone or inside AND, is rewritten: for every leaf holding the value, the
 * leaf's own partition-key terms (PartitionedDAO.partitionPredicate) are ANDed
 * onto the original predicate and the query is forwarded once per leaf. The
 * router below then reaches exactly those leaves. Any other predicate is
 * forwarded unchanged.
 *
 * The index entry is written before the row, so a crash between the two leaves
 * a spare entry (one wasted partition load later), never a missing one.
 *
 * A value with no entry selects nothing, so every row has to be written
 * through this decorator; rows already in the delegate, or written around it,
 * are indexed by rebuild().
 */
public class PartitionIndexDAO
  extends ProxyDAO
{
  /** Journals per indexed property. Fixed, because an entry's bucket is
      part of its id: a different count would look every value up in the
      wrong journal. */
  public static final int BUCKETS = 64;

  protected static class Spec {
    PropertyInfo   prop;
    PartitionedDAO index;
  }

  protected final Map<String, Spec> specs_ = new LinkedHashMap<>();

  // Guards an entry's check-and-write against a prune's count-and-remove,
  // striped by entry id. Private objects rather than interned strings, which
  // would share the JVM-wide lock with any other code interning the same text.
  protected final Object[] locks_ = new Object[64];
  {
    for ( int i = 0 ; i < locks_.length ; i++ ) locks_[i] = new Object();
  }

  public PartitionIndexDAO(X x, PartitionedDAO delegate) {
    setX(x);
    setDelegate(delegate);
  }

  public PartitionedDAO getPartitioned() {
    return (PartitionedDAO) getDelegate();
  }

  /** Index `prop`. Registers the in-leaf index on `prop` too, so a routed
      query is answered by a lookup, not a scan.
      Call before the first query touches the DAO: AddIndexCommand reaches only
      partitions created after it. */
  public PartitionIndexDAO index(PropertyInfo prop) {
    Spec spec  = new Spec();
    spec.prop  = prop;
    spec.index = new PartitionedDAO(getX(), PartitionIndexEntry.getOwnClassInfo(),
      indexDirName(prop), PartitionIndexEntry.BUCKET);
    spec.index.cmd_(getX(), indexCommand(PartitionIndexEntry.VALUE));
    getDelegate().cmd_(getX(), indexCommand(prop));
    specs_.put(prop.getName(), spec);
    return this;
  }

  /** Where `prop`'s index journals live: beside the partitioned DAO's
      directory, neither inside it nor under its prefix, because
      PartitionedDAO.getPartitions() reads every directory there as a
      partition. "tx/" and a flat "tx" both give "index-tx/<prop>/". */
  protected String indexDirName(PropertyInfo prop) {
    String dir   = getPartitioned().getDirName();
    String base  = dir.endsWith("/") ? dir.substring(0, dir.length() - 1) : dir;
    int    slash = base.lastIndexOf('/');
    return base.substring(0, slash + 1) + "index-" + base.substring(slash + 1) + "/" + prop.getName() + "/";
  }

  /** The index DAO kept for `prop`; null when it is not indexed. */
  public DAO getIndex(PropertyInfo prop) {
    Spec spec = specs_.get(prop.getName());
    return spec == null ? null : spec.index;
  }

  protected AddIndexCommand indexCommand(PropertyInfo prop) {
    AddIndexCommand cmd = new AddIndexCommand();
    cmd.setIndexers(new Indexer[] { prop });
    return cmd;
  }

  public static int bucket(String value) {
    return Math.floorMod(value.hashCode(), BUCKETS);
  }

  protected String entryId(String value, String leaf) {
    return bucket(value) + AbstractPartitionedDAO.SEPARATOR + value + "|" + leaf;
  }

  protected Object lock(String id) {
    return locks_[Math.floorMod(id.hashCode(), locks_.length)];
  }

  protected String leafOf(PartitionIndexEntry entry) {
    return entry.getId().substring(entry.getId().indexOf('|') + 1);
  }

  public FObject put_(X x, FObject obj) {
    if ( specs_.isEmpty() ) return getDelegate().put_(x, obj);

    FObject old = storedRow(x, obj);

    // Written before the row, so a crash between the two leaves a spare
    // entry, never a missing one; and checked again after it, because a
    // prune that counted the leaf before this row landed may have removed it.
    addEntries(x, obj);
    FObject ret = getDelegate().put_(x, obj);
    addEntries(x, ret);

    // An update that changed an indexed value, or the leaf, leaves the old
    // (value, leaf) entry behind; prune it like a remove would.
    if ( old != null ) {
      String oldLeaf = getPartitioned().leafPath(old);
      String newLeaf = getPartitioned().leafPath(ret);
      for ( Spec spec : specs_.values() ) {
        Object value = indexedValue(spec, old);
        if ( value == null ) continue;
        if ( oldLeaf.equals(newLeaf) && value.equals(indexedValue(spec, ret)) ) continue;
        prune(x, spec, oldLeaf, value);
      }
    }
    return ret;
  }

  /** The stored row obj replaces, found by its composite id; null for a new
      row, whose id the partitioned DAO has not stamped yet. */
  protected FObject storedRow(X x, FObject obj) {
    PartitionedDAO pdao = getPartitioned();
    String         id   = pdao.getID(obj);
    if ( foam.util.SafetyUtil.isEmpty(id) ) return null;
    // A stamped id is the leaf path plus one sequence segment.
    int depth = pdao.leafPath(obj).split(AbstractPartitionedDAO.SEPARATOR, -1).length + 1;
    if ( id.split(AbstractPartitionedDAO.SEPARATOR, -1).length != depth ) return null;
    return getDelegate().find_(x, id);
  }

  protected Object indexedValue(Spec spec, FObject obj) {
    return spec.prop.isSet(obj) ? spec.prop.get(obj) : null;
  }

  /** Write the (value, leaf) entry for each indexed value obj carries, unless
      it exists. Locked on the entry id, as prune is, so the check and the
      write cannot straddle a prune's count and remove. */
  protected void addEntries(X x, FObject obj) {
    PartitionedDAO pdao = getPartitioned();
    String         leaf = pdao.leafPath(obj);
    FObject        key  = null;

    for ( Spec spec : specs_.values() ) {
      Object v = indexedValue(spec, obj);
      if ( v == null ) continue;

      String value = String.valueOf(v);
      String id    = entryId(value, leaf);
      synchronized ( lock(id) ) {
        if ( spec.index.find_(x, id) != null ) continue;

        if ( key == null ) key = pdao.partitionKey(obj);
        PartitionIndexEntry entry = new PartitionIndexEntry();
        entry.setId(id);
        entry.setBucket(bucket(value));
        entry.setValue(value);
        entry.setKey(key);
        spec.index.put_(x, entry);
      }
    }
  }

  public FObject remove_(X x, FObject obj) {
    FObject removed = getDelegate().remove_(x, obj);
    if ( removed != null ) prune(x, removed);
    return removed;
  }

  /** Drop the (value, leaf) entries of a removed row once no row in that leaf
      carries the value any more. */
  protected void prune(X x, FObject removed) {
    if ( specs_.isEmpty() ) return;

    String leaf = getPartitioned().leafPath(removed);
    for ( Spec spec : specs_.values() ) {
      Object value = indexedValue(spec, removed);
      if ( value != null ) prune(x, spec, leaf, value);
    }
  }

  protected void prune(X x, Spec spec, String leaf, Object value) {
    String id = entryId(String.valueOf(value), leaf);
    synchronized ( lock(id) ) {
      PartitionIndexEntry entry = (PartitionIndexEntry) spec.index.find_(x, id);
      if ( entry == null ) return;

      Count count = (Count) getDelegate().select_(x, new Count(), 0, MAX_SAFE_INTEGER, null,
        AND(getPartitioned().partitionPredicate(entry.getKey()), EQ(spec.prop, value)));
      if ( count.getValue() == 0 ) spec.index.remove_(x, entry);
    }
  }

  /** Index the rows already in the delegate that match predicate: rows put
      before index() was called, or written around this decorator. The
      predicate routes like any select on the delegate, e.g. AllPartitions on
      a keyed level and a date range on a date level. */
  public void rebuild(X x, Predicate predicate) {
    getDelegate().select_(x, new AbstractSink() {
      public void put(Object obj, Detachable sub) {
        addEntries(x, (FObject) obj);
      }
    }, 0, MAX_SAFE_INTEGER, null, predicate);
  }

  public Sink select_(X x, Sink sink, long skip, long limit, Comparator order, Predicate predicate) {
    List<Predicate> routes = routes(x, predicate);

    if ( routes == null )     return getDelegate().select_(x, sink, skip, limit, order, predicate);
    if ( routes.size() == 1 ) return getDelegate().select_(x, sink, skip, limit, order, routes.get(0));

    // Several leaves, or none: same fan-out as DatePartitionedDAO. Each
    // route carries the full original predicate, so the sink is decorated
    // for skip, limit and order only. A bounded limit goes down with the
    // order as a per-leaf top-(skip+limit), so s2 merges at most that many
    // rows per leaf instead of buffering every match.
    Sink                          s2        = decorateSink(x, sink, skip, limit, order, null);
    PartitionedDAO.DetachableSink s3        = new PartitionedDAO.DetachableSink(s2);
    boolean                       bounded   = limit > 0 && limit < MAX_SAFE_INTEGER && skip < MAX_SAFE_INTEGER;
    long                          partLimit = bounded ? skip + limit : MAX_SAFE_INTEGER;
    Comparator                    partOrder = bounded ? order : null;
    for ( Predicate route : routes ) {
      getDelegate().select_(x, s3, 0, partLimit, partOrder, route);
      if ( s3.isDetached() ) break;
    }
    s2.eof();
    return sink;
  }

  /** Select through the (routed) select_ and remove each row through this
      DAO, so every indexed removal also prunes the index. */
  public void removeAll_(X x, long skip, long limit, Comparator order, Predicate predicate) {
    select_(x, new RemoveSink(x, this), skip, limit, order, predicate);
  }

  /** One predicate per leaf holding the indexed value(s) the predicate names,
      each the original predicate ANDed with that leaf's partition-key terms.
      Null when the predicate carries no routable indexed term. */
  protected List<Predicate> routes(X x, Predicate predicate) {
    Binary term = indexedTerm(predicate);
    if ( term == null ) {
      if ( mentionsIndexed(predicate) ) {
        Loggers.logger(x, this).info("Indexed property not in an EQ, IN or AND; forwarding unrouted", predicate);
      }
      return null;
    }

    Object[] values = values(term);
    if ( values == null ) return null;

    Spec                   spec   = specs_.get(((PropertyInfo) term.getArg1()).getName());
    PartitionedDAO         pdao   = getPartitioned();
    Predicate              rest   = withoutAllPartitions(predicate);
    Map<String, Predicate> byLeaf = new LinkedHashMap<>();

    for ( Object v : values ) {
      String    value   = String.valueOf(v);
      ArraySink entries = (ArraySink) spec.index.select_(x, new ArraySink(), 0, MAX_SAFE_INTEGER, null,
        AND(EQ(PartitionIndexEntry.BUCKET, bucket(value)), EQ(PartitionIndexEntry.VALUE, value)));

      for ( Object o : entries.getArray() ) {
        PartitionIndexEntry entry = (PartitionIndexEntry) o;
        String              leaf  = leafOf(entry);
        if ( byLeaf.containsKey(leaf) ) continue;
        byLeaf.put(leaf, AND(pdao.partitionPredicate(entry.getKey()), rest));
      }
    }

    return new ArrayList<>(byLeaf.values());
  }

  protected Binary indexedTerm(Predicate predicate) {
    if ( predicate instanceof Eq || predicate instanceof In ) {
      Binary b = (Binary) predicate;
      if ( b.getArg1() instanceof PropertyInfo && specs_.containsKey(((PropertyInfo) b.getArg1()).getName()) ) return b;
      return null;
    }
    if ( predicate instanceof And ) {
      for ( Predicate arg : ((And) predicate).getArgs() ) {
        Binary term = indexedTerm(arg);
        if ( term != null ) return term;
      }
    }
    return null;
  }

  protected Object[] values(Binary term) {
    Object v = term.getArg2().f(term);
    if ( term instanceof Eq )        return new Object[] { v };
    if ( v instanceof Object[] )     return (Object[]) v;
    if ( v instanceof List )         return ((List) v).toArray();
    return null;
  }

  protected boolean mentionsIndexed(Predicate predicate) {
    if ( predicate instanceof Binary ) {
      Object arg1 = ((Binary) predicate).getArg1();
      return arg1 instanceof PropertyInfo && specs_.containsKey(((PropertyInfo) arg1).getName());
    }
    if ( predicate instanceof Nary ) {
      for ( Predicate arg : ((Nary) predicate).getArgs() ) if ( mentionsIndexed(arg) ) return true;
    }
    if ( predicate instanceof Not ) return mentionsIndexed(((Not) predicate).getArg1());
    return false;
  }

  /** predicate without its AllPartitions terms. A route already names its
      leaf; an AllPartitions left in it would send the router to every
      partition of that level again. */
  protected Predicate withoutAllPartitions(Predicate predicate) {
    if ( predicate instanceof AllPartitions ) return foam.mlang.MLang.TRUE;
    if ( ! ( predicate instanceof And ) ) return predicate;

    List<Predicate> args = new ArrayList<>();
    for ( Predicate arg : ((And) predicate).getArgs() ) args.add(withoutAllPartitions(arg));
    return AND(args.toArray(new Predicate[0]));
  }

  /** Migrate a legacy single-file journal into the partitioned delegate,
      writing through this DAO so the index fills as the rows are copied. */
  public void migrateFrom(X x, String legacyJournalName, String daoKey) {
    new SingleToPartitionMigrator().run(x, legacyJournalName, getPartitioned(), daoKey, this);
  }

  public void migrateFrom(X x, String legacyJournalName) {
    migrateFrom(x, legacyJournalName, null);
  }

  /** The index DAOs sit beside the delegate, not under it, so a command
      meant for every journal is passed to them here: unload, and compaction,
      which drops the entries a remove pruned. */
  public Object cmd_(X x, Object cmd) {
    if ( AbstractPartitionedDAO.UNLOAD_CMD.equals(cmd) ) {
      for ( Spec spec : specs_.values() ) spec.index.unload();
    }
    if ( cmd instanceof foam.dao.compaction.CompactionCmd ) {
      for ( Spec spec : specs_.values() ) spec.index.cmd_(x, cmd);
    }
    return super.cmd_(x, cmd);
  }
}
