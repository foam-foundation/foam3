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
the property's slot instead of its static value. For every property, FOAM generates a `<property>$`
accessor whose getter returns a `Slot`, specifically a `PropertySlot` (see `Property.toSlot`
in `Property.js`), created once and cached. So `person.fname$` is an ordinary object you can
hold in a variable, pass around, and call methods on. It has three core operations, defined
on `PropertySlot` — `get`, `set`, `sub`:

```javascript
slotName.get();         // → 'Steve'                       read through the pointer
slotName.set('Alice');  // same as person.fname = 'Alice'  write through the pointer
slotName.sub(listener); // fires when fname changes         observe through the pointer
```

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

The `data$: view.data$` shorthand you see in views is a two-way link under the hood:

```javascript
this.firstName$ = view.data$;   // equivalent to a linkFrom — edits flow both directions
```

**Every link returns a `Detachable`** with a `detach()` method. If you create a binding
imperatively, you own its lifetime — see [Cleanup](#cleanup-ondetach).

## Composition: deep slot chains

Slots compose into chains that point at a *nested* value. These three are identical —
`FObject.slot()` splits the string on `$` and calls `dot()` for each segment:

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

`SubSlot.get()` is null-safe (it returns `undefined` rather than throwing when a link along
the path is currently null), so a chain through a missing link simply produces its value once
the path fills in.

> **U2/U3 gotcha.** Watching a top-level object does **not** re-fire when a *nested* field
> changes — the outer reference is unchanged. Watch the `$`-chain instead:
> ```javascript
> // WRONG — never re-fires when only .currency changes:
> function(block) { return block?.flowParent?.value?.currency; }
> // RIGHT — re-fires on any change along the path:
> function(block$flowParent$value$currency) { return block$flowParent$value$currency || 'USD'; }
> ```

## Computed slots: derived pointers

A function passed to `slot()` becomes an `ExpressionSlot` (see `FObject.slot()`): a read-only
pointer at a *derived* value that recomputes when any dependency changes. The **argument
names are the dependencies**:

```javascript
var fullName = this.slot(function(firstName, lastName) {
  return firstName + ' ' + lastName;      // recomputes when either changes
});
```

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

- **`this.slot(fn)` self-cleans.** The `ExpressionSlot` it creates is registered with the
  object's `onDetach` automatically (inside `FObject.slot()`) — nothing to do.
- **Manual `.sub()` and links do not.** Wrap them so they die with the view:

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
