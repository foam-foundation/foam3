# Slots: Observable OO Pointers

This guide is the **conceptual and advanced reference** for slots. If you just want the
hands-on basics — binding a field, a computed label — start with the
[FOAM tutorial's Reactive Slots section](../tutorials/foam-tutorial.md#reactive-slots),
then come back here for the model behind them, deep slot chains, and the slot type zoo.

Source of truth: `foam.lang.Slot` (`src/foam/lang/Slot.js`) and `FObject.slot()`
(`src/foam/lang/FObject.js`).

## The pointer analogy

If you've never written C, here's the one idea the analogy needs. Every value a program
holds lives at some numbered location in memory — its **address**. A **pointer** is a
variable whose value *is* an address: instead of holding data, it holds "the data is over
there." Given a pointer you can *dereference* it — follow the address — to read or overwrite
whatever it points at, without knowing which variable that was. It's a level of indirection:
a handle to a value rather than the value itself.

In C that looks like:

```c
int x = 5;
int *ptr = &x;  // &x is "the address of x"; ptr now holds that address
*ptr = 10;      // *ptr is "the value at that address" — this sets x to 10
```

`ptr` doesn't know it's pointing at `x` — it just knows an address. Anything holding `ptr`
can update the value there without ever naming `x`.

Object-oriented programming largely lost this. To update a value you usually need both the
object *and* the property name:

```javascript
person.firstName = 'John';   // must know both `person` and `firstName`
```

**A slot restores the pointer** — an abstract, passable reference to a value you can read,
write, and *observe* without knowing which object or property backs it. Unlike a C pointer,
a slot is **observable** (it notifies on change) and **self-rewiring** (a chain re-targets
when an object along the path is swapped). Those two additions are what make slots the
backbone of FOAM's reactive UI.

| | C pointer | FOAM slot |
|---|---|---|
| Abstract reference | ✓ | ✓ |
| Read / write through it | ✓ | ✓ |
| **Observable** (notifies on change) | ✗ | ✓ |
| **Auto-rewiring** chains | ✗ | ✓ |
| Computed / derived values | ✗ | ✓ |

## The basics, in one screen

Every property has a slot, reached with the `$` suffix — and a slot behaves very differently
from the plain property value:

```javascript
// person is a FOAM object with an `fname` property, currently 'John'.
var person = Person.create({ fname: 'John' });

var name     = person.fname;    // a plain value  — a static snapshot, 'John'
var slotName = person.fname$;   // a slot         — a live handle to the property (note the `$`)

person.fname = 'Steve';         // change the property...
console.log(name);              // → 'John'    a copy; it never saw the change
console.log(slotName.get());    // → 'Steve'   reads through to the live property
```

That's the whole point: `name` is the value, `slotName` is a pointer *to* the value.

The `$` suffix is part of the FOAM modeling syntax — like `CLASS` or `ENUM` — and references
the property's slot instead of its static value.
For every property, FOAM generates a `<property>$`
accessor whose getter returns a `Slot`, specifically a `PropertySlot` (see `Property.toSlot`
in `Property.js`), created once and cached. So `person.fname$` is an ordinary object you can
hold in a variable, pass around, and call methods on.
The `$` accessor is itself a shorthand. Every FOAM model extends the base class `FObject`, so
`person` — an instance of the `Person` model — is an `FObject`, and inherits `FObject`'s
`slot()` method, which returns the slot for a property by name. That is all `$` does:
`person.fname$` is short for `person.slot('fname')`. (Writing the method as `FObject.slot()`
just names where it's defined; you always call it on an instance — `person.slot(...)`.)
In either case, the slot has three core operations, defined on `PropertySlot` — `get`, `set`, `sub`:

```javascript
slotName.get();         // → 'Steve'                       read through the pointer
slotName.set('Alice');  // same as person.fname = 'Alice'  write through the pointer
slotName.sub(listener); // fires when fname changes         observe through the pointer
```

`sub()` hands the listener a change *event*, not the new value, and returns the subscription:

```javascript
var subscription = slotName.sub(function(subscription, topic, prop, slot) {
  // fires on each change to fname (not right away — only on the *next* change)
  console.log('fname is now', slotName.get());  // read the current value from the slot
});
subscription.detach();   // stop listening; the callback's first arg is this same object
```

The four arguments are pub/sub plumbing — the subscription (call `.detach()` on it to
unsubscribe, from inside the handler or out), the topic (`'propertyChange'`), the property
name, and the slot. In practice you ignore most of them and read the value with
`slotName.get()`. Because the handler only runs on the *next* change, read `get()` first if you
also need the current value.

You will often see this first argument named `sub` in the code, but that reads poorly next to
the `sub()` call — prefer `subscription`.

**The change event.** Under the hood a slot doesn't invent its own event: writing a property
publishes a `propertyChange` event on the object, and a slot's `sub()` is just a subscription
filtered to that event for one property — which is why the `topic` is `'propertyChange'` and
the payload is the slot. The same event drives every reactive form in this guide (`add()`
bindings, computed slots, links). In fact, `slotName.sub(fn)` is a shortcut for subscribing to
that event directly — `obj.sub('propertyChange', 'fname', fn)`. For the full pub/sub event
model, including topic hierarchies and wildcard subscriptions, see
[ReactivePatterns.md](./ReactivePatterns.md).

The payoff is in the UI. Because a slot is a live handle to the property — not a copy of its
value — handing one to a view creates a **data binding**: the DOM stays wired to the property
and re-renders itself whenever the value changes, with no code to detect the change or update
the screen. This is what "reactive UI" means in FOAM, and slots are the mechanism behind it.

The examples below build DOM inside a view's `render()` method (where `this` is the view);
the view-building methods are covered in the
[tutorial](../tutorials/foam-tutorial.md#custom-views). Two show up here.

`add()` appends content to the view. Hand it a slot instead of a plain value and the rendered
text tracks the property — no manual updates:

```javascript
// inside a view's render():
this.add(this.fname$);   // displays person.fname as text; re-renders whenever it changes
```

`tag()` instantiates a child view from a spec. Bind that view's `data$` to a slot and the
binding runs **both ways** — the field shows the value, and editing it writes straight back
through the slot to the property:

```javascript
this.tag({ class: 'foam.u2.TextField', data$: this.fname$ });
// shows person.fname, and typing in the field updates person.fname
```

The same `TextField` works for any property — you just give it a different slot. The field
never knows what it's editing, which is why one component can bind to anything. This is
**generic binding**:

```javascript
this.tag({ class: 'foam.u2.TextField', data$: this.firstName$ });  // binds firstName
this.tag({ class: 'foam.u2.TextField', data$: this.lastName$  });  // same view, different target
```

For a worked example (a Recipe detail view built from these pieces), see the
[tutorial](../tutorials/foam-tutorial.md#reactive-slots). The rest of this guide is the part
the tutorial doesn't cover.

## Linking: two-way binds and one-way follows

Beyond reading and writing a single slot, the base `Slot` class provides methods to *wire two
slots together* so their values stay in sync. Because these live on the base class, they work
between any two slots — a property slot, a computed slot, a view's `data$`. They're listed
below from weakest coupling to strongest; prefer the least coupling that does the job:

```javascript
slotA.follow(slotB);      // ONE-WAY: slotA tracks slotB; writing slotA does NOT change slotB
slotA.mapFrom(slotB, f);  // ONE-WAY + transform: slotA = f(slotB) on every slotB change
slotA.linkFrom(slotB);    // TWO-WAY: kept in sync; at link time slotA adopts slotB's value
slotA.linkTo(slotB);      // TWO-WAY: same, but slotB adopts slotA's value (= slotB.linkFrom(slotA))
```

The `data$: this.firstName$` shorthand you see in views is a two-way link under the hood.
Setting a `$` slot runs `receiver.linkFrom(argument)`, and at link time the *receiver* adopts
the *argument*'s value. Passing `data$:` in a view spec sets the child view's `data$`, so the
child is the receiver — it seeds from the model, not the other way around:

```javascript
view.data$ = this.firstName$;   // → view.data$.linkFrom(this.firstName$)
                                // field adopts firstName's value; edits then flow both ways
```

Write it the other way (`this.firstName$ = view.data$`) and the direction flips: `firstName`
would adopt the freshly-created field's empty value, clobbering the model.

### Who owns the binding

A link is not fire-and-forget: `follow`, `mapFrom`, and `linkFrom` each wire the slots
together with live subscriptions (a `linkFrom` sets up two — one per direction — so the
feedback guard can keep them in sync). Those subscriptions hold references and keep firing
until something cancels them. That "something" is the **`Detachable`** every link returns:
calling `.detach()` on it tears down the subscriptions and breaks the binding. Nothing else
does — a link outlives the values it connects, and even outlives one slot going out of scope,
until its `Detachable` is detached.

Who holds that `Detachable` depends on how the link was made:

- **Assigning one slot to another auto-cleans.** Whenever you set a `$` slot — either directly
  (`view.data$ = this.firstName$`) or through the equivalent view-spec key (`data$: this.firstName$`) —
  the assignment runs the link through the property's `$` setter (`Property.js`), which
  registers the returned `Detachable` with the owning object's `onDetach` for you. When that
  object detaches, the link goes with it — you own nothing.
- **A bare imperative link does not.** `slotA.linkFrom(slotB)` hands the `Detachable` back to
  *you*. If you drop it on the floor, the binding leaks past the lifetime of whatever set it
  up. Register it yourself — `this.onDetach(slotA.linkFrom(slotB))` — so it dies with the
  object.

The [Cleanup](#cleanup-ondetach) section covers the `onDetach` mechanics and the same rule for
raw `.sub()` calls.

## Composition: deep slot chains

So far a slot has pointed at *one* property on *one* object. But the value you care about often
sits several hops down an object graph — `obj.block.flowParent.value.currency`.

The obvious move is to reach in and grab the leaf directly:

```javascript
var cur = obj.block.flowParent.value.currency$;   // slot for the currency of the
                                                  // value object that exists *right now*
```

The bug is subtle: that slot is bound to *this particular* `value` object. Reassign any link
above it — `obj.block.flowParent.value = someOtherValue` — and `cur` is still watching the old,
detached object. It won't see the new currency, and nothing warns you. Subscribing one level
down has the same flaw: you subscribed to an object that may no longer be on the path.

A **chain** fixes exactly this. It points at the nested value *by path* rather than by object,
and re-points itself whenever an intermediate link is replaced — so it always reflects the
current `block.flowParent.value.currency` (the mechanics are in
[auto-rewiring](#why-chains-beat-c-pointers-auto-rewiring) below).

The primitive that builds a chain is **`dot()`**, defined on `Slot` (`Slot.js`). Given a slot,
`slot.dot('name')` returns a *new* slot — a `SubSlot` — for property `name` of whatever object
that slot currently holds. Since a `SubSlot` is itself a slot, you can `dot()` again to step
deeper, walking the graph one property at a time.

`slot()` — the `FObject` method behind the `$` accessor, from [the basics](#the-basics-in-one-screen)
(`person.fname$` === `person.slot('fname')`) — is the on-ramp from an object into that chain.
Because every model instance is an `FObject`, you can call it on any of them. Hand it a single
name and you get a plain property slot; hand it a `$`-joined *path* and it resolves the head
property, then calls `dot()` for each remaining segment (`FObject.slot()` in `FObject.js`). So
these three forms — string sugar, half-and-half, and explicit `dot()` calls — all build the
*same* chain:

```javascript
var s1 = obj.slot('block$flowParent$value$currency');
var s2 = obj.block$.dot('flowParent$value$currency');
var s3 = obj.block$.dot('flowParent').dot('value').dot('currency');
```

Each `dot()` builds a `SubSlot` (both `dot` and `SubSlot` live in `Slot.js`). The chain is a
tower of SubSlots, each watching the one above it:

```
PropertySlot(block)
  └─ SubSlot(flowParent)      watches block,       re-subs when block changes
       └─ SubSlot(value)      watches flowParent,   re-subs when flowParent changes
            └─ SubSlot(currency)  watches value,    re-subs when value changes
```

### Why chains beat C pointers: auto-rewiring

This is the property a raw pointer can't have. On construction each `SubSlot` subscribes to
its parent (`SubSlot.init` subscribes `parentChange` to the parent). When any object *along
the path* is replaced, that segment's `parentChange` fires: detach the stale subscription,
read the new parent, re-subscribe to `newParent.slot(name)`, and propagate a value change
downstream. Swap `obj.block.flowParent` for a whole new object and `s1` keeps pointing at the
right `currency` — no manual rewiring.

**A chain tolerates gaps in the path.** Dereferencing the same path by hand —
`obj.block.flowParent.value.currency` — throws the moment any link along it is null, and links
*are* null routinely: the graph is half-built during construction, still loading, or briefly
broken while a parent is swapped. Reading a chain never throws in those windows — it just
yields `undefined` until the path is whole. So you write the chain once and skip the
`block?.flowParent?.value?.` guards you'd otherwise scatter everywhere.

Because the chain also re-wires itself, the `undefined` is temporary: the instant the missing
link is filled in, the chain re-reads and produces the real value, and anything bound to it
updates on its own — no code to detect that the path became complete.

Writing has one catch worth knowing: setting through a chain whose path is *not yet* complete
is **silently dropped**, not an error. A two-way-bound field on a not-yet-loaded object won't
crash, but edits made before the path exists are lost.

## Computed slots: derived pointers

`slot()` is the method you've already used two ways — `slot('fname')` for a property (from
[the basics](#the-basics-in-one-screen)) and `slot('block$flowParent$value$currency')` for a
chain (from [composition](#composition-deep-slot-chains)). It has a third mode: pass it a
**function** instead of a name and it returns an `ExpressionSlot` (`FObject.slot()`) — a
read-only pointer at a *derived* value that recomputes when any dependency changes. Where a
name points at an existing property and a `$`-path at a nested one, a function points at a
computed one. The **argument names are the dependencies**:

```javascript
var fullName = this.slot(function(firstName, lastName) {
  return firstName + ' ' + lastName;      // recomputes when either changes
});
```

`this` is the object you call `slot()` on, and it must own the named properties: `slot()`
resolves each argument against it — `firstName` → `this.firstName`, `lastName` →
`this.lastName` — and re-runs the function (with `this` still bound to that object) whenever
either changes. In the basics that object was a `person`; inside a view's `render()` it's the
view, so the dependencies are the view's own properties.

Used with `add()`, a computed slot re-renders its content on every dependency change — the
declarative alternative to imperative DOM updates:

```javascript
this.add(this.slot(function(items) {
  return this.E().forEach(items, function(item) {
    this.start('div').add(item.name).end();
  });
}));
```

`this.E()` makes a fresh element (a `<span>` by default). Inside a `slot()` callback you
can't append to the outer element chain, so you build a tree on a new element and return it.

Since the argument names *are* the dependencies, this is where the [deep chains](#composition-deep-slot-chains)
above earn their keep: to depend on a *nested* value, name the argument with the full
`$`-chain. Naming it after just the **head** (`block`) recomputes only when `block` itself is
reassigned — *not* when something deeper changes, such as the **leaf** `currency`, since
`block`'s own reference is untouched:

```javascript
// WRONG — recomputes only when `block` is reassigned, not when `.currency` changes:
this.slot(function(block) { return block?.flowParent?.value?.currency; });
// RIGHT — recomputes on a change at any segment of the path:
this.slot(function(block$flowParent$value$currency) { return block$flowParent$value$currency || 'USD'; });
```

## The slot types

Every slot extends `Slot` (`foam.lang.Slot`), which is abstract: it defines the linking
methods you just saw (`linkFrom`, `linkTo`, `follow`, `mapFrom`) and declares the
`get`/`set`/`sub` contract. Each concrete subclass implements `get`/`set`/`sub` for a
particular kind of backing value.

You rarely construct these — `$`, `slot()`, and `dot()` hand you the right one. Two are
public and worth knowing by name:

| Type | Created by | Backs | Writable? |
|---|---|---|---|
| `ExpressionSlot` | `slot(fn)` | a computed / derived value | no (read-only) |
| `ConstantSlot` | wrapping a plain value | a constant; `set`/`sub` are no-ops | no |

The everyday case — `obj.name$` — returns a `PropertySlot`. That (and the chain slots `dot()`
builds) is a framework internal: you use it through the `Slot` interface above, never
construct it by name.

## Cleanup: `onDetach`

Slots subscribe to each other, and subscriptions outlive the view unless cancelled — a leak,
and a source of duplicate handlers on re-render.

The whole rule comes down to one question, seen throughout this guide: **did the framework
register the cleanup, or did you get handed a `Detachable` to register yourself?** Implicit
forms self-clean; explicit forms are yours to wrap in `onDetach`.

| How the binding was created | Registered by | You do |
|---|---|---|
| `obj.name$` — reading a slot | *nothing subscribes* | nothing |
| `this.slot(fn)` — computed slot | framework (implicit) | nothing |
| `a$ = b$` / view-spec `data$:` — slot-to-slot assignment | framework (implicit) | nothing |
| `slot.sub(fn)` — raw subscription | **you** (explicit) | `this.onDetach(slot.sub(fn))` |
| `slot.linkFrom` / `linkTo` / `follow` / `mapFrom` | **you** (explicit) | `this.onDetach(slot.linkFrom(other))` |

The implicit rows are the same ones from [Who owns the binding](#who-owns-the-binding) — you own
nothing because the `$` setter and `slot()` register the `Detachable` for you. The explicit rows
hand it back; wrap them so they die with the view:

```javascript
// leaks — subscription survives the component:
this.data$.sub(this.onDataChange);

// correct — cancelled when the element detaches:
this.onDetach(this.data$.sub(this.onDataChange));
this.onDetach(this.a$.linkFrom(this.b$));   // links return a Detachable too
```

`element.detach()` cancels every `onDetach`-registered subscription in O(1). In view classes,
prefer a declarative `listeners:` axiom over a raw `.sub()` in `render()` — it auto-detaches
and survives re-renders.

## See also

- [FOAM tutorial → Reactive Slots](../tutorials/foam-tutorial.md#reactive-slots) — hands-on
  basics and a full detail-view walkthrough.
- [ReactivePatterns.md](./ReactivePatterns.md) — every slot access form (`name$`, `slot()`,
  deep chains) with use cases.
- [ReactiveUI.md](./ReactiveUI.md) — how slots connect to the DOM, and the cost of each
  binding form (how much of the screen rebuilds on change).
