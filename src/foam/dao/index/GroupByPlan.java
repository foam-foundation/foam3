/**
 * @license Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */
package foam.dao.index;

import foam.lang.Indexer;
import foam.dao.Sink;
import foam.mlang.order.Comparator;
import foam.mlang.order.Desc;
import foam.mlang.predicate.Predicate;
import foam.mlang.sink.GroupBy;

public class GroupByPlan
  implements SelectPlan
{
  protected Object  state_;
  protected long    cost_;
  protected Index   tail_;
  protected Indexer indexer_;
  protected boolean reverseSort_ = false;
  protected boolean needGroupBy  = true;

  public GroupByPlan(Object state, Sink sink, Predicate predicate, Indexer indexer, Index tail) {
    state_   = state;
    cost_    = calculateCost(indexer);
    tail_    = tail;
    indexer_ = indexer;
  }

  public long calculateCost(Indexer indexer) {
    long cost;
    if ( state_ == null ) return 0;
    cost = ( (TreeNode) state_ ).size;
    return cost - 1;
  }

  public long cost() {
    return cost_;
  }

  public void select(Object unused, Sink sink, long skip, long limit, Comparator order, Predicate predicate) {
    if ( state_ == null ) return;
    ((TreeNode) state_).groupBy((TreeNode) state_, sink, tail_, indexer_);
  }

  public SelectPlan restate(Object state) {
    // Not needed because GroupByPlan stores its state in state_
    return this;
  }

  @Override
  public String toString() {
    var size = ( state_ == null ) ?
      0 :
      state_ instanceof TreeNode ? ((TreeNode) state_).size : 1;
    return "group-by(size:" + size + ", cost:" + cost() + ")";
  }
}
