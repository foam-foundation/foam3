<flow name="FSM" category="DOC/GUIDE" spid="foam" description="FOAM state machines: foam.FSM, the StateMachine property, guards, permissions, lifecycle hooks, scheduled activities, payloads, history and FSMDAO." keywords="fsm,state machine,statemachine,transitions,guards,fsmdao,enum,knowledge"/>

# State Machines (FSM)

FOAM models a finite state machine as an Enum. Each value is one state. A model holds the
current state in a `StateMachine` property, and `FSMDAO` enforces the transition rules on the
server. This guide covers how to define one and use it, and lists the mistakes that are easy
to make.

Citations are to `src/foam/lang/` unless noted. Line numbers drift; if a citation no longer
lines up, look for the named method.

For Enum basics, read [Enum.md](Enum.md) first.

---

## 1. Defining a state machine

`foam.FSM(m)` is `foam.CLASS(m)` with the model class set to `foam.lang.StateMachineModel`
(`FSM.js:49-52`). `foam.StateMachine(m)` is an alias (`FSM.js:54-56`). `StateMachineModel`
extends `EnumModel`, and its instances extend `foam.lang.StateMachineEnum`
(`FSM.js:28-38`). So **a state machine is an Enum**: each entry in `values:` is a shared
singleton constant such as `OrderStatus.PENDING`.

Each state can declare:

| Key | Meaning | Source |
|-----|---------|--------|
| `transitions` | Names of the states this state may move to | `StateMachineEnum.js:14-17` |
| `isTerminal` | Derived: true when `transitions` is empty | `StateMachineEnum.js:18-25` |
| `isInitial` | An object may be created in this state | `StateMachineEnum.js:26-31` |
| `guards` | Map of target name → `function(x, obj)`. Returns a **reason string** that blocks the transition, or a falsy value to allow it. JS only | `StateMachineEnum.js:32-40`, `:197-202` |
| `permissions` | Map of target name → permission string, or an array of them (holding any one is enough) | `StateMachineEnum.js:41-50`, `:170-187` |
| `scheduledTime` | A `Long`: milliseconds until the state's `scheduledActivity` runs. `0` means none | `StateMachineEnum.js:72-83` |
| `payloadModel` | Inline model, or a class id, for data collected while in this state | `StateMachineEnum.js:84-101` |
| `isWizardStep` | Whether the state appears as a step in the FSM wizard views. Default `true` | `StateMachineEnum.js:102-108` |

