/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */
package foam.dao.index;

import foam.lang.Detachable;
import foam.lang.FObject;
import foam.dao.Sink;
import foam.mlang.order.Comparator;
import foam.mlang.predicate.Predicate;

public class ValueIndex
  extends AbstractIndex
{
  protected final static Detachable DETACH_SELECT = foam.dao.MDAO.DetachSelect.instance();

  protected final static ValueIndex instance_     = new ValueIndex();


  public static ValueIndex instance() {
    return instance_;
  }

  public void onAdd(Sink sink) {
  }

  public Object put(Object state, FObject value) {
    return value;
  }

  public Object remove(Object state, FObject value) {
    return null;
  }

  public Object removeAll() {
    return null;
  }

  public FObject find(Object state, Object key) {
    return null; // Why doesn't this return state?
  }

  public void select(Object state, Sink sink, long skip, long limit, Comparator order, Predicate predicate) {
    try {
      if ( predicate != null && ! predicate.f((FObject) state) ) return;
    } catch (ClassCastException e) {
      // Can happen when the Indexer is a PropertyInfo for a sub-class
      return;
    } catch (NullPointerException e) {
      // Can happen when the Indexer is Dot(x, y) when x is nullf
      return;
    }
    if ( skip > 0 ) return;
    if ( limit <= 0 ) return;
    sink.put(state, DETACH_SELECT);
  }

  public SelectPlan planSelect(Object state, Sink sink, long skip, long limit, Comparator order, Predicate predicate) {
    return ValuePlan.instance();
  }

  public long size(Object state) {
    return state == null ? 0 : 1;
  }

  public String toString() { return "ValueIndex()"; }
}
