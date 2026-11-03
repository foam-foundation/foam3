/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

/**
 * FSMDAO - A DAO decorator that validates state machine transitions and executes callbacks.
 *
 * When an object with a StateMachine property is put and the state has changed,
 * this decorator:
 *
 * 1. Validates the transition is allowed (checks transitions array)
 * 2. Checks permissions (if configured)
 * 3. Runs guard functions (if configured)
 * 4. Executes onExit callback on the old state
 * 5. Executes onTransition callback (if defined for this transition)
 * 6. Records the transition in history
 * 7. Executes onEnter callback on the new state
 * 8. Updates nextActivity timestamp
 * 9. Delegates to the underlying DAO
 *
 * This ensures state machine rules are enforced at the DAO level,
 * preventing invalid transitions regardless of how the object is modified
 * (UI, API, CRON jobs, etc.).
 */

package foam.dao;

import foam.core.auth.AuthService;
import foam.core.auth.Subject;
import foam.core.auth.User;
import foam.core.logger.Logger;
import foam.dao.*;
import foam.lang.ClassInfo;
import foam.lang.FObject;
import foam.lang.PropertyInfo;
import foam.lang.StateMachineEnum;
import foam.lang.StateTransition;
import foam.lang.X;
import java.util.*;

public class FSMDAO
  extends ProxyDAO
{
  protected PropertyInfo prop_;
  protected PropertyInfo nextActivityProp_;  // might not exist
  protected PropertyInfo historyProp_;       // might not exist
  protected PropertyInfo payloadProp_;       // might not exist
  protected boolean      skipCallbacksOnCreate_ = false;

  /*
  public FSMDAO(X x, DAO delegate) {
    this(x, findStateMachineProp(delegate.getOf()), delegate);
  }
  */

  public FSMDAO(X x, PropertyInfo prop, DAO delegate) {
    super(x, delegate);
    this.prop_ = prop;

    historyProp_      = (PropertyInfo) delegate.getOf().getAxiomByName(prop.getName() + "History");
    payloadProp_      = (PropertyInfo) delegate.getOf().getAxiomByName(prop.getName() + "Payload");
    nextActivityProp_ = (PropertyInfo) delegate.getOf().getAxiomByName(prop.getName() + "NextActivity");
  }

  /**
   * Constructor for polymorphic class hierarchies where the status property
   * (and optionally its siblings) live on subclasses rather than on the
   * DAO's declared type.
   *
   * All four props — status, statusHistory, statusPayload, statusNextActivity
   * — are wrapped in NamedPropertyInfos that resolve the target axiom
   * from each object's own ClassInfo on every get/set. Siblings can live
   * on the abstract base, on subclasses, or be absent entirely; the
   * existing null-tolerant handling inside recordTransition / updateNextActivity
   * still applies because NamedPropertyInfo.get/set safely no-op when
   * the named axiom is missing.
   */
  public FSMDAO(X x, String propName, DAO delegate) {
    super(x, delegate);
    this.prop_             = foam.lang.NamedPropertyInfo.forName(propName);
    this.historyProp_      = foam.lang.NamedPropertyInfo.forName(propName + "History");
    this.payloadProp_      = foam.lang.NamedPropertyInfo.forName(propName + "Payload");
    this.nextActivityProp_ = foam.lang.NamedPropertyInfo.forName(propName + "NextActivity");
  }

  public FSMDAO setSkipCallbacksOnCreate(boolean skip) {
    this.skipCallbacksOnCreate_ = skip;
    return this;
  }

  public FObject put_(X x, FObject obj) {
    Object newStateObj = prop_.get(obj);

    if ( ! ( newStateObj instanceof StateMachineEnum ) ) {
      // Null is expected when this FSMDAO is stacked over a class hierarchy
      // (NamedPropertyInfo) and the named axiom isn't present on the subclass.
      // Quietly delegate; logging only the non-null/non-enum case to flag
      // genuinely unexpected property types.
      if ( newStateObj != null ) {
        foam.core.logger.StdoutLogger.instance().warning("! (newStateObj instanceof StateMachineEnum) ===>" + newStateObj.getClass());
        // System.out.println("! (newStateObj instanceof StateMachineEnum) ===>" + newStateObj.getClass() );
      }
      return getDelegate().put_(x, obj);
    }

    StateMachineEnum newState = (StateMachineEnum) newStateObj;

    // Try to find existing object to get old state
    FObject          oldObj   = null;
    StateMachineEnum oldState = null;

    try {
      Object id = obj.getProperty("id");
      if ( id != null ) {
        oldObj = getDelegate().find_(x, id);
        if ( oldObj != null ) {
          Object oldStateObj = prop_.get(oldObj);
          if ( oldStateObj instanceof StateMachineEnum ) {
            oldState = (StateMachineEnum) oldStateObj;
          }
        }
      }
    } catch (Exception e) {
      // Object doesn't exist yet, this is a create
    }

    // If no old state, this is a new object
    if ( oldState == null ) {
      validateAndExecuteCreate(x, obj, newState);
      obj = getDelegate().put_(x, obj);
      oldState = (StateMachineEnum) prop_.get(obj);
      // allow the onUpdate to set the real inital state
    }

    // If state hasn't changed, give the current state a chance to
    // inspect the updated payload and self-transition via onUpdate
    if ( oldState == newState ) {
      FObject payload = payloadProp_ != null ? (foam.lang.FObject) payloadProp_.get(obj) : null;
      StateMachineEnum stateAfterUpdate = oldState.onUpdate(x, obj, payload);
      // Loop this code until onUpdate returns the same state, to allow for multiple self-transitions in a row if needed
      do {
        if ( stateAfterUpdate != oldState ) {
          // State changed as a result of onUpdate - validate and execute
          prop_.set(obj, stateAfterUpdate);
          executeTransition(x, obj, oldObj, oldState, stateAfterUpdate);
          oldState = stateAfterUpdate;
        }
        stateAfterUpdate = oldState.onUpdate(x, obj, payload);
      } while ( stateAfterUpdate != oldState && ! ((StateMachineEnum) stateAfterUpdate).getIsWizardStep() );
      return getDelegate().put_(x, obj);
    }

    // State was changed externally (e.g. explicit action) - validate and execute
    executeTransition(x, obj, oldObj, oldState, newState);

    return getDelegate().put_(x, obj);
  }

  protected void validateAndExecuteCreate(X x, FObject obj, StateMachineEnum newState) {
    // Validate initial state
    if ( ! newState.getIsInitial() ) {
      throw new RuntimeException(
        "Cannot create object with non-initial state: " + newState.getName()
      );
    }

    // Execute onEnter for initial state (unless skipped)
    if ( ! skipCallbacksOnCreate_ ) {
      newState.onEnter(x, obj, null);
    }

    // Set initial nextActivity
    updateNextActivity(obj, newState);
  }


  protected void executeTransition(
    X x, FObject obj, FObject oldObj, StateMachineEnum oldState, StateMachineEnum newState
  ) throws foam.lang.ValidationException
  {
    String newStateName = newState.getName();

    // 1. Check transition is defined
    String[] transitions = oldState.getTransitions();
    boolean validTransition = false;
    for ( String t : transitions ) {
      if ( t.equals(newStateName) ) {
        validTransition = true;
        break;
      }
    }
    if ( oldState.getIsTerminal() && newState.getIsInitial() ) {
      validTransition = true;
    }

    if ( ! validTransition ) {
      throw new RuntimeException(
        "Invalid state transition: " + oldState.getName() + " -> " + newStateName +
        ". Allowed transitions: [" + String.join(", ", transitions) + "]"
      );
    }

    // 2. Check permissions
    checkPermissions(x, oldState, newState);

    // 3. Run guard, throws ValidationException if blocked
    oldState.checkGuard(x, obj, newState);

    // 4. Execute onExit
    oldState.onExit(x, obj, newState);

    // 5. Execute onTransition
    oldState.onTransition(x, obj, newState);

    // 6. Record history
    recordTransition(x, obj, oldState, newState);

    // 7. Execute onEnter
    newState.onEnter(x, obj, oldState);

    // 8. Update nextActivity
    updateNextActivity(obj, newState);
  }


  protected void checkPermissions(X x, StateMachineEnum oldState, StateMachineEnum newState) {
    String[] permissions = oldState.getPermissions(newState.getName());
    if ( permissions == null || permissions.length == 0 ) {
      return;
    }

    AuthService auth = (AuthService) x.get("auth");
    if ( auth == null ) {
      Logger logger = (Logger) x.get("logger");
      if ( logger != null ) {
        logger.warning("FSMDAO: No auth service in context, skipping permission check");
      }
      return;
    }

    boolean hasPermission = false;
    for ( String perm : permissions ) {
      try {
        if ( auth.check(x, perm) ) {
          hasPermission = true;
          break;
        }
      } catch (Exception e) {
        // Permission check failed
      }
    }

    if ( ! hasPermission ) {
      throw new RuntimeException(
        "Permission denied for transition: " + oldState.getName() + " -> " + newState.getName() +
        ". Required permission: " + String.join(" or ", permissions)
      );
    }
  }


  protected void recordTransition(
    X x, FObject obj, StateMachineEnum oldState, StateMachineEnum newState
  ) {
    if ( historyProp_ == null ) {
      return;
    }

    // Get user info from context
    String userId   = "";
    String userName = "";

    Subject subject = (Subject) x.get("subject");
    if ( subject != null ) {
      User user = subject.getUser();
      if ( user != null ) {
        userId = String.valueOf(user.getId());
        userName = user.toSummary();
      }
    }

    // Get optional transition note from context
    String note = (String) x.get("transitionNote");
    if ( note == null ) note = "";

    // Create transition record
    StateTransition transition = new StateTransition.Builder(x)
      .setFrom(oldState.getName())
      .setTo(newState.getName())
      .setTimestamp(new Date())
      .setUserId(userId)
      .setUserName(userName)
      .setNote(note)
      .build();

    if ( payloadProp_ != null ) {
      transition.setPayload((FObject) payloadProp_.get(obj));
      payloadProp_.clear(obj);
    }

    // Append to history
    StateTransition[] currentHistory = (StateTransition[]) historyProp_.get(obj);
    StateTransition[] newHistory;

    if ( currentHistory == null || currentHistory.length == 0 ) {
      newHistory = new StateTransition[] { transition };
    } else {
      newHistory = Arrays.copyOf(currentHistory, currentHistory.length + 1);
      newHistory[currentHistory.length] = transition;
    }

    historyProp_.set(obj, newHistory);
  }


  protected void updateNextActivity(FObject obj, StateMachineEnum state) {
    if ( nextActivityProp_ == null ) {
      return;
    }

    long scheduledTime = state.getScheduledTime();
    if ( scheduledTime > 0 ) {
      Date nextActivity = new Date(System.currentTimeMillis() + scheduledTime);
      nextActivityProp_.set(obj, nextActivity);
    } else if ( scheduledTime < 0 ) {
      // Explicit clear: state signals it has no pending deadline
      nextActivityProp_.set(obj, null);
    }
    // scheduledTime == 0 (default): leave untouched — onEnter may have already set a deadline
  }


  /*
  protected static PropertyInfo findStateMachineProp(ClassInfo classInfo) {
    //    List<PropertyInfo> props = classInfo.getAxiomsByClass(StateMachine.class); // TODO: how to tell difference between Enums and ClassInfos
    List props = classInfo.getAxiomsByClass(foam.lang.AbstractEnumPropertyInfo.class);

    if ( props != null && ! props.isEmpty() ) {
      return (PropertyInfo) props.get(0);
    }

    return null;
  }
  */

  /*
  protected List<StateMachineEnum> getInitialStates(StateMachineEnum state) {
    List<StateMachineEnum> initial = new ArrayList<>();

    // Get all values from the enum class
    StateMachineEnum[] values = (StateMachineEnum[]) state.getValues();
    for ( StateMachineEnum s : values ) {
      if ( s.getIsInitial() ) {
        initial.add(s);
      }
    }

    return initial;
  }
  */
}
