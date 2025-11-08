/**
 * @license Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */
package foam.dao.index;

import foam.lang.FObject;
import foam.lang.Detachable;
import foam.lang.Indexer;
import foam.dao.AbstractDAO;
import foam.dao.Sink;
import foam.mlang.Expr;
import foam.mlang.Constant;
import foam.mlang.ArrayConstant;
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

      if ( predicate.getClass().equals(In.class) && expr.getArg1().toString().equals(indexer_.toString()) ) {
        var inPredicate = (In) predicate;
        var arg2 = inPredicate.getArg2();

        if ( arg2 instanceof Constant ) {
          /**
           * We can directly find key from tree.
           * eg: MLang.IN(FObject.ID, "foo")
           */
          state = ((TreeNode) state).get((TreeNode) state, arg2.f(inPredicate), indexer_);
          return new Object[] {state, null};
        } else if ( arg2 instanceof ArrayConstant ) {
          Object[] key = ((ArrayConstant) arg2).getValue();

          if ( key == null || key.length == 0 ) {
            /**
             * Return nothing.
             * eg: MLang.IN(FObject.ID, new Object[] {})
             */
            return new Object[] {null, null};
          } else if ( key.length == 1 ) {
            // eg: MLang.IN(FObject.ID, new Object[] {"foo"})
            state = ((TreeNode) state).get((TreeNode) state, key[0], indexer_);
            return new Object[] {state, null};
          } else {
            var treeRoot = (TreeNode) state;
            long treeLevel = (long) treeRoot.level;
            long treeheight = treeLevel; // treelevel is roughly equal to tree height.
            long totalEdge = 2 << treeheight; // roughly estimation of total path. 
            long averageEdge =  treeheight / 2; // roughly estimation of average edge jump required to search a key.

            double estimateCardinality = (double) totalEdge / (double) treeRoot.size;

            System.out.println("BBBBB average edge: " + averageEdge + ", require jump: " + averageEdge*key.length + ", total edge: " + totalEdge + ", estimateCardinality: " + estimateCardinality + ", tree level: " + treeLevel + ", tree height: " + treeheight);

            if ( averageEdge*key.length < totalEdge>>2 && estimateCardinality > 0.25 ) {
              /**
               * precondition: edge jump is less than total edge and high cardinality.
               * why need high cardinality?
               *  The below will copy match data to a new tree. 
               *  If the tail index contains many data, this optimization is not worth to do.
               *  Note: if the tree node can provide a method that put key and tail, 
               *          then we can simply put tail into new tree, without copy over all data in the index.
               */
              var sink = this.new TreeNodeSink();
              for ( int i = 0 ; i < key.length ; i++ ) {
                var node = treeRoot.get(treeRoot, key[i], indexer_);
                if ( node != null ) {
                  node.select(node, sink, 0, Long.MAX_VALUE, null, null, tail_, false);
                }
              }
              return new Object[] {sink.getState(), null}; 
            } else {
              /**
               * We can still trim the tree before full table scan.
               */
              Object minKey = key[0];
              Object maxKey = key[0];
              for ( int i = 1 ; i < key.length ; i++ ) {
                minKey = indexer_.comparePropertyToValue(minKey, key[i]) > 0 ? key[i] : minKey;
                maxKey = indexer_.comparePropertyToValue(maxKey, key[i]) < 0 ? key[i] : minKey;
              }

              state = ((TreeNode) state).lte((TreeNode) state, maxKey, indexer_);
              state = ((TreeNode) state).gte((TreeNode) state, minKey, indexer_);
              return new Object[] {state, predicate}; 
            }
          }
        }
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

  /**
   * This function tries to return an optimal plan based on its arguments.
   */
  @Override
  public SelectPlan planSelect(Object state, Sink sink, long skip, long limit, Comparator order, Predicate predicate) {
    if ( state == null || predicate instanceof False ) return NotFoundPlan.instance();
    Object   originalState  = state;
    Object[] statePredicate = simplifyPredicate(state, predicate);
    state     = statePredicate[0];
    predicate = (Predicate) statePredicate[1];

    if ( ! isPrimary_ && state == originalState && ( order == null || ! order.toString().equals(indexer_.toString()) ) ) {
      // Unless we're the primary index, we shouldn't offer a plan if we can't contribute
      return NoPlan.instance();
    }

    if ( predicate == null ) {
      // See if it's possible to do Count or GroupBy select efficiently.
      if ( sink instanceof Count && state != null ) {
        return new CountPlan(Math.min(limit, ((TreeNode) state).size));
      }

      // We return a groupByPlan only if no order, no limit, no skip, no predicate
      if ( sink instanceof GroupBy
        && ((GroupBy) sink).getArg1().toString().equals(indexer_.toString())
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

  private class TreeNodeSink implements Sink {
    TreeNode state_;

    TreeNodeSink() {
      state_ = TreeNode.getNullNode();
    }

    TreeNodeSink(TreeNode state) {
      state_ = state;
    }

    TreeNode getState() {
      return state_;
    }
    
    public void put(Object obj, Detachable sub) {
      state_ = state_.putKeyValue(state_, indexer_, returnKeyForValue((FObject) obj), (FObject) obj, tail_);
    }
    public void remove(Object obj, Detachable sub) {}
    public void eof() {}
    public void reset(Detachable sub) {}
  }
}
