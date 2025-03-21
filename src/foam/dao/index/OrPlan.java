/**
 * @license Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */
package foam.dao.index;

import foam.dao.AbstractDAO;
import foam.dao.Sink;
import foam.mlang.order.Comparator;
import foam.mlang.predicate.Or;
import foam.mlang.predicate.Predicate;
import java.util.List;
import static foam.dao.AbstractDAO.decorateDedupSink_;
import static foam.dao.AbstractDAO.decorateSink;


public class OrPlan implements SelectPlan {
  protected Predicate[]      predicates_;
  protected List<SelectPlan> planList_;

  public OrPlan(Predicate predicate, List planList) {
    predicates_ = ((Or) predicate).getArgs();
    planList_   = planList;
  }

  public long cost() {
    long cost = 0;
    for ( SelectPlan plan : planList_ ) cost += plan.cost();
    return cost;
  }

  public void select(Object state, Sink sink, long skip, long limit, Comparator order, Predicate predicate) {
    if ( planList_ == null || planList_.isEmpty() )
      return;

    sink = decorateSink(null, sink, skip, limit, order, null);
    sink = decorateDedupSink_(sink); // Comes second so that duplicates aren't counted for skip and limit

    int i = 0;
    for ( SelectPlan plan : planList_ ) {
      Predicate p = i < predicates_.length ? predicates_[i++] : null;
      plan.select(state, sink, 0, AbstractDAO.MAX_SAFE_INTEGER, null, p);
    }
    sink.eof();
  }

  public SelectPlan restate(Object state) { return new RestatedPlan(state, this); }

  @Override
  public String toString() {
    var sb = new StringBuilder();
    sb.append("or(");
    for ( int i = 0 ; i < planList_.size() ; i++ ) {
      if ( i > 0 ) sb.append(", ");
      sb.append(planList_.get(i).toString());
    }
    sb.append(")");
    return sb.toString();
  }
}
