/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.dao.index;

import foam.lang.FObject;
import foam.dao.Sink;
import foam.mlang.order.Comparator;
import foam.mlang.predicate.Predicate;

import java.io.IOException;

public interface Index {
  // Add an object
  public Object put(Object state, FObject value);

  // Remove an object
  public Object remove(Object state, FObject value);

  // Update an object
  default Object update(Object state, FObject oldValue, FObject value) {
    state = remove(state, oldValue);
    return put(state, value);
  }

  // Remove all objects
  public Object removeAll();

  public FObject find(Object state, Object key);

  // Create a Plan for a select()
  public SelectPlan planSelect(Object state, Sink sink, long skip, long limit, Comparator order, Predicate predicate);

  // Create a Plan and then execute it directly.
  default public void select(Object state, Sink sink, long skip, long limit, Comparator order, Predicate predicate) {
    planSelect(state, sink, skip, limit, order, predicate).select(state, sink, skip, limit, order, predicate);
  }

  /**
   * True when this Index already answers everything the given Index would, so
   * adding that one would be redundant.
   *
   * Redundant is not the same as equal: an index on (a, b) also answers lookups
   * on a through its leading level, because planSelect asks every index to plan
   * and keeps the cheapest. The reverse does not hold - (a, b) after (a) orders
   * within each a group and is a genuinely new index.
   *
   * Answering false is always safe; it only means a redundant index may be
   * built. Answering true wrongly loses an index, and there is no removeIndex.
   */
  default boolean covers(Index other) {
    return false;
  }

  /**
   * True when the FObject stored through this Index can be read straight back
   * out of one of its states, so a structure holding that state need not keep
   * its own copy of the object's index key.
   *
   * ValueIndex answers true: its state is the object. TreeIndex answers whatever
   * its tail answers, because a node's value is a state of the tail. Everything
   * else answers false, ProxyIndex and its subclasses included - their state is
   * whatever wrap() produced, and getting the object back needs unwrap(), which
   * needs the Index.
   *
   * Answering false is always safe; it only means a caller keeps a key it could
   * have derived. Answering true wrongly hands out a wrapper as an FObject.
   */
  default boolean reachesObject() {
    return false;
  }

  // Return number of objects stored in this Index
  public long size(Object state);

  // Wrap an object when stored in this Index
  public Object wrap(Object state);

  // Unwrap an object stored in this Index. o == unwrap(wrap(o))
  public Object unwrap(Object state);

  // Flushes the state
  public void flush(Object state) throws IOException;

  // Future:
  // toString()
  // bulkLoad()
}
