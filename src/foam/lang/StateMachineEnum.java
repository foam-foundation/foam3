/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

/**
 * StateMachineEnum - Interface for state machine enum values in Java.
 *
 * Enums that represent state machines should implement this interface
 * to work with FSMDAO for automatic transition validation and callbacks.
 */

package foam.lang;

import java.util.Arrays;
import java.util.Map;

public interface StateMachineEnum
  extends FEnum
{

  /** Get the enum value's name */
  String getName();

  /** Get the enum value's ordinal */
  int getOrdinal();

  String getPayloadModel();

  /** Get array of valid transition target state names */
  String[] getTransitions();

  /** Get whether this state is a wizard step */
  boolean getIsWizardStep();

  boolean getIsInitial();

  boolean getIsTerminal();

  /** Get permissions map of available transitions from the current state */
  Map getPermissions();

  /** Get permissions for a transition target state name */
  default String[] getPermissions(String stateName) {
    if (getPermissions() == null
        || getPermissions().isEmpty()
        || getPermissions().get(stateName) == null
    ) return null;

    Object permission = getPermissions().get(stateName);
    if ( permission instanceof Object[] ret ) {
      return Arrays.stream(ret).map(String::valueOf).toArray(String[]::new);
    } else {
      return new String[] { String.valueOf(permission) };
    }
  }

  /** Get the scheduled activity time in milliseconds (0 = none) */
  long getScheduledTime();

  /**
   * Check if the guard condition passes for a transition.
   * @param x Context
   * @param obj The object being transitioned
   * @param toState The target state
   * @throws ValidationException an exception explaing why the transition is blocked, if it is
   */
  void checkGuard(X x, FObject obj, StateMachineEnum toState)
    throws foam.lang.ValidationException;

  /**
   * Execute the onEnter callback.
   * @param x Context
   * @param obj The object entering this state
   * @param fromState The state being exited (null for initial creation)
   */
  void onEnter(X x, FObject obj, StateMachineEnum fromState);

  /**
   * Execute the onExit callback.
   * @param x Context
   * @param obj The object exiting this state
   * @param toState The state being entered
   */
  void onExit(X x, FObject obj, StateMachineEnum toState);

  /**
   * Execute the onTransition callback for a specific transition.
   * @param x Context
   * @param obj The object being transitioned
   * @param toState The target state
   */
  void onTransition(X x, FObject obj, StateMachineEnum toState);

  /**
   * Execute scheduledActivity for this state.
   * @param x Context
   * @param obj The object on which to run the scheduledActivity
   */
  void scheduledActivity(X x, FObject obj);

  /**
   * Execute the onUpdate callback.
   * Used specifically for cases where the state has not changed but the data might have changed
   * @param x Context
   * @param obj The object exiting this state
   * @param payload The payload for the current state
   * @return StateMachineEnum 
   */
  default StateMachineEnum onUpdate(X x, FObject obj, FObject payload) {
    return this;
  };

  /**
   * Create a new Payload object for this state, if the model specifies one.
   * Otherwise return null.
   * @param x Context
   */
  default FObject createPayload(X x) {
    // Was throwing NPE, beyond my paygrade -- Sarthak
    // String clsName = getPayloadModel();
    // return "".equals(clsName) ? (FObject) null : (FObject) ((foam.lang.X) foam.lang.XLocator.get()).create(clsName);

    String clsName = getPayloadModel();
    if ( "".equals(clsName) ) return null;

    try {
        Class<?> cls = Class.forName(clsName);
        return (FObject) x.create(cls);
    } catch (ClassNotFoundException e) {
        throw new RuntimeException("Could not find payload class: " + clsName, e);
    }
  }
}
