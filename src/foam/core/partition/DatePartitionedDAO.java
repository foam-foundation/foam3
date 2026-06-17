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

  public String[] getPartitions(Date[] range) {
    Calendar c1 = Calendar.getInstance();
    c1.setTime(range[0]);
    int y1 = c1.get(Calendar.YEAR);
    int m1 = c1.get(Calendar.MONTH);

    Calendar c2 = Calendar.getInstance();
    c2.setTime(range[1]);
    int y2 = c1.get(Calendar.YEAR);
    int m2 = c1.get(Calendar.MONTH);

    String[] parts = new String[(y2-y1) * 12 + m2 - m1];

    for ( int i = 0, y = y1, m = m1 ; i < parts.length ; i++ ) {
      parts[i] = getPartition(y + "/" + m);
      m++;
      if ( m == 12 ) { m = 0; y++; }
    }

    return parts;
  }

  public foam.dao.Sink select_(X x, Sink sink, long skip, long limit, Comparator order, Predicate predicate) {
    Object part = extractPredicateValue(predicate);
    // TODO: extract partition match or range
    // return sink;
    return getDelegate(String.valueOf(part)).select_(x, sink, skip, limit, order, predicate);
  }

  public Date[] extractPredicateRange(Predicate predicate) {
    // TODO: make configurable
    // IDEA: alternatively, send null, null and then fill in default after
    Date   fiveWeeksAgo = new Date(System.currentTimeMillis() - (5L * 7 * 24 * 60 * 60 * 1000));
    Date[] range        = new Date[] {fiveWeeksAgo, new Date()};

    extractPredicateRange(range, predicate);

    return range;
  }

  public void extractPredicateRange(Date[] range, Predicate predicate) {
    /*
    if ( predicate == null ) {
      return;
    }
    */

    if ( predicate instanceof Binary ) {
      Binary expr = (Binary) predicate;

      // Check if this binary predicate applies to our target property
      if ( expr.getArg1() == getPartitionProperty() ) {
        Class cls  = predicate.getClass();
        Date  date = (Date) expr.getArg2().f(expr);

        // TODO: What do to if only one of < or > is defined?
        if ( cls == Eq.class ) {
          range[0] = range[1] = date;
        } else if ( cls == Gt.class || cls == Gte.class ) {
          range[0] = date;
        } else if ( cls == Lt.class || cls == Lte.class ) {
          range[1] = date;
        }
      }
    } else if ( predicate instanceof And ) {
      And andPredicate = (And) predicate;

      // Process each argument in the AND predicate
      for ( Predicate arg : andPredicate.getArgs() ) {
        extractPredicateRange(range, arg);
      }
    }
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
