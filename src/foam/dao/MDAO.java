/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */
package foam.dao;

import foam.lang.*;
import foam.dao.index.*;
import foam.mlang.MLang;
import foam.mlang.order.Comparator;
import foam.mlang.predicate.Or;
import foam.mlang.predicate.Predicate;
import foam.mlang.sink.GroupBy;
import foam.core.logger.Logger;
import foam.core.pm.PM;
import java.util.ArrayList;
import java.util.List;
import java.util.HashSet;
import java.util.Set;

/**
 The MDAO class for an ordering, fast lookup, single value,
 index multiplexer, or any other MDAO select() assistance class.

 The assitance class TreeIndex implements the
 data nodes that hold the indexed items and plan and execute
 queries. For any particular operational Index, there may be
 many IndexNode instances:

 <pre>
 1---------> TreeIndex(id)
 MDAO: AltIndex 2---------> TreeIndex(propA) ---> TreeIndex(id) -------------> ValueIndex
 | 1x AltIndexNode    | 1x TreeIndexNode    | 14x TreeIndexNodes         | (DAO size)x ValueIndexNodes
 (2 alt subindexes)     (14 nodes)             (each has 0-5 nodes)
 </pre>
 The base AltIndex has two complete subindexes (each holds the entire DAO).
 The TreeIndex on property A has created one TreeIndexNode, holding one tree of 14 nodes.
 Each tree node contains a tail instance of the next level down, thus
 the TreeIndex on id has created 14 TreeIndexNodes. Each of those contains some number
 of tree nodes, each holding one tail instance of the ValueIndex at the end of the chain.

 */
 // TODO: clone and freeze objects stored in memory
