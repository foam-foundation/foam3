# Slots: OO Pointers with Observability

## The Pointer Analogy

In languages like C, **pointers** give you a way to reference a value without knowing its source. You can read and update that value abstractly, without knowing where the value lives in memory:

```c
int x = 5;
int *ptr = &x;  // ptr points to x
*ptr = 10;      // update x through ptr
```

Object-oriented programming largely lost this capability. You typically need to know both the object and the property name to update a value:

```javascript
// Without slots: you must know the object and property
person.firstName = 'John';
```

**Slots restore this pointer-like capability in OO systems.** A slot is an abstract reference to a value that you can read and update without knowing which object or which property holds the value [1](#1-0) .

## Property Slots: The Basic Pointer

Every FOAM property automatically has a corresponding slot, accessed with the `$` suffix [2](#1-1) :

```javascript
this.name       // the current value (static)
this.name$      // a slot that tracks changes to this.name (reactive)
```

The slot acts as a pointer to the property's value:

```javascript
var slot = person.fname$;
slot.get();           // → 'John'  (read through pointer)
slot.set('Steve');    // same as person.fname = 'Steve'  (write through pointer)
slot.sub(listener);   // fires when fname changes  (observe through pointer)
``` [3](#1-2)

## Abstracting the Source

The power of slots is that you can pass them around without knowing where they point. A view can accept a slot and update it without knowing which object or property it represents:

```javascript
// The view doesn't need to know it's updating person.firstName
this.tag({class: 'foam.u2.TextField', data$: this.name$});
```

This enables **generic binding** - the same view component can work with any property slot [4](#1-3) :

```javascript
// Generic view that works with any slot
foam.CLASS({
  name: 'GenericLabel',
  methods: [
    function render() {
      this.add(this.data$);  // Just add the slot - don't care what it points to
    }
  ]
});

// Use with any property
this.start(GenericLabel, { data$: this.firstName$ }).end();
this.start(GenericLabel, { data$: this.lastName$ }).end();
```

## Observability: The Key Difference

Unlike C pointers, **slots are observable**. They notify subscribers when their value changes [5](#1-4) . This makes UI programming dramatically easier:

```javascript
// Subscribe to changes
this.name$.sub(function(e, _, __, newVal) {
  console.log('Name changed to:', newVal);
});
```

When you pass a slot to `add()`, the displayed content updates automatically [6](#1-5) :

```javascript
this.add(this.name$);  // Text updates automatically when this.name changes
```

No manual DOM updates - the slot handles the notification and update cycle.

## Two-Way Binding

Slots support **two-way binding**, allowing changes to flow in both directions [4](#1-3) :

```javascript
// Link two slots together
slot1.linkFrom(slot2);           // two-way bind
this.firstName$ = view.data$;    // shorthand for two-way bind
```

This is like having two pointers to the same value, but with automatic synchronization.

## Composition: Pointer Chains

Slots can be composed to create pointer chains, similar to dereferencing nested pointers in C [7](#1-6) :

```javascript
// Track a deeply nested property
var s1 = obj.slot('block$flowParent$value$currency');
var s2 = obj.block$.dot('flowParent').dot('value').dot('currency');
```

The chain automatically re-wires if any object along the path changes - something C pointers cannot do.

## Computed Slots: Derived Pointers

Slots can also represent **computed values** - pointers to derived data that recalculates when dependencies change [8](#1-7) :

```javascript
var fullName = this.slot(function(firstName, lastName) {
  return firstName + ' ' + lastName;
});
```

This is like a pointer that automatically updates its target based on other pointers.

## Summary

| Aspect | C Pointers | FOAM Slots |
|--------|-----------|------------|
| **Abstract reference** | ✓ | ✓ |
| **Read/write through reference** | ✓ | ✓ |
| **Observable** | ✗ | ✓ |
| **Automatic re-wiring** | ✗ | ✓ |
| **Computed values** | ✗ | ✓ |
| **Type-safe** | ✗ | ✓ |

Slots restore the pointer abstraction that OO lost, while adding observability and safety that makes them ideal for reactive UI programming [1](#1-0) .

## Notes

This document focuses on the conceptual model of slots as OO pointers. For detailed usage patterns, see:
- [ReactivePatterns.md](doc/guides/ReactivePatterns.md) - Complete reference on slot variations
- [ReactiveUI.md](doc/guides/ReactiveUI.md) - Slots in UI context
- [foam-tutorial.md](doc/tutorials/foam-tutorial.md) - Tutorial on reactive slots

Wiki pages you might want to explore:
- [Core Concepts: Models, Axioms, and the Class System (kgrgreer/foam3)](/wiki/kgrgreer/foam3#1.2)

### Citations

**File:** src/foam/lang/Slot.js (L32-44)
```javascript
  documentation: `
    Slots are observable values which can change over time.

    Slots are simple single-value Model-View-Controller Models, but since
    another meaning of 'Model' is already heavily used in FOAM, Slot is
    used to avoid overloading the term.

    <ul>Types of Slots include:
      <li>PropertySlot
      <li>ConstantSlot
      <li>ExpressionSlot
    </ul>
  `,
```

**File:** doc/tutorials/foam-tutorial.md (L1406-1420)
```markdown
### Property Slots

Every FOAM property automatically has a corresponding slot, accessed with the `$` suffix:

```javascript
this.name       // the current value (static)
this.name$      // a slot that tracks changes to this.name (reactive)
```

When you pass a slot to `add()`, the displayed content updates automatically:

```javascript
// In render():
this.add(this.name$);  // Text updates automatically when this.name changes
```
```

**File:** doc/tutorials/foam-tutorial.md (L1422-1435)
```markdown
### Two-Way Binding

Slots enable two-way data binding between properties and form fields. When you bind a view's `data$` to a property slot, changes flow in both directions — editing the field updates the property, and changing the property updates the field:

```javascript
this.tag({class: 'foam.u2.TextField', data$: this.name$});
```

You can also link two slots together explicitly:

```javascript
slot1.linkFrom(slot2);           // two-way bind
this.firstName$ = view.data$;    // shorthand for two-way bind
```
```

**File:** doc/tutorials/foam-tutorial.md (L1453-1474)
```markdown
### Computed Slots

The `slot()` method creates a **computed slot** — a derived value that automatically recalculates when any of its dependencies change. The argument names in the function declare the dependencies:

```javascript
// A computed slot that depends on firstName and lastName
var fullName = this.slot(function(firstName, lastName) {
  return firstName + ' ' + lastName;
});
```

When used with `add()`, computed slots re-render their content whenever any dependency changes. This is particularly useful for building views that react to data:

```javascript
this.add(this.slot(function(items) {
  return this.E().forEach(items, function(item) {
    this.start('div').add(item.name).end();
  });
}));
```

Note the use of `this.E()` — it creates a new empty DOM element (a `<span>` by default). Inside a `slot()` callback you can't append to the current view's element chain, so you create a fresh element with `E()`, build a tree on it, and return it.
```

**File:** doc/guides/ReactivePatterns.md (L7-23)
```markdown
## 1. `obj.name$` — PropertySlot Accessor

**Source**: `Property.js:497` — getter installed on prototype via `Object.defineProperty`

```javascript
// Returns a PropertySlot — a live, subscribable handle to a single property
var slot = person.fname$;
slot.get();           // → 'John'
slot.set('Steve');    // same as person.fname = 'Steve'
slot.sub(listener);   // fires when fname changes
```

**Returns**: `PropertySlot` (cached per instance in `obj.getPrivate_('name$')`)

**Note**: `person.fname$` is a short-form for `person.slot('fname')`.

**Use case**: When you need a slot reference to a single, flat property — for linking, following, or passing to views.
```

**File:** doc/guides/ReactivePatterns.md (L48-76)
```markdown
## 3. `obj.slot('a$b$c')` or `obj.a$.dot('b').dot('c')` — Deep Slot Chain

**Source**: `FObject.js:792-802` splits on `$` then calls `slot.dot()`. `Slot.js:72-87` `dot()` creates `SubSlot` instances.

```javascript
// These three are IDENTICAL:
var s1 = obj.slot('block$flowParent$value$currency');
var s2 = obj.block$.dot('flowParent$value$currency');
var s3 = obj.block$.dot('flowParent').dot('value').dot('currency');
```

**Internal mechanics** (`SubSlot` in `Slot.js:319-405`):

```
PropertySlot(block)
  └─ SubSlot(flowParent)      ← watches block, re-subs when block changes
       └─ SubSlot(value)       ← watches flowParent, re-subs when it changes
            └─ SubSlot(currency) ← watches value, re-subs when it changes
```

Each `SubSlot.parentChange` listener (line 384) does:

1. Detaches the old subscription
2. Gets the new parent value
3. If the new value has the axiom, subscribes to `newValue.slot(name)`
4. Fires `valueChange` to propagate

**Use case**: When you need to reactively track a deeply nested property, and any object along the chain might be swapped out. The chain automatically re-wires.

```

**File:** doc/guides/ReactiveUI.md (L5-11)
```markdown
## The Core Idea

Every UI framework must answer: "when data changes, what updates on screen?" React re-renders a virtual DOM and diffs. Angular dirty-checks. FOAM uses **slots** — observable value holders that notify subscribers when they change.

FOAM gives you four ways to connect slots to the DOM. They differ in **how much of the screen gets rebuilt** when data changes.

TL;DR: ReactiveUI - the more you can contain/isolate the changing pieces, the faster the re-render of that part of DOM.
```
