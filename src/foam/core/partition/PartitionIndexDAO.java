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
 * journals under "<dirName>index/<property>/", bucketed by a hash of the value.
 * A select or removeAll whose predicate carries EQ or IN on an indexed property,
 * alone or inside AND, is rewritten: for every leaf holding the value, the
 * leaf's own partition-key terms (PartitionedDAO.partitionPredicate) are ANDed
 * onto the original predicate and the query is forwarded once per leaf. The
 * router below then reaches exactly those leaves. Any other predicate is
 * forwarded unchanged.
 *
 * The index entry is written before the row, so a crash between the two leaves
 * a spare entry (one wasted partition load later), never a missing one.
 */
public class PartitionIndexDAO
  extends ProxyDAO
{
  protected static class Spec {
    PropertyInfo   prop;
    int            buckets;
    PartitionedDAO index;
  }

  protected final Map<String, Spec> specs_ = new LinkedHashMap<>();

  public PartitionIndexDAO(X x, PartitionedDAO delegate) {
    setX(x);
    setDelegate(delegate);
  }

  public PartitionedDAO getPartitioned() {
    return (PartitionedDAO) getDelegate();
  }

  // TODO: do we need a per-property bucket count at all? One fixed count
  // (64, say) splits a large index (account ids) into files small enough
  // to load per lookup and costs a small one (source ids) nothing but a few
  // tiny files. If so, drop the argument.
  /** Index `prop` across `buckets` journals. Registers the in-leaf index on
      `prop` too, so a routed query is answered by a lookup, not a scan.
      Call before the first query touches the DAO: AddIndexCommand reaches only
      partitions created after it. */
  public PartitionIndexDAO index(PropertyInfo prop, int buckets) {
    Spec spec    = new Spec();
    spec.prop    = prop;
    spec.buckets = Math.max(1, buckets);
    spec.index   = new PartitionedDAO(getX(), PartitionIndexEntry.getOwnClassInfo(),
      getPartitioned().getDirName() + "index/" + prop.getName() + "/", PartitionIndexEntry.BUCKET);
    spec.index.cmd_(getX(), indexCommand(PartitionIndexEntry.VALUE));
    getDelegate().cmd_(getX(), indexCommand(prop));
    specs_.put(prop.getName(), spec);
    return this;
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

  protected int bucket(Spec spec, String value) {
    return Math.floorMod(value.hashCode(), spec.buckets);
  }

  protected String entryId(Spec spec, String value, String leaf) {
    return bucket(spec, value) + AbstractPartitionedDAO.SEPARATOR + value + "|" + leaf;
  }

  protected String leafOf(PartitionIndexEntry entry) {
    return entry.getId().substring(entry.getId().indexOf('|') + 1);
  }

  public FObject put_(X x, FObject obj) {
    if ( ! specs_.isEmpty() ) {
      PartitionedDAO pdao = getPartitioned();
      String         leaf = pdao.leafPath(obj);
      FObject        key  = null;

      for ( Spec spec : specs_.values() ) {
        if ( ! spec.prop.isSet(obj) || spec.prop.get(obj) == null ) continue;

        String value = String.valueOf(spec.prop.get(obj));
        String id    = entryId(spec, value, leaf);
        if ( spec.index.find_(x, id) != null ) continue;

        if ( key == null ) key = pdao.partitionKey(obj);
        PartitionIndexEntry entry = new PartitionIndexEntry();
        entry.setId(id);
        entry.setBucket(bucket(spec, value));
        entry.setValue(value);
        entry.setKey(key);
        spec.index.put_(x, entry);
      }
    }

    return getDelegate().put_(x, obj);
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

    PartitionedDAO pdao = getPartitioned();
    String         leaf = pdao.leafPath(removed);

    for ( Spec spec : specs_.values() ) {
      if ( ! spec.prop.isSet(removed) || spec.prop.get(removed) == null ) continue;

      Object              value = spec.prop.get(removed);
      PartitionIndexEntry entry = (PartitionIndexEntry) spec.index.find_(x, entryId(spec, String.valueOf(value), leaf));
      if ( entry == null ) continue;

      Count count = (Count) getDelegate().select_(x, new Count(), 0, MAX_SAFE_INTEGER, null,
        AND(pdao.partitionPredicate(entry.getKey()), EQ(spec.prop, value)));
      if ( count.getValue() == 0 ) spec.index.remove_(x, entry);
    }
  }

  public Sink select_(X x, Sink sink, long skip, long limit, Comparator order, Predicate predicate) {
    List<Predicate> routes = routes(x, predicate);

    if ( routes == null )     return getDelegate().select_(x, sink, skip, limit, order, predicate);
    if ( routes.size() == 1 ) return getDelegate().select_(x, sink, skip, limit, order, routes.get(0));

    // Several leaves, or none: same fan-out as DatePartitionedDAO. Each
    // route carries the full original predicate, so the sink is decorated
    // for skip, limit and order only.
    Sink                              s2 = decorateSink(x, sink, skip, limit, order, null);
    DatePartitionedDAO.DetachableSink s3 = new DatePartitionedDAO.DetachableSink(s2);
    for ( Predicate route : routes ) {
      getDelegate().select_(x, s3, 0, MAX_SAFE_INTEGER, null, route);
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
    Map<String, Predicate> byLeaf = new LinkedHashMap<>();

    for ( Object v : values ) {
      String    value   = String.valueOf(v);
      ArraySink entries = (ArraySink) spec.index.select_(x, new ArraySink(), 0, MAX_SAFE_INTEGER, null,
        AND(EQ(PartitionIndexEntry.BUCKET, bucket(spec, value)), EQ(PartitionIndexEntry.VALUE, value)));

      for ( Object o : entries.getArray() ) {
        PartitionIndexEntry entry = (PartitionIndexEntry) o;
        String              leaf  = leafOf(entry);
        if ( byLeaf.containsKey(leaf) ) continue;
        // A partition-key EQ already in the query that names another
        // partition (ProgramAwareDAO's programId term, say) rules this leaf out.
        if ( conflicts(predicate, entry.getKey()) ) continue;
        byLeaf.put(leaf, AND(pdao.partitionPredicate(entry.getKey()), predicate));
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

  /** True when an EQ in the predicate names a partition-key property with a
      value other than the leaf's. */
  protected boolean conflicts(Predicate predicate, FObject key) {
    if ( predicate instanceof Eq ) {
      Eq eq = (Eq) predicate;
      if ( ! ( eq.getArg1() instanceof PropertyInfo ) ) return false;
      PropertyInfo prop = (PropertyInfo) eq.getArg1();
      return prop.isSet(key) && prop.comparePropertyToValue(prop.get(key), eq.getArg2().f(eq)) != 0;
    }
    if ( predicate instanceof And ) {
      for ( Predicate arg : ((And) predicate).getArgs() ) if ( conflicts(arg, key) ) return true;
    }
    return false;
  }

  /** Migrate a legacy single-file journal into the partitioned delegate,
      writing through this DAO so the index fills as the rows are copied. */
  public void migrateFrom(X x, String legacyJournalName, String daoKey) {
    new SingleToPartitionMigrator().run(x, legacyJournalName, getPartitioned(), daoKey, this);
  }

  public void migrateFrom(X x, String legacyJournalName) {
    migrateFrom(x, legacyJournalName, null);
  }

  public Object cmd_(X x, Object cmd) {
    if ( AbstractPartitionedDAO.UNLOAD_CMD.equals(cmd) ) {
      for ( Spec spec : specs_.values() ) spec.index.unload();
    }
    return super.cmd_(x, cmd);
  }
}
