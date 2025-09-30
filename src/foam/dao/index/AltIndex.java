/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 *     http://www.apache.org/licenses/LICENSE-2.0
 */
package foam.dao.index;

import foam.lang.FObject;
import foam.dao.AbstractSink;
import foam.dao.Sink;
import foam.mlang.order.Comparator;
import foam.mlang.predicate.Predicate;
import java.util.ArrayList;

/** Note this class is not thread safe because ArrayList isn't thread-safe. Needs to be made safe by containment. **/
public class AltIndex
  extends AbstractIndex
{
  public final static int GOOD_ENOUGH_PLAN_COST = 10;

  protected ArrayList<Index> delegates_ = new ArrayList();

  public AltIndex(Index... indices) {
    for ( int i = 0 ; i < indices.length ; i++ )
      addIndex(null, indices[i]);
  }

  public Object addIndex(Object state, Index i) {
    delegates_.add(i);

    // No data to copy when just adding first index
    if ( delegates_.size() == 1 ) return state;

    // No state means no data to copy
    if ( state == null ) return state;

    // Copy all data from first index into new index, updating state
    final Object[] sa = cloneState(state);
    Sink sink = new AbstractSink() {
      public void put(Object obj, foam.lang.Detachable sub) {
        try {
          sa[sa.length-1] = i.put(sa[sa.length-1], (FObject) obj);
        } catch (ClassCastException e) {
          // Expected for Indices of subclasses
        } catch (NullPointerException e) {
          // Expected for Dot() Indexes when FObject is null
        }
      }
    };

    try {
      delegates_.get(0).planSelect(sa[0], sink, 0, Long.MAX_VALUE, null, null).select(sa[0], sink, 0, Long.MAX_VALUE, null, null);
    } catch (Throwable t) {
      t.printStackTrace();
    }

    return sa;
  }

  // Add Index which skips bulkload
  public Object addStoreIndex(Object state, Index i) {
    delegates_.add(i);
    return state;
  }

  protected Object[] cloneState(Object state) {
    Object[] s2 = new Object[delegates_.size()];

    if ( state != null ) {
      Object[] s1 = (Object[]) state;

      for ( int i = 0 ; i < s1.length ; i++ ) {
        s2[i] = s1[i];
      }
    }

    return s2;
  }

  public Object put(Object state, FObject value) {
    Object[] s = cloneState(state);

    for ( int i = 0 ; i < delegates_.size() ; i++ )
      try {
        s[i] = delegates_.get(i).put(s[i], value);
      } catch (Throwable t) {
        t.printStackTrace();
      }

    return s;
  }


  public Object remove(Object state, FObject value) {
    Object[] s = cloneState(state);

    for ( int i = 0 ; i < delegates_.size() ; i++ )
      try {
        s[i] = delegates_.get(i).remove(s[i], value);
      } catch (Throwable t) {
        t.printStackTrace();
      }

    return s;
  }

  public Object update(Object state, FObject oldValue, FObject value) {
    Object[] s = cloneState(state);

    for ( int i = 0 ; i < delegates_.size() ; i++ )
      try {
        s[i] = delegates_.get(i).update(s[i], oldValue, value);
      } catch (Throwable t) {
        t.printStackTrace();
      }

    return s;
  }

  public Object removeAll() {
    Object[] s = cloneState(null);

    for ( int i = 0 ; i < delegates_.size() ; i++ )
      try {
        s[i] = delegates_.get(i).removeAll();
      } catch (Throwable t) {
        t.printStackTrace();
      }

    return s;
  }

  public FObject find(Object state, Object key) {
    if ( state == null ) return null;

    return delegates_.get(0).find(((Object[]) state)[0], key);
  }

  public SelectPlan planSelect(Object state, Sink sink, long skip, long limit, Comparator order, Predicate predicate) {
    if ( state == null ) return NotFoundPlan.instance();

    Object[]   s         = (Object[]) state;
    SelectPlan bestPlan  = NoPlan.instance();
    Object     bestState = null;

    for ( int i = 0 ; i < delegates_.size() && i < s.length ; i++ ) {
      try {
      SelectPlan plan = delegates_.get(i).planSelect(s[i], sink, skip, limit, order, predicate);

      if ( plan.cost() < bestPlan.cost() ) {
        bestPlan  = plan;
        bestState = s[i];
        if ( bestPlan.cost() <= GOOD_ENOUGH_PLAN_COST ) break;
      }
    } catch (Throwable t) {
      System.err.println("********* ERROR PLANNING SELECT " + i + " " + delegates_.get(i));

      t.printStackTrace();
    }
    }

    return bestPlan.restate(bestState);
  }

  public long size(Object state) {
    if ( state == null ) return 0;
    Object[] s = (Object[]) state;
    return s.length > 0 ? delegates_.get(0).size(s[0]) : 0;
  }
}