Every state also gets the Java lifecycle hooks `checkGuard`, `onEnter`, `onTransition`,
`onExit`, `scheduledActivity` and `onUpdate` (`StateMachineEnum.js:151-161`). They do nothing
by default. A state overrides them in a per-value `javaCode:` block (see
[Server-side hooks](#server-side-hooks)).

Because a state machine is an Enum, the usual Enum keys (`label`, `ordinal`, `color`,
`background`, `documentation`) also apply. `color` and `background` are used when the state is
rendered as a badge.

### Checking a definition

`MyStateMachine.validateMachine()` throws if no state is `isInitial`, if a transition names an
unknown state, or if `guards` / `permissions` / `onTransition` has a key that is not in that
state's `transitions` (`StateMachineEnum.js:394-433`). `getInitialStates()` and
`getTerminalStates()` are also static (`:386-392`).

---

## 2. Holding the state

A state machine Enum is not used on its own. A model holds it in a `StateMachine` property:

```javascript
{
  class: 'StateMachine',
  of: 'com.example.OrderStatus',
  name: 'status',
  factory: function() { return com.example.OrderStatus.PENDING; }
}
```

`of` is required (`FSM.js:83-86`). Installing the property adds these properties to the
holder (`FSM.js:102-157`):

| Property | Type | Added when |
|----------|------|------------|
| `{name}History` | `FObjectArray` of `foam.lang.StateTransition` | `enableHistory` (default `true`) |
| `{name}Payload` | `FObjectProperty`, created from the current state's `payloadModel` | `enablePayload` (default `true`) |
| `{name}NextActivity` | `DateTime`, when the next scheduled activity is due | always |

All three are `hidden`. To change any of them (to show history in a view, for example),
declare a property with the same name on the holder. Its settings are copied onto the
generated one (`FSM.js:108-116`).

It also adds four async methods to the holder's prototype (`FSM.js:159-199`). For a property
named `status` they are:

- `transitionStatusTo(target, opt_note)`: runs the transition and sets the property
- `canTransitionStatusTo(target)`: `true` if it is listed, permitted and not blocked by a guard
- `getAvailableStatusTransitions()`: the target states that pass `canTransitionStatusTo`
- `assertStatusCanTransitionTo(target)`: throws with the reason a transition is not allowed

`target` may be a state or its name (`StateMachineEnum.js:380-382`).

Keep per-object data on the **holder**. The Enum values are shared singletons, so a property
declared on the state machine is shared by every object in that state.

---

## 3. Transitions on the client

`transitionStatusTo(target)` calls `executeTransitionTo` on the current state
(`StateMachineEnum.js:255-283`). It runs these steps in order:

1. `assertCanTransitionTo`: the target must be in `transitions`, then the permission check
   runs, then the guard runs. The first failure throws (`:220-253`).
2. `onExit` on the current state, if one is defined in JS
3. `onTransition[target]`, if defined in JS
4. a `StateTransition` record (`from`, `to`, `timestamp`, `userId`, `userName`, `note`) is
   appended to `{name}History` (`:344-378`)
5. `onEnter` on the target state, if defined in JS
6. `{name}NextActivity` is updated from the target state's `scheduledTime` (`:285-294`)

The JS hooks in steps 2, 3 and 5 are effectively never defined. See
[Pitfalls](#pitfalls), item 2.

If no `auth` service is in the context, the client-side permission check logs a warning and
allows the transition (`StateMachineEnum.js:174-178`).

---

## 4. Transitions on the server: `FSMDAO`

`foam.dao.FSMDAO` is a `ProxyDAO` that enforces the same rules on every `put`, whether the
change came from the UI, an API or a cron job (`FSMDAO.java:7-26`). Wrap the holder's DAO in
it:

```java
// Property known on the DAO's 'of'
new FSMDAO(x, MyHolder.STATUS, delegate);

// Polymorphic DAO, where the property (and its siblings) live on subclasses
new FSMDAO(x, "status", delegate);
```

The by-name form wraps all four properties in `foam.lang.NamedPropertyInfo`. That class looks
up the axiom on each object's own class, and does nothing when the axiom is missing
(`FSMDAO.java:67-86`). `setSkipCallbacksOnCreate(true)` stops `onEnter` from running when an
object is created (`FSMDAO.java:88-91`, `:169-172`).

On `put_` (`FSMDAO.java:93-159`):

- **Create** (no stored object, or one with no state): the new state must be `isInitial`,
  otherwise the put throws. `onEnter` runs and `{name}NextActivity` is set
  (`FSMDAO.java:161-176`).
- **State changed**: `executeTransition` runs (`FSMDAO.java:179-225`):
  1. the target must be listed in `transitions`. One exception: a terminal state may always
     move to an initial state, which lets a finished object be restarted (`:194-196`)
  2. permissions (`:228-261`)
  3. `checkGuard`, which throws `ValidationException` to block
  4. `onExit`, 5. `onTransition`, 6. record history, 7. `onEnter`, 8. update next activity
- **State unchanged**: the current state's `onUpdate(x, obj, payload)` gets to look at the
  updated payload and return a new state. If it returns a different state, that transition is
  validated and executed. The loop repeats while the new state is not a wizard step
  (`isWizardStep: false`), so a chain of automatic states can be passed through in one put
  (`FSMDAO.java:137-153`).

The server records two things the client does not (`FSMDAO.java:264-301`):

- the transition `note` comes from the context key `transitionNote`
- the current `{name}Payload` is copied into the `StateTransition`'s `payload` and then
  **cleared** on the object, so each state starts with an empty payload

If no `auth` service is in the context, the server-side permission check also logs a warning
and allows the transition (`FSMDAO.java:234-241`).

### Server-side hooks

Write hooks as Java, inside the state's `javaCode:` block. The method signatures come from
`StateMachineEnum.js:151-161`:

```javascript
{
  name: 'SHIPPED',
  label: 'Shipped',
  transitions: ['DELIVERED'],
  javaCode: `
    public void checkGuard(foam.lang.X x, foam.lang.FObject obj, foam.lang.StateMachineEnum n)
      throws foam.lang.ValidationException
    {
      if ( ((Order) obj).getTrackingNumber().isEmpty() )
        throw new foam.lang.ValidationException("Tracking number required");
    }

    public void onEnter(foam.lang.X x, foam.lang.FObject obj, foam.lang.StateMachineEnum o) {
      ((Order) obj).setShippedAt(new java.util.Date());
    }
  `
}
```

`checkGuard` is called on the **current** state, with the target as `n`. `onEnter` is called
on the **new** state, with the previous state as `o`.

---

## 5. Scheduled activities

A state with a non-zero `scheduledTime` sets `{name}NextActivity` to now + `scheduledTime`
when it is entered (`FSMDAO.java:224`, `StateMachineEnum.js:285-294`). The framework only
records when the activity is due. Nothing in foam3 runs it. The application needs its own
cron or poller that selects objects whose `{name}NextActivity` has passed, calls
`scheduledActivity(x, obj)` on the current state, and puts the object back. The activity can
poll a service, send a reminder, or move the object to a new state. On the client,
`runScheduledActivity` reschedules the activity if the object is still in the same state
afterwards (`StateMachineEnum.js:310-328`).

On the client, `{name}NextActivity` is only set when the state also has a JS
`scheduledActivity` (`StateMachineEnum.js:289`). Otherwise it is cleared.

---

## 6. Payloads

`payloadModel` describes the data a user supplies while the object is in a state, such as a
form to fill in before moving on. Given an inline model, it defines a class named
`{StateMachine}${STATE}` with the `java` flag and stores its id (`StateMachineEnum.js:89-100`).
`{name}Payload` is created from the current state's model (`FSM.js:129-148`).
`createPayload()` returns `null` when the state has no `payloadModel`
(`StateMachineEnum.js:163-168`).

```javascript
{
  name: 'AWAITING_APPROVAL',
  transitions: ['APPROVED', 'REJECTED'],
  payloadModel: {
    properties: [
      { class: 'String', name: 'approverComment' }
    ]
  }
}
```

The FSM wizard views (`FSMStepConfigViews.js`, `FSMProxyDetailView.js`) show the payload for
the current state as a step. With `onUpdate`, a state can decide from the submitted payload
where to go next.

---

## Pitfalls

1. **Guards return a reason to block, not a boolean to allow.** Any truthy value blocks the
   transition (`StateMachineEnum.js:199-201`). `test/TestStateMachine.js:23-25` returns
   `null` to allow and `'guard blocked'` to block. A guard written as
   `return elapsed > limit;` blocks exactly when it should allow.

2. **JS `onEnter` / `onExit` / `onTransition` in a value literal are dropped.** The hooks are
   declared as methods, not properties (`StateMachineEnum.js:151-155`; the property versions
   are commented out at `:51-71`). When an enum value is created, `copyFrom` copies only keys
   that are properties and silently drops the rest (`FObject.js:992-1007`).
   `test/StateMachineEnumTest.js:89-94` says so directly. Override the hooks in Java instead.

3. **`scheduledTime` is a number, not a function.** It is a `Long`
   (`StateMachineEnum.js:73`). Int adaptation turns a function into `parseInt(fn)`, which is
   `NaN` (`types.js:18-22`), so no activity is ever scheduled. Write `scheduledTime: 30000`.

4. **The payload key is `payloadModel`.** Any other key, such as `model:`, is not a property
   of `StateMachineEnum` and is dropped.

5. **Assigning the property skips the client-side rules.** `holder.status = Status.DONE` runs
   no guard or permission check, no hooks, and records no history. On the client use
   `transitionStatusTo(...)`. On the server, put the object through a DAO wrapped in
   `FSMDAO`, which checks every change however it was made.

6. **At least one state must be `isInitial`.** Without one, `FSMDAO` refuses every create
   (`FSMDAO.java:163-167`) and `validateMachine()` fails (`StateMachineEnum.js:398-400`).

7. **History is `{name}History`** (`FSM.js:119-124`), so a property named `status` gets
   `statusHistory`. On the client, a recorded `StateTransition` has no payload
   (`StateMachineEnum.js:363-370`). Only `FSMDAO` fills in `payload`
   (`FSMDAO.java:298-301`).

8. **Guards are per state.** The guard for GREEN → YELLOW is
   `TrafficLightState.GREEN.guards.YELLOW(x, holder)`. Usually you call
   `holder.canTransitionStateTo('YELLOW')` instead.

---

## Example: a traffic light

A light that cycles **RED → GREEN → YELLOW → RED**. The rules live in the state machine and
the data lives on the holder. Each guard returns a reason while its light's time has not
elapsed.

```
   ┌──────────┐      ┌───────────┐      ┌────────────┐
   │   RED    │ ───▶ │   GREEN   │ ───▶ │   YELLOW   │
   └──────────┘      └───────────┘      └────────────┘
        ▲                                     │
        └─────────────────────────────────────┘
```

```javascript
foam.FSM({
  package: 'com.example',
  name: 'TrafficLightState',

  values: [
    {
      name: 'RED',
      label: 'Red - Stop',
      isInitial: true,
      transitions: ['GREEN'],
      color: '#721c24',
      background: '#f8d7da',
      guards: {
        GREEN: function(x, obj) {
          var elapsed = (Date.now() - obj.enteredStateAt) / 1000;
          return elapsed < obj.redDurationSeconds ? 'Red time has not elapsed' : null;
        }
      }
    },
    {
      name: 'GREEN',
      label: 'Green - Go',
      transitions: ['YELLOW'],
      color: '#155724',
      background: '#d4edda',
      guards: {
        YELLOW: function(x, obj) {
          var elapsed = (Date.now() - obj.enteredStateAt) / 1000;
          return elapsed < obj.greenDurationSeconds ? 'Green time has not elapsed' : null;
        }
      }
    },
    {
      name: 'YELLOW',
      label: 'Yellow - Caution',
      transitions: ['RED'],
      color: '#856404',
      background: '#fff3cd',
      guards: {
        RED: function(x, obj) {
          var elapsed = (Date.now() - obj.enteredStateAt) / 1000;
          return elapsed < obj.yellowDurationSeconds ? 'Yellow time has not elapsed' : null;
        }
      }
    }
  ]
});

foam.CLASS({
  package: 'com.example',
  name: 'TrafficLightIntersection',

  properties: [
    { class: 'String', name: 'id' },
    {
      class: 'StateMachine',
      of: 'com.example.TrafficLightState',
      name: 'state',
      factory: function() { return com.example.TrafficLightState.RED; }
    },
    { class: 'Int',  name: 'greenDurationSeconds',  value: 30 },
    { class: 'Int',  name: 'yellowDurationSeconds', value: 5 },
    { class: 'Int',  name: 'redDurationSeconds',    value: 30 },
    { class: 'Long', name: 'enteredStateAt' }
  ]
});

var light = com.example.TrafficLightIntersection.create({ id: 'main_oak' });
await light.canTransitionStateTo('GREEN');      // true: enteredStateAt is 0, so time has elapsed
await light.transitionStateTo('GREEN', 'cycle');
light.stateHistory;                             // [ StateTransition RED → GREEN ]
```

Side effects such as stamping `enteredStateAt` belong in a Java `onEnter` override (see
[Server-side hooks](#server-side-hooks)). They run when the intersection is put through a DAO
wrapped in `FSMDAO`. To make the light advance by itself, give each state a `scheduledTime`
and a `scheduledActivity` that moves to the next state, and run a cron that calls it (see
[Scheduled activities](#5-scheduled-activities)).

A minimal working state machine and holder used by the tests are in
`test/TestStateMachine.js` and `test/TestStateMachineHolder.js`.

---

## Related files

| File | Role |
|------|------|
| `FSM.js` | `foam.FSM()`, `StateMachineModel`, and the `StateMachine` property type |
| `StateMachineEnum.js` / `.java` | Base class for states: transitions, guards, permissions, lifecycle |
| `StateTransition.js` | History record |
| `FSMDAO.java` | Server-side enforcement on `put` |
| `NamedPropertyInfo.java` | Looks up a property by name on each object's class, for polymorphic DAOs |
| `FSMDiagramView.js` | Renders a state machine as a diagram |
| `FSMStepConfig.js`, `FSMStepConfigViews.js`, `FSMProxyDetailView.js` | Shows a state machine's payloads as a step wizard |
| `test/TestStateMachine.js`, `test/TestStateMachineHolder.js` | Minimal working state machine and holder |
| `test/StateMachineEnumTest.js`, `test/FSMDAOTest.js`, `test/FSMDAOLifecycleTest.js` | Behaviour tests |
