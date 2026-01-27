/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */
package foam.dao.index;

import foam.lang.FObject;
import foam.lang.Indexer;
import foam.dao.Sink;
import foam.mlang.order.Comparator;
import foam.mlang.order.Desc;
import foam.mlang.predicate.Predicate;

/**
 * ScanPlan will strore the state which already deal with some operate ex: GT, EQ, LT... The sate will smaller than the orign state, which will make
 * the search more faster.
 */
public class ScanPlan
  implements SelectPlan
{
  protected Object     state_;
  protected Comparator order_;
  protected Predicate  predicate_;
  protected long       limit_;
  protected long       cost_;
  protected Index      tail_;
  protected boolean    reverse_ = false;

  // TODO: add ThenBy support for 'order'
  public ScanPlan(Object state, long skip, long limit, Comparator order, Predicate predicate, Indexer indexer, Index tail) {
    state_     = state;
    limit_     = limit;
    order_     = order;
    predicate_ = predicate;
    cost_      = calculateCost(indexer, skip, limit);
    tail_      = tail;
  }

  public long calculateCost(Indexer indexer, long skip, long limit) {
    long cost;

    if ( state_ == null ) return 0;

    cost = ((TreeNode) state_).size;
    boolean sortRequired = false;
    if ( order_ != null ) {
      // ???: Why do we do a toString() here?
      if ( order_.toString().equals(indexer.toString()) ) {
        // If the index is same with the property we would like to order, the order could be set to null. Because the order is already correct in the tree set.
        order_ = null;
      } else if ( order_ instanceof Desc && ((Desc) order_).getArg1().toString().equals(indexer.toString()) && predicate_ == null ) {
        reverse_ = true;
        order_   = null;
      } else {
        sortRequired = true;
        cost *= Math.log(cost) / Math.log(2);
      }
    }

    if ( ! sortRequired && skip != 0 ) cost = Math.max(cost - skip, 0);

    return cost;
  }

  public long cost() { return cost_; }

  @Override
  public void select(Object unused, Sink sink, long skip, long limit, Comparator order, Predicate predicate) {
    if ( state_ == null ) return;
    // Use the state_, order_, predicate_... which we have already pre-processed.
    ((TreeNode) state_).select((TreeNode) state_, sink, skip, limit_, order_, predicate_, tail_, reverse_);
  }

  public SelectPlan restate(Object state) {
    // Not needed because ScanPlan stores its state in state_
    return this;
  }

  @Override
  public String toString() {
    var sortRequired = order_ != null;
    var size = state_ == null ? 0 : state_ instanceof TreeNode ? ((TreeNode) state_).size : 1;
    return "scan(size:" + size + ", cost:" + cost() + ", sortRequired:" + sortRequired + ")";
  }
}
