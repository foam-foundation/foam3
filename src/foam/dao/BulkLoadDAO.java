/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.dao;

import foam.lang.ClassInfo;
import foam.lang.FObject;
import foam.lang.X;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Collects the rows of a load so an MDAO can build its index from all of them
 * at once, rather than one put per row. JDAO replays a journal into one of
 * these and hands rows() to MDAO.bulkLoad().
 *
 * A MapDAO that does not clone and publishes nothing.
 * Nothing else can see it - it exists only between the start of a replay and
 * the index being built - so the copy MapDAO makes to protect a shared row has
 * nobody to protect it from, MDAO.bulkLoad() freezes what it takes anyway, and
 * an event has nobody to reach.
 *
 * The map is concurrent because F3FileJournal applies a replay into it from
 * several threads, one per id shard. Row order is not kept: every MDAO index
 * chain ends in the id TreeIndex and bulkLoad sorts at each level, so arrival
 * order never reaches a select.
 */
public class BulkLoadDAO
  extends MapDAO
{
  public BulkLoadDAO(X x, ClassInfo of) {
    super(x, of);
    setData(new ConcurrentHashMap<Object, FObject>());
  }

  public FObject put_(X x, FObject obj) {
    getData().put(getPrimaryKey().get(obj), obj);
    return obj;
  }

  public FObject remove_(X x, FObject obj) {
    getData().remove(getPrimaryKey().get(obj));
    return obj;
  }

  public FObject find_(X x, Object o) {
    if ( o == null ) return null;

    return getData().get(getOf().isInstance(o) ? getPrimaryKey().get(o) : o);
  }

  /** The rows collected. **/
  public FObject[] rows() {
    return getData().values().toArray(new FObject[getData().size()]);
  }
}
