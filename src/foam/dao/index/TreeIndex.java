/**
 * @license Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */
package foam.dao.index;

import foam.lang.FObject;
import foam.lang.Indexer;
import foam.dao.AbstractDAO;
import foam.dao.Sink;
import foam.mlang.Expr;
import foam.mlang.order.Comparator;
import foam.mlang.predicate.*;
import foam.mlang.sink.Count;
import foam.mlang.sink.GroupBy;
import java.util.Arrays;

public class TreeIndex
  extends AbstractIndex
{
  protected Index    tail_;
  protected Indexer  indexer_;
  protected long     selectCount_;
  // Non primary indices shouldn't provide plans unless they can contribute
  // because they might be partial indices on properties from sub-classes
  // so they will win auctions but only return a subset of the data.
  protected boolean  isPrimary_;

  public TreeIndex(Indexer indexer) {
    this(indexer, ValueIndex.instance(), false);
  }

  public TreeIndex(Indexer indexer, boolean isPrimary) {
    this(indexer, ValueIndex.instance(), isPrimary);
  }

  public TreeIndex(Indexer indexer, Index tail) {
    this(indexer, tail, false);
  }

  public TreeIndex(Indexer indexer, Index tail, boolean isPrimary) {
    indexer_     = indexer;
    selectCount_ = 0;
    tail_        = tail;
    isPrimary_   = isPrimary;
  }

  public Object bulkLoad(FObject[] a) {
    Arrays.parallelSort(a);
    return TreeNode.getNullNode().bulkLoad(tail_, indexer_, 0, a.length-1, a);
  }

  /**
   * This fuction helps to create a smaller state by applying predicates.
   * @param state: When we could deal with predicate efficiently by index, the returned state will be smaller than original state
   * @param predicate: If the state is kind of Binary state, when we deal with it and it will become null. If it is kind of N-arry state, the part of their predicate will become True or null.
   * @return Return an Object[] which contains two elements, first one is updated state and second one is updated predicate.
   */
  protected Object[] simplifyPredicate(Object state, Predicate predicate) {
    Predicate p = predicate;
    if ( predicate == null || indexer_ == null ) {
      return new Object[] {state, predicate};
    }

    if ( predicate instanceof Binary ) {
      Binary expr = (Binary) predicate;

      if ( predicate.getClass().equals(Eq.class) && expr.getArg1().toString().equals(indexer_.toString()) ) {
        state = ((TreeNode) state).get((TreeNode) state, expr.getArg2().f(expr), indexer_);
        return new Object[] {state, null};
      }

      // TODO: Handle NEQ
//      if ( predicate.getClass().equals(Neq.class) && expr.getArg1().toString().equals(indexer_.toString()) ) {
//        state = ( (TreeNode) state ).neq((TreeNode) state, expr.getArg2().f(expr), indexer_);
//        return new Object[]{state, null};
//      }

      if ( predicate.getClass().equals(Gt.class) && expr.getArg1().toString().equals(indexer_.toString()) ) {
        state = ((TreeNode) state).gt((TreeNode) state, expr.getArg2().f(expr), indexer_);
        return new Object[] {state, null};
      }

      if ( predicate.getClass().equals(Gte.class) && expr.getArg1().toString().equals(indexer_.toString()) ) {
        state = ((TreeNode) state).gte((TreeNode) state, expr.getArg2().f(expr), indexer_);
        return new Object[] {state, null};
      }

      if ( predicate.getClass().equals(Lt.class) && expr.getArg1().toString().equals(indexer_.toString()) ) {
        state = ((TreeNode) state).lt((TreeNode) state, expr.getArg2().f(expr), indexer_);
        return new Object[] {state, null};
      }

      if ( predicate.getClass().equals(Lte.class) && expr.getArg1().toString().equals(indexer_.toString()) ) {
        state = ( (TreeNode) state ).lte((TreeNode) state, expr.getArg2().f(expr), indexer_);
        return new Object[] {state, null};
      }
    } else if ( predicate instanceof And ) {
      int length = ((And) predicate).getArgs().length;

      // Just clone the predicate to not alter the original predicate
      p = (Predicate) ((And) predicate).shallowClone();
      for ( int i = 0 ; i < length ; i++ ) {
        Predicate arg = ((And) predicate).getArgs()[i];
        if ( arg != null && state != null ) {
          // Each args deal with by 'simplifyPredicate()' function recursively.
          Object[] statePredicate = simplifyPredicate(state, arg);
          state = statePredicate[0];
          arg   = (Predicate) statePredicate[1];
        }

        if ( arg == null ) {
          ((And) p).getArgs()[i] = foam.mlang.MLang.TRUE;
        }
      }

      // use partialEval to simplify predicate themselves.
      p = p.partialEval();
    }

    if ( p instanceof True ) p = null;

    return new Object[] {state, p};
  }

  public Object put(Object state, FObject value) {
    if ( state == null ) state = TreeNode.getNullNode();
    Object key = returnKeyForValue(value);
    // key could be null for values like Date fields, but that works
    return ((TreeNode) state).putKeyValue((TreeNode) state, indexer_, key, value, tail_);
  }

  public Object remove(Object state, FObject value) {
    Object key = returnKeyForValue(value);
    // key could be null for values like Date fields, but that works
    return ((TreeNode) state).removeKeyValue((TreeNode) state, indexer_, key, value, tail_);
  }

  public Object returnKeyForValue(FObject value) {
    try {
      return indexer_.f(value);
    } catch (ClassCastException e) {
// System.err.println("*** ClassCastException " + this);
      // Can happen when the Indexer is a PropertyInfo for a sub-class
    } catch (NullPointerException e) {
// System.err.println("*** NullPointerException " + this);
      // Can happen when the Indexer is Dot(x, y) when x is nullf
    }

    return null;
  }

  public Object removeAll() {
    return TreeNode.getNullNode();
  }

  public FObject find(Object state, Object key) {
    if ( state instanceof TreeNode ) {
      TreeNode stateNode = (TreeNode) state;
      TreeNode valueNode = stateNode.get(stateNode, key, indexer_);

      // If the object being searched for isn't in the tree, then valueNode will
      // be null.
      return valueNode == null ? null : (FObject) valueNode.value;
    }

    return null;
  }

  public boolean isSafeToRemoveOrder(Sink sink) {
    // Counts and GroupBys of only GroupBys and Counts are safe to ignore the order
    if ( sink instanceof Count   ) return true;
    // TODO? same for SUM(), MIN(), MAX(), ... if there is no limit
    if ( sink instanceof GroupBy ) return isSafeToRemoveOrder(((GroupBy) sink).getArg2());
    return false;
  }

  /**
   * This function tries to return an optimal plan based on its arguments.
   */
  @Override
  public SelectPlan planSelect(Object state, Sink sink, long skip, long limit, Comparator order, Predicate predicate) {
    if ( state == null || predicate instanceof False ) return NotFoundPlan.instance();

    // Try to simplify the query:

    Object   originalState  = state;
    Object[] statePredicate = simplifyPredicate(state, predicate);
    long     size           = state == null ? 0 : ((TreeNode) state).size;

    state     = statePredicate[0];
    predicate = (Predicate) statePredicate[1];

    // Treat as "no limit" if limit >= the size of the collection
    if ( limit >= size ) limit = AbstractDAO.MAX_SAFE_INTEGER;

    // Remove order if possible
    if ( order != null ) {
      if ( limit == AbstractDAO.MAX_SAFE_INTEGER && isSafeToRemoveOrder(sink) ) {
        order = null;
      } else if ( order.toString().equals(indexer_.toString()) ) {
        // The ScanPlan already performs this check, but doint it here will possibly
        // let the GroupByPlan be picked
        order = null;
      }
    }

    // Now the state, predicate, limit and order have all been simplified if possible

    if ( ! isPrimary_ && state == originalState && ( order == null || ! order.toString().equals(indexer_.toString()) ) ) {
      // Unless we're the primary index, we shouldn't offer a plan if we can't contribute
      return NoPlan.instance();
    }

    if ( predicate == null ) {
      // See if it's possible to do Count or GroupBy select efficiently.
      if ( sink instanceof Count && state != null ) {
        return new CountPlan(Math.min(limit, size));
      }

      // We return a groupByPlan only if no order, no limit, no skip, no predicate
      if ( sink instanceof GroupBy && ((GroupBy) sink).getArg1().toString().equals(indexer_.toString())
        && order == null && skip == 0 && limit == AbstractDAO.MAX_SAFE_INTEGER )
      {
        return new GroupByPlan(state, sink, predicate, indexer_, tail_);
      }
    }

    if ( state == null ) {
      // System.err.println("***** NOT FOUND IN TREE " + predicate + " " + indexer_);
      return NotFoundPlan.instance();
    }

    TreeNode tn = (TreeNode) state;
    // if ( tn.isSingular() ) System.err.println("***** SUBSCAN " + tn.size + " " + tn.key);

    // If the resulting tree contains only one node, then create a sub-plan
    // on the sub-tree, allowing for use of multi-part indices.
    return tn.isSingular() ?
      tail_.planSelect(tn.value, sink, skip, limit, order, predicate).restate(tn.value) :
      new ScanPlan(state, skip, limit, order, predicate, indexer_, tail_) ;
  }

  public long size(Object state) {
    return ((TreeNode) state).size;
  }

  public String toString() {
    return "TreeIndex(" + indexer_ + "," + tail_ + ")";
  }
}