public class MDAO
  extends AbstractDAO
{
  public static class DetachSelect implements Detachable {
    private static Detachable instance__ = new DetachSelect();
    public  static Detachable instance() { return instance__; }

    public void detach() {
      throw DetachSelectException.instance();
    }
  }

  public static class DetachSelectException extends RuntimeException {
    private static StackTraceElement[] EMPTY_STACK = new StackTraceElement[0];

    private static DetachSelectException instance__ = new DetachSelectException();
    public  static DetachSelectException instance() { return instance__; }

    public void detach() {
      throw DetachSelectException.instance();
    }

    public StackTraceElement[] getStackTrace() {
      return EMPTY_STACK;
    }
  }

  // Safe mode clones objects in objIn(), which is safer but slower.
  // When doing an initial bulk load, JDAO sets safeMode to false to speed up
  // loading.
  protected boolean  safeMode_  = true;
  protected AltIndex index_;
  protected Object   state_     = null;
  protected Object   writeLock_ = new Object();
  protected Set      unindexed_ = new HashSet();

  /**
   * DAO Command to retrieve current MDAO state. Intented
   * to be used in Command WhenCmd
   */
  public final static String NOW_CMD = "NOW_CMD";

  /**
   * DAO Command to retrieve MDAO at some state.
   * Request a null state to retrieve 'now' or head of MDAO.
   */
  public static class WhenCmd {
    protected Object state_ = null;
    public void setState(Object state) {
      state_ = state;
    }

     public Object getState() {
      return state_;
    }

    public WhenCmd() {
    }

    public WhenCmd(Object state) {
      setState(state);
    }
  }

  public MDAO(ClassInfo of) {
    setOf(of);
    index_ = new AltIndex(new TreeIndex((Indexer) this.of_.getAxiomByName("id"), true));
  }

  public boolean getSafeMode() {
    return safeMode_;
  }

  public void setSafeMode(boolean mode) {
    safeMode_ = mode;
  }

  public void addIndex(Index index) {
    synchronized ( writeLock_ ) {
      setState(index_.addIndex(state_, index));
    }
  }

  // Add Index which skips bulkload
  public void addStoreIndex(Index index) {
    synchronized ( writeLock_ ) {
      setState(index_.addStoreIndex(state_, index));
    }
  }

  /** Add an Index which is for a unique value. Use addIndex() if the index is not unique. **/
  public void addUniqueIndex(Indexer... props) {
    Index idx = ValueIndex.instance();
    for ( var i = props.length-1 ; i >= 0 ; i-- ) idx = new TreeIndex(props[i], idx, i != 0);
    addIndex(idx);
  }

  /** Add an Index which is for a non-unique value. The 'id' property is
   * appended to property list to make it unique.
   **/
  public void addIndex(Indexer... props) {
    Index idx = new TreeIndex((Indexer) this.of_.getAxiomByName("id"), true);
    for ( var i = props.length-1 ; i >= 0 ; i-- ) idx = new TreeIndex(props[i], idx, i != 0);
    addIndex(idx);
  }

  synchronized Object getState() {
    return state_;
  }

  synchronized void setState(Object state) {
    state_ = state;
  }

  public FObject objIn(FObject obj) {
    return getSafeMode() ? obj.fclone().freeze() : obj.freeze();
  }

  public FObject objOut(FObject obj) {
    return obj;
  }

  public FObject put_(X x, FObject obj) {
    // Clone and freeze outside of lock to minimize time spent under lock
    obj = objIn(obj);

    synchronized ( writeLock_ ) {
      FObject oldValue = find_(x, obj);
      Object  state    = getState();

      if ( oldValue == null ) {
        setState(index_.put(state, obj));
      } else {
        setState(index_.update(state, oldValue, obj));
      }
    }

    onPut(obj);
    return obj;
  }

  public FObject remove_(X x, FObject obj) {
    if ( obj == null ) return null;

    FObject found;

    synchronized ( writeLock_ ) {
      found = find_(x, obj);

      if ( found != null ) {
        setState(index_.remove(getState(), found));
      }
    }

    if ( found != null ) {
      onRemove(found);
    }

    return found;
  }

  public FObject find_(X x, Object o) {
    Object state;

    state = getState();

    if ( o == null ) return null;

    // Convert full FObjects to just the primary key
    if ( getOf().isInstance(o) ) {
      o = getPrimaryKey().get(o);
    }

    return objOut((FObject) index_.find(state, o));
//    return objOut((FObject) index_.planFind(state, o).find(state, o));
  }

  public Sink select_(X x, Sink sink, long skip, long limit, Comparator order, Predicate predicate) {
    SelectPlan plan;
    Predicate  simplePredicate = null;
    PM         pm = null;

    // use partialEval to wipe out such useless predicate such as: And(EQ()) ==> EQ(), And(And(EQ()),GT()) ==> And(EQ(),GT())
    if ( predicate != null ) simplePredicate = predicate.partialEval();

    Object state = getState();

    // We handle OR logic by seperate request from MDAO. We return different plan for each parameter of OR logic.
    if ( simplePredicate instanceof Or ) {
      // When we have groupBy, order, skip, limit such requirement, we can't do it separately so I replace a array sink to temporarily hold the whole data
      // Then after the plan we change it to the origin sink
      int length = ((Or) simplePredicate).getArgs().length;
      List<SelectPlan> planList = new ArrayList<>();
      for ( int i = 0 ; i < length ; i++ ) {
        Predicate p = ((Or) simplePredicate).getArgs()[i];
        planList.add(index_.planSelect(state, NullSink.instance(), 0, AbstractDAO.MAX_SAFE_INTEGER, null, p));
      }
      plan = new OrPlan(simplePredicate, planList);
    } else {
      plan = index_.planSelect(state, sink, skip, limit, order, simplePredicate);
    }

    if ( state != null && simplePredicate != null && simplePredicate != MLang.TRUE && plan.cost() > 10 && plan.cost() >= index_.size(state) ) {
      pm = new PM(this.getClass(), "MDAO:UnindexedSelect:" + getOf().getId());
      if ( ! unindexed_.contains(getOf().getId()) ) {
        Logger logger = (Logger) x.get("logger");
        if ( ! predicate.equals(simplePredicate) && logger != null ) {
          logger.warning(String.format("The original predicate was %s but it was simplified to %s.", predicate.toString(), simplePredicate.toString()));
        }
        unindexed_.add(getOf().getId());
        if ( logger != null ) {
          logger.warning("Unindexed search on MDAO", getOf().getId(), simplePredicate.toString(), plan.toString());
        }
      }
    }

    try {
      plan.select(state, sink, skip, limit, order, simplePredicate);
    } catch (DetachSelectException e) {
      // NOP, not a real exception, just used to terminate a select early
    }

    if ( pm != null ) pm.log(x);

    sink.eof();
    return sink;
  }

  public void removeAll_(X x, long skip, long limit, Comparator order, Predicate predicate) {
    if ( predicate == null && skip == 0 && limit == MAX_SAFE_INTEGER ) {
      synchronized ( writeLock_ ) {
        setState(null);
      }
    } else {
      super.removeAll_(x, skip, limit, order, predicate);
    }
  }

  public Object cmd_(X x, Object cmd) {
    if ( DAO.LAST_CMD.equals(cmd) ) {
      return this;
    }
    if ( MDAO.NOW_CMD.equals(cmd) ) {
      return now();
    }
    if ( cmd instanceof MDAO.WhenCmd ) {
      Object state = ((MDAO.WhenCmd) cmd).getState();
      if ( state != null ) {
        return when(state);
      }
      return this;
    }
    if ( cmd instanceof AddIndexCommand ) {
      AddIndexCommand indexCmd = (AddIndexCommand) cmd;
      if ( indexCmd.getStore() ) {
        addStoreIndex((Index) indexCmd.getIndex());
      } else if ( indexCmd.getIndex() != null ) {
         addIndex((Index) indexCmd.getIndex());
      } else {
        if ( indexCmd.getUnique() ) {
          addUniqueIndex(indexCmd.getIndexers());
        } else {
          addIndex(indexCmd.getIndexers());
        }
      }
      return true;
    }
    return super.cmd_(x, cmd);
  }

  synchronized Object now() {
    return state_;
  }

  Object when(Object state) {
    MDAO newMDAO = new MDAO(getOf());
    newMDAO.setState(state);
    return newMDAO;
  }

  public String toString() {
    return "MDAO()";
  }
}
