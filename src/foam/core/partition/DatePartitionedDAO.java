/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.core.partition;

import foam.core.COREService;
import foam.core.logger.Loggers;
import foam.dao.*;
import foam.lang.*;
import foam.mlang.Expr;
import foam.mlang.order.Comparator;
import foam.mlang.predicate.*;
import foam.mlang.predicate.Predicate;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.HashMap;
import java.util.List;

public class DatePartitionedDAO
  extends PartitionedDAO
  implements COREService
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


  protected int                     timeWindow_ = DEFAULT_TIME_WINDOW;
  protected boolean                 preload_    = false;
  protected DatePartitioningScheme  scheme_     = DatePartitioningScheme.YYYYMM;

  public DatePartitionedDAO(X x, ClassInfo of, String dirName, Expr partitionProperty) {
    super(x, of, dirName, partitionProperty);
  }

  public DatePartitionedDAO(X x, ClassInfo of, String dirName, Expr partitionProperty, DatePartitioningScheme scheme) {
    super(x, of, dirName, partitionProperty);
    scheme_ = scheme;
  }

  public void setTimeWindow(int days) {
    timeWindow_ = days;
  }

  public int getTimeWindow() {
    return timeWindow_;
  }

  /** Load the partitions of the default query window when the service
      starts, so the first query after a restart finds them resident instead
      of paying their replay. Off by default: a partition otherwise opens on
      its first touch. */
  public void setPreload(boolean preload) {
    preload_ = preload;
  }

  public boolean getPreload() {
    return preload_;
  }

  /** COREService hook: CSpecFactory.initService calls start() on every
      member of the service's delegate chain once the service is built, on
      the boot thread for a lazy:false CSpec and on the thread pool for a
      lazy one. A partition is either in the cache or not, and getDelegate
      synchronizes on the partition name, so a query that arrives while the
      pool is still loading a partition waits for that one load rather than
      seeing part of it. */
  public void start() {
    if ( preload_ ) preload();
  }

  /** Open every partition the default window covers: the same set a query
      with no date bound walks (see extractPredicateRange). */
  public void preload() {
    String[] parts = getPartitions(extractPredicateRange(null));
    Loggers.logger(getX(), this).info("Preloading partitions", getDirName(), parts.length);
    for ( String part : parts ) getDelegate(part);
  }

  public String getPartition(FObject o) {
    Date d = (Date) getPartitionProperty().f(o);

    // Which partition a record belongs to IS its date, so an unset one has no
    // answer -- name the DAO and the property rather than leaving a bare NPE
    // from Calendar.setTime for whoever migrates an old journal.
    if ( d == null ) {
      throw new RuntimeException("DatePartitionedDAO " + getDirName() + ": record has no "
        + ((PropertyInfo) getPartitionProperty()).getName() + ", id " + getID(o));
    }

    Calendar cal = Calendar.getInstance();
    cal.setTime(d);

    return scheme_.getPartition(cal);
  }

  public String[] getPartitions(Date[] range) {
    Calendar cal = Calendar.getInstance();
    cal.setTime(range[0]);
    Calendar end = Calendar.getInstance();
    end.setTime(range[1]);

    String       last  = scheme_.getPartition(end);
    List<String> parts = new ArrayList<>();
    while ( true ) {
      String p = scheme_.getPartition(cal);
      parts.add(p);
      // Equality with the range-end partition is the normal exit; the
      // calendar check bounds a contradictory (inverted) range, which
      // otherwise never reaches equality.
      if ( p.equals(last) || cal.after(end) ) break;
      scheme_.step(cal);
    }

    return parts.toArray(new String[0]);
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

    // The query goes into each partition so its MDAO can answer it from an
    // index instead of handing every row to s2's PredicatedSink. The
    // predicate always: partitions hold data outside the range, s2 filters
    // again, and a second filter only ever removes rows the first already
    // passed. The order and limit only when the limit is bounded, as a
    // per-partition top-(skip+limit): the partition sorts its own result,
    // s2's OrderedSink merges those into the global order, and the rows
    // dropped can never place inside a limit the merge respects. An
    // unbounded select pushes neither -- every row reaches s2 anyway, so a
    // per-partition sort would only buffer the same rows twice.
    boolean    bounded   = limit > 0 && limit < MAX_SAFE_INTEGER && skip < MAX_SAFE_INTEGER;
    long       partLimit = bounded ? skip + limit : MAX_SAFE_INTEGER;
    Comparator partOrder = bounded ? order : null;

    List<String> queuedIds = publishQueued(x, parts);
    try {
      for ( int i = 0 ; i < parts.length ; i++ ) {
        DAO dao = getDelegate(parts[i]);

        // Skip stays here: it counts across partitions, so s2 owns it.
        dao.select_(x, s3, 0, partLimit, partOrder, predicate);
        if ( s3.isDetached() ) break;
      }

      s2.eof();
    } finally {
      clearQueued(x, queuedIds);
    }

    return sink;
  }

  /** Publish a queued status row for each not-yet-loaded partition this
      select is about to iterate, so PartitionLoadToastStack can show
      "N of M" before the (synchronous, per-partition) load actually reaches
      them. Returns the ids published so the caller can clean up stragglers. */
  protected List<String> publishQueued(X x, String[] parts) {
    DAO status = (DAO) x.get("partitionLoadStatusDAO");
    if ( status == null ) return new ArrayList<>();

    List<String> ids = new ArrayList<>();
    for ( String part : parts ) {
      // A partition another caller is replaying right now already has a live
      // progress row -- re-marking it queued would clobber that row and our
      // clearQueued would then remove it mid-load.
      if ( isLoaded(part) || isLoading(part) ) continue;

      String journalName = journalNameFor(part);
      PartitionLoadStatus s = new PartitionLoadStatus();
      s.setId(journalName);
      s.setServiceName(getServiceName());
      s.setPartition(part);
      s.setTotalBytes(journalSize(journalName));
      s.setQueued(true);
      status.put(s);
      ids.add(journalName);
    }
    return ids;
  }

  /** Remove queued rows this select published but never reached (early
      detach, or another caller loaded the partition first). A row a real
      load has since taken over (queued == false) is left alone -- its own
      PartitionLoadReporter.done() removes it. */
  protected void clearQueued(X x, List<String> ids) {
    if ( ids.isEmpty() ) return;

    DAO status = (DAO) x.get("partitionLoadStatusDAO");
    if ( status == null ) return;

    for ( String id : ids ) {
      PartitionLoadStatus existing = (PartitionLoadStatus) status.find(id);
      if ( existing != null && existing.getQueued() ) {
        PartitionLoadStatus s = new PartitionLoadStatus();
        s.setId(id);
        status.remove(s);
      }
    }
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
