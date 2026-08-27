/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 *     http://www.apache.org/licenses/LICENSE-2.0
 */
package foam.dao.index;

import foam.lang.FObject;
import foam.dao.ArraySink;
import foam.dao.Sink;
import foam.mlang.order.Comparator;
import foam.mlang.predicate.Predicate;
import java.util.ArrayList;
import java.util.List;

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

  /** The number of indexes held, so callers can tell whether an add took. */
  public int getIndexCount() { return delegates_.size(); }

  /** Covered when any one of the alternatives already covers it. */
  public boolean covers(Index other) {
    for ( int i = 0 ; i < delegates_.size() ; i++ ) {
      if ( delegates_.get(i).covers(other) ) return true;
    }
    return false;
  }

  public Object addIndex(Object state, Index i) {
    // Adding an index bulk-loads the whole DAO into it and every later put
    // maintains it, and there is no removeIndex to undo either cost. Callers
    // that cannot know what already exists rely on this being a no-op.
    if ( covers(i) ) {
      logCovered(i);
      return state;
    }

    delegates_.add(i);

    // No data to copy when just adding first index
    if ( delegates_.size() == 1 ) return state;

    // No state means no data to copy
    if ( state == null ) return state;

    // Copy all data from the first index into the new one. Reading the rows out
    // to an array first lets the new index build itself from them in one pass,
    // rather than being descended into - and cloning the path it descends - once
    // per row. The keys an index cannot derive are already tolerated where they
    // are derived, so this needs no per-row catch of its own.
    final Object[] sa = cloneState(state);

    try {
      ArraySink sink = new ArraySink();
      delegates_.get(0).planSelect(sa[0], sink, 0, Long.MAX_VALUE, null, null).select(sa[0], sink, 0, Long.MAX_VALUE, null, null);

      List rows = sink.getArray();
      sa[sa.length-1] = i.bulkLoad((FObject[]) rows.toArray(new FObject[rows.size()]), 0, rows.size()-1);
    } catch (Throwable t) {
      t.printStackTrace();
    }

    return sa;
  }

  /**
   * Say that an index was not added. A silently dropped index looks the same as
   * one that was never requested, and the difference matters when a query turns
   * out slow.
   *
   * Indexes are added while a DAO is still being built, so the thread's context
   * can be half assembled and reach a null delegate on the way to the logger.
   * Having nowhere to say it is not a reason to fail the skip.
   */
  protected void logCovered(Index i) {
    try {
      foam.lang.X x = foam.lang.XLocator.get();
      foam.core.logger.Logger logger = x == null ? null : (foam.core.logger.Logger) x.get("logger");
      if ( logger != null ) logger.info("Index already covered, not added", i.toString());
    } catch ( Throwable t ) {
      // No logger reachable yet.
    }
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

  /**
   * Build every alternative from the same rows. Each one sorts the range into
   * its own key order as it goes, so they run one after another rather than
   * over copies.
   */
  public Object bulkLoad(FObject[] a, int lo, int hi) {
    Object[] s = cloneState(null);

    for ( int i = 0 ; i < delegates_.size() ; i++ )
      try {
        s[i] = delegates_.get(i).bulkLoad(a, lo, hi);
      } catch (Throwable t) {
        t.printStackTrace();
      }

    return s;
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
