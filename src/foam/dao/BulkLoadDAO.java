/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.dao;

import foam.lang.ClassInfo;
import foam.lang.FObject;
import foam.lang.X;
import java.util.HashMap;
import java.util.Map;

/**
 * Collects the rows of a load so an MDAO can build its index from all of them
 * at once, rather than one put per row. JDAO replays a journal into one of
 * these and hands rows() to MDAO.bulkLoad().
 *
 * A MapDAO that does not clone and publishes nothing. Nothing else can see
 * it - it exists only between the start of a replay and the index being built
 * - so the copy MapDAO makes to protect a shared row has nobody to protect it
 * from, MDAO.bulkLoad() freezes what it takes anyway, and an event has nobody
 * to reach.
 *
 * Rows live in one plain map per shard, chosen by shardOf(id). A replay whose
 * apply stage is sharded by the same function (OwnedShardAssemblyLine, which
 * F3FileJournal picks for this target) touches each map from one thread only,
 * so no map is shared and none is locked. Row order is not kept: every MDAO
 * index chain ends in the id TreeIndex and bulkLoad sorts at each level, so
 * arrival order never reaches a select.
 */
public class BulkLoadDAO
  extends MapDAO
{
  protected final Map<Object, FObject>[] shards_;

  /** One shard per replay worker: the core count less the reader's. **/
  public BulkLoadDAO(X x, ClassInfo of) {
    this(x, of, Math.max(1, Runtime.getRuntime().availableProcessors() - 1));
  }

  @SuppressWarnings("unchecked")
  public BulkLoadDAO(X x, ClassInfo of, int shards) {
    super(x, of);
    shards_ = new Map[shards];
    for ( int i = 0 ; i < shards ; i++ ) shards_[i] = new HashMap<>();
    setData(shards_[0]);
  }

  /** How many shards, so an apply stage can run one worker per shard. **/
  public int shards() {
    return shards_.length;
  }

  /** The shard an id belongs to; the apply stage routes with the same function. **/
  public static int shardOf(Object id, int shards) {
    return id == null ? 0 : Math.floorMod(id.hashCode(), shards);
  }

  protected Map<Object, FObject> shard(Object id) {
    return shards_[shardOf(id, shards_.length)];
  }

  public FObject put_(X x, FObject obj) {
    Object id = getPrimaryKey().get(obj);
    shard(id).put(id, obj);
    return obj;
  }

  public FObject remove_(X x, FObject obj) {
    Object id = getPrimaryKey().get(obj);
    shard(id).remove(id);
    return obj;
  }

  public FObject find_(X x, Object o) {
    if ( o == null ) return null;
    Object id = getOf().isInstance(o) ? getPrimaryKey().get(o) : o;
    return shard(id).get(id);
  }

  /** The rows collected, all shards together. **/
  public FObject[] rows() {
    int n = 0;
    for ( Map<Object, FObject> m : shards_ ) n += m.size();
    FObject[] a = new FObject[n];
    int i = 0;
    for ( Map<Object, FObject> m : shards_ ) for ( FObject f : m.values() ) a[i++] = f;
    return a;
  }
}
