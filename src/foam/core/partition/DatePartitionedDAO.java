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
  public final static long DAY                 = 24 * 60 * 60 * 1000; // 1 day in ms
  public final static int  DEFAULT_TIME_WINDOW = 5 * 7;               // five weeks

  // A Sink decorator which allows the delegate Sink to be fed to the select()
  // method of multiple DAOs. If one of the DAOs detaches the isDetached()
  // method will return true. This means the Sink doesn't need to be passed
  // to the remaining DAOs. The eof() method is NOP-ed but needs to be called
  // at the end of feeding the Sink to multiple DAOs.
  public static class DetachableSink extends ProxySink implements Detachable {

    protected boolean isDetached_ = false;

    public DetachableSink(Sink delegate) {
      super(delegate);
    }

    public void put(Object obj, Detachable sub) {
      if ( isDetached() ) return;

      getDelegate().put(obj, this);

      if ( isDetached() && sub != null ) sub.detach();
    }

    public void eof() {
      // NOP because will be fed to multiple DAOs
    }

    public boolean isDetached() {
      return isDetached_;
    }

    public void detach() {
      // System.err.println("***************** DETACHING SINK");
      isDetached_ = true;
    }
  } // DetachableSink


  protected int timeWindow_ = DEFAULT_TIME_WINDOW;

  public DatePartitionedDAO(X x, ClassInfo of, String dirName, Expr partitionProperty) {
    super(x, of, dirName, partitionProperty);
  }

  public void setTimeWindow(int days) {
    timeWindow_ = days;
  }

  public int getTimeWindow() {
    return timeWindow_;
  }

  public String getPartition(FObject o) {
    Date d = (Date) getPartitionProperty().f(o);

    Calendar cal = Calendar.getInstance();
    cal.setTime(d);
    int year  = cal.get(Calendar.YEAR);
    int month = cal.get(Calendar.MONTH);

    // 'month' starts at 0, so move to base 1 to be easier for humans
    return year + "/" + (month+1);
  }

  public String[] getPartitions(Date[] range) {
    Calendar c1 = Calendar.getInstance();
    c1.setTime(range[0]);
    int y1 = c1.get(Calendar.YEAR);
    int m1 = c1.get(Calendar.MONTH);

    Calendar c2 = Calendar.getInstance();
    c2.setTime(range[1]);
    int y2 = c2.get(Calendar.YEAR);
    int m2 = c2.get(Calendar.MONTH);

    String[] parts = new String[(y2-y1) * 12 + m2 - m1 + 1];

    for ( int i = 0, y = y1, m = m1 ; i < parts.length ; i++ ) {
      parts[i] = getPartition(y + "/" + m);
      m++;
      if ( m == 12 ) { m = 0; y++; }
    }

    return parts;
  }

  public Sink select_(X x, Sink sink, long skip, long limit, Comparator order, Predicate predicate) {
    // System.err.println("***** DPD Select " + skip + " " + limit + " " + order + " " + predicate);
    Date[]   range = extractPredicateRange(predicate);
    // System.err.println("********** DATE PART RANGE " + range[0] + " " + range[1]);
    String[] parts = getPartitions(range);
    // System.err.println("********** DATE PART PARTS " + parts.length);

    // Predicate is still needed because partitions can still contain data outside of the range
    Sink           s2 = decorateSink(null, sink, skip, limit, order, predicate);
    DetachableSink s3 = new DetachableSink(s2);

    for ( int i = 0 ; i < parts.length ; i++ ) {
      DAO dao = getDelegate(parts[i]);

      dao.select(s3);
      if ( s3.isDetached() ) break;
    }

    s2.eof();

    return sink;
  }

  public Date[] extractPredicateRange(Predicate predicate) {
    Date[] range = new Date[] { null, null };

    extractPredicateRange(range, predicate);

    long window = (long) getTimeWindow() * DAY;

    if ( range[0] == null && range[1] == null ) {
      range[0] = new Date(System.currentTimeMillis() - window);
      range[1] = new Date(System.currentTimeMillis() + 24*3600*1000); // tomorrow
    } else if ( range[0] == null ) {
      range[0] = new Date(range[1].getTime() - window);
    } else if ( range[1] == null ) {
      range[1] = new Date(range[0].getTime() + window);
    }

    return range;
  }

  public Date maxDate(Date d1, Date d2) {
    if ( d1 == null ) return d2;
    return d1.compareTo(d2) < 1 ? d2 : d1;
  }

  public Date minDate(Date d1, Date d2) {
    if ( d1 == null ) return d2;
    return d1.compareTo(d2) > 1 ? d2 : d1;
  }

  public void extractPredicateRange(Date[] range, Predicate predicate) {
    if ( predicate instanceof Binary ) {
      Binary expr = (Binary) predicate;

      // Check if this binary predicate applies to our target property
      if ( expr.getArg1() == getPartitionProperty() ) {
        Class cls  = predicate.getClass();
        Date  date = (Date) expr.getArg2().f(expr);

        if ( cls == Eq.class ) {
          range[0] = range[1] = date;
        } else if ( cls == Gt.class || cls == Gte.class ) {
          range[0] = maxDate(range[0], date);
        } else if ( cls == Lt.class || cls == Lte.class ) {
          range[1] = minDate(range[1], date);
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

  public Object cmd_(X x, Object cmd) {
    if ( DEFAULT_QUERY_CMD.equals(cmd) ) {
      return ((PropertyInfo) getPartitionProperty()).getName() + " > TODAY-" + (getTimeWindow() /*+ 1*/); // ???: Should we add a day to be safe
    }

    return super.cmd_(x, cmd);
  }
}
