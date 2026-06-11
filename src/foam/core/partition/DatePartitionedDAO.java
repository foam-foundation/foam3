/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.core.partition;

import foam.core.logger.Loggers;
import foam.dao.*;
import foam.lang.*;
import foam.mlang.Expr;
import foam.mlang.order.Comparator;
import foam.mlang.predicate.*;
import foam.mlang.predicate.Predicate;
import java.util.Calendar;
import java.util.Date;
import java.util.HashMap;

public class DatePartitionedDAO
  extends PartitionedDAO
{

  public DatePartitionedDAO(X x, ClassInfo of, String dirName, Expr partitionProperty) {
    super(x, of, dirName, partitionProperty);
  }

  public String getPartition(FObject o) {
    Date d = (Date) getPartitionProperty().f(o);

    Calendar cal = Calendar.getInstance();
    cal.setTime(d);
    int year  = cal.get(Calendar.YEAR);
    int month = cal.get(Calendar.MONTH);

    return year + "/" + month;
  }

  public synchronized DAO getDelegates(Date start, Date end) {
    return null;
  }


  public foam.dao.Sink select_(X x, Sink sink, long skip, long limit, Comparator order, Predicate predicate) {
    Object part = extractPredicateValue(predicate, (PropertyInfo) getPartitionProperty());
    // TODO: extract partition match or range
    // return sink;
    return getDelegate(String.valueOf(part)).select_(x, sink, skip, limit, order, predicate);
  }

  public Object extractPredicateRange(Predicate predicate, PropertyInfo property) {
    if ( predicate == null || property == null ) {
      return null;
    }

    if ( predicate instanceof Binary ) {
      Binary expr = (Binary) predicate;

      // Check if this binary predicate applies to our target property
      if ( expr.getArg1() == property ) {
        if ( predicate.getClass() == Eq.class ) {
          return expr.getArg2().f(expr);
        }
        /*
        // For range predicates, you could return a Range object or array
        if ( predicate.getClass().equals(Gt.class)  ||
             predicate.getClass().equals(Gte.class) ||
             predicate.getClass().equals(Lt.class)  ||
             predicate.getClass().equals(Lte.class) ) {
          return expr.getArg2().f(expr);
        }
        */
      }
    } else if ( predicate instanceof And ) {
      And andPredicate = (And) predicate;

      // Process each argument in the AND predicate
      for ( Predicate arg : andPredicate.getArgs() ) {
        Object value = extractPredicateValue(arg, property);
        if ( value != null ) {
          return value;
        }
      }
    }

    return null;
  }
}

/*
  FROM OrPlan.java:

  import static foam.dao.AbstractDAO.decorateDedupSink_;
  import static foam.dao.AbstractDAO.decorateSink;

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

*/
