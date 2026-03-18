# Reactive UI Patterns in FOAM3

## Table of Contents
1. [Quick Start](#quick-start)
2. [Overview](#overview)
3. [Architecture](#architecture)
4. [The Four Reactive Patterns](#the-four-reactive-patterns)
5. [Pattern 1: Slot Binding (`prop$:`)](#pattern-1-slot-binding-prop)
6. [Pattern 2: `slot.dot()` — Nested Property Tracking](#pattern-2-slotdot--nested-property-tracking)
7. [Pattern 3: `slot.map()` — Value Transformation](#pattern-3-slotmap--value-transformation)
8. [Pattern 4: `dynamic()` — Conditional DOM Rendering](#pattern-4-dynamic--conditional-dom-rendering)
9. [Decision Framework](#decision-framework)
10. [How Element Renders Each Pattern](#how-element-renders-each-pattern)
11. [Gotchas](#gotchas)

---

## Quick Start

FOAM provides four reactive UI patterns. Each solves a different problem.
Use the simplest one that fits:

1. **Slot binding** (`data$: this.name$`) — wire a changing value into a child component
2. **`dot()`** (`this.data$.dot('name')`) — track a property inside a changing object
3. **`map()`** (`this.count$.map(n => n + ' items')`) — transform a value for display
4. **`dynamic()`** (`this.dynamic(function(mode) { ... })`) — rebuild DOM when structure changes

---

## Overview

### What Problem This Solves

Every UI framework must answer: "When data changes, what updates?" React
re-renders the virtual DOM and diffs. Angular uses dirty-checking. FOAM uses
**slots** — observable value holders that propagate changes through a
subscription graph.

The four patterns differ in **what they update** when a slot changes:

| Pattern | What updates on change |
|---------|----------------------|
| Slot binding (`prop$:`) | Child component handles it internally |
| `dot()` | Produces a new slot — consumer decides |
| `map()` | Swaps one DOM node for another |
| `dynamic()` | Tears down and rebuilds a DOM region |

### Key Files

| File | Purpose |
|------|---------|
| `foam3/src/foam/lang/Slot.js` | Slot base class, `dot()`, `map()`, SubSlot, ExpressionSlot |
| `foam3/src/foam/lang/FObject.js` | `dynamic()`, `slot()` on FObject |
| `foam3/src/foam/u2/Element2.js` | `SlotNode`, `FunctionNode`, `addChild_()` dispatch |

---

## Architecture

When you `.add()` something to an Element, FOAM inspects its type and picks
the right rendering strategy:

```
                         .add(value)
                             |
                    +--------+--------+
                    |                 |
              Is it a Slot?    Is it a DynamicFunction?
                    |                 |
                    v                 v
              +----------+     +--------------+
              | SlotNode |     | FunctionNode |
              +----------+     +--------------+
                    |                 |
            On change:          On change:
            Swap one node       Remove everything between
            via replaceChild    <!-- dynamic --> comments,
                                re-run function
```

This dispatch happens in `Element2.js:addChild_()` (line 1318). The two
strategies have fundamentally different performance characteristics.

---

## The Four Reactive Patterns

```
+-------------------------------------------------------------------+
|                     Reactive UI Patterns                          |
|                                                                   |
|  LIGHTWEIGHT (no DOM rebuild)     HEAVYWEIGHT (DOM rebuild)       |
|  +---------------------------+   +---------------------------+   |
|  | 1. Slot binding (prop$:)  |   | 4. dynamic()              |   |
|  |    - Wires slots between  |   |    - Tears down DOM region |   |
|  |      parent and child     |   |    - Re-runs build function|   |
|  +---------------------------+   |    - Creates new components|   |
|  | 2. dot()                  |   +---------------------------+   |
|  |    - Follows nested path  |                                   |
|  |    - Re-wires on change   |                                   |
|  +---------------------------+                                   |
|  | 3. map()                  |                                   |
|  |    - Transforms value     |                                   |
|  |    - Swaps single node    |                                   |
|  +---------------------------+                                   |
+-------------------------------------------------------------------+
```

---

## Pattern 1: Slot Binding (`prop$:`)

### What It Does

Pass a slot to a child component's property by appending `$` to the property
name in a `.tag()` or `.start()` call. The child's property is linked to the
parent's slot — changes flow through without any DOM rebuild.

### How It Works

When you write `data$: this.name$`, FOAM links the two property slots. The
child component receives value changes through its own property change
system and handles rendering internally.

### Minimal Example

```javascript
// Parent passes its 'searchTerm' slot to child's 'data' property
this.start(this.TextField, { data$: this.searchTerm$ }).end();
```

### When To Use

- Wiring a parent value into a child component
- Sharing one slot across multiple children
- Any time the child already knows how to render the value

### Real Examples to Study

| File | Line | What It Shows |
|------|------|---------------|
| `foam3/src/foam/u2/FormattedTextField.js` | 99 | Two TextFields share `mode$` but have different `data$` |
| `foam3/src/foam/u2/DAOList.js` | 167 | Multiple slots passed to LazyScrollManager |
| `foam3/src/foam/u2/PropertyBorder.js` | 338 | `expanded$` slot controls child collapse state |
| `foam3/src/foam/u2/view/ChoiceView.js` | 470 | Eight slots passed to a select spec |

---

## Pattern 2: `slot.dot()` — Nested Property Tracking

### What It Does

Creates a slot that tracks a property **inside** another slot's value.
If the outer value is swapped for a new object, `dot()` automatically
re-wires to the new object's property.

### How It Works

`dot()` creates a `SubSlot` (`Slot.js:319`). The SubSlot subscribes to
the parent slot. When the parent changes, the SubSlot detaches from the old
object and attaches to the new one. Two levels of subscription — one for
the container, one for the property inside it.

```
this.data$.dot('transactions')

    this.data$  ----watches---->  this.data
         |
    SubSlot     ----watches---->  this.data.transactions
         |
    If this.data changes to newObj:
    SubSlot     ----re-wires--->  newObj.transactions
```

### Minimal Example

```javascript
// Create a slot tracking data.transactions, surviving data reassignment
var transactions$ = this.data$.dot('transactions');

// Use it: bind to child, add to DOM, or subscribe
this.tag({ class: 'foam.comics.v3.DAOView', data$: transactions$ });
```

### Chaining

`dot()` supports `$`-separated paths for deep nesting:

```javascript
// Equivalent to: this.data$.dot('address').dot('city')
var city$ = this.data$.dot('address$city');
```

### When To Use

- Accessing a property on an object that might be replaced
- Creating a reactive path through nested objects
- Building a slot to pass as `prop$:` to a child component

### Real Examples to Study

| File | Line | What It Shows |
|------|------|---------------|
| `foam3/src/foam/u2/PropertyBorder.js` | 75 | `data$.dot(prop.name)` to get/set nested property values |
| `foam3/src/foam/u2/PropertyBorder.js` | 164 | `data$.dot(prop.name).map(...)` — dot then map for derived boolean |
| `foam3/src/foam/u2/DAOList.js` | 182 | `scrollEl_$.dot('topRow')` — display nested counter |
| `foam3/src/foam/u2/TextInputCSS.js` | 78 | `theme$.dot('allowVariants')` — context property drives CSS class |
| `foam3/src/foam/u2/stack/DesktopStackView.js` | 29 | `data$.dot('top').sub(...)` — subscribe to nested changes |

---

## Pattern 3: `slot.map()` — Value Transformation

### What It Does

Creates a new slot whose value is a function of the source slot's value.
When added to the DOM, FOAM renders it via `SlotNode`, which swaps a
single DOM node when the value changes.

### How It Works

`map(f)` creates an `ExpressionSlot` (`Slot.js:222-224`). The
ExpressionSlot subscribes to the source and re-evaluates `f` on change.
`SlotNode` calls `replaceChild` to swap the old node — no DOM region
teardown, no comment markers.

```
this.count$.map(n => n + ' items')

    count$  ----change---->  ExpressionSlot re-evaluates f
                                    |
                             SlotNode does replaceChild
                             (swaps one text node)
```

### Minimal Example

```javascript
// Transform a number to display text
this.start('span')
  .add(this.count$.map(function(n) { return n + ' items selected'; }))
.end();

// Boolean toggle for CSS class
this.enableClass('selected',
  this.selection$.map(function(sel) { return sel === obj; })
);
```

### When To Use

- Displaying a formatted or derived value
- Boolean conditions for CSS classes (`enableClass`)
- Simple conditional text (not conditional DOM structure)
- Negating a boolean slot: `slot.map(function(v) { return ! v; })`

### Real Examples to Study

| File | Line | What It Shows |
|------|------|---------------|
| `foam3/src/foam/u2/Element2.js` | 984 | `slot.map(function(s) { return !s; })` — boolean negation for `hide()` |
| `foam3/src/foam/u2/table/UnstyledTableView.js` | 238 | Sort arrow indicator derived from sort order slot |
| `foam3/src/foam/u2/detail/FlexSectionedDetailView.js` | 59 | Section visibility from availability slot |
| `foam3/src/foam/u2/PropertyBorder.js` | 164 | `dot().map()` chain — nested property to boolean |

---

## Pattern 4: `dynamic()` — Conditional DOM Rendering

### What It Does

Runs a function that builds DOM using `this.start()`/`this.end()`. When
any watched property changes, FOAM **tears down everything** the function
previously built and **re-runs** the function from scratch.

### How It Works

`dynamic()` creates a `DynamicFunction` (`Slot.js:638`), which extends
`ExpressionSlot` but is **push-based** — it eagerly re-evaluates even if
nobody reads the value. Element renders it via `FunctionNode`
(`Element2.js:258`), which places two HTML comment markers in the DOM:

```html
<!-- dynamic -->
  ... everything built by the function ...
<!-- /dynamic -->
```

On change, `FunctionNode` removes every DOM node between those comments
(line 289-295), then re-runs the function to build new content.

### Minimal Example

```javascript
var self = this;
this.add(this.dynamic(function(mode) {
  if ( mode === 'EDIT' ) {
    this.start(self.TextField, { data$: self.name$ }).end();
  } else {
    this.start('span').add(self.name$).end();
  }
}));
```

### Important Rules

- Use `this.start()` inside the function (not `this.E()`)
- Use `self.myClass()` for CSS classes (not `this.myClass()`)
- Do not return elements — build via side effects
- FOAM infers watched properties from function parameter names

### When To Use

- The **structure** of the DOM changes (different elements, different
  components, different layout)
- Conditional rendering: show component A or component B
- Mode switching: edit view vs. read-only view

### When NOT To Use

- The structure stays the same but the data changes — use slot binding
- You are creating the same components every time — use `dot()` + `prop$:`
- You only need to change text or a CSS class — use `map()`

### Real Examples to Study

| File | Line | What It Shows |
|------|------|---------------|
| `foam3/src/foam/u2/tag/Button.js` | 534 | Three different icon DOM structures based on icon type |
| `foam3/src/foam/u2/view/RichChoiceView.js` | 819 | Citation view vs. placeholder based on selection |
| `foam3/src/foam/u2/view/ChoiceView.js` | 466 | Select control rendered only in non-RO mode |
| `foam3/src/foam/u2/view/MarkdownView.js` | 505 | Parses markdown and renders token-based DOM |

---

## Decision Framework

Ask these questions in order:

```
Does the child component already handle updates internally?
  |
  +-- YES --> Slot binding: prop$: slot
  |
  NO
  |
Do you need to track a property inside a changing object?
  |
  +-- YES --> dot(): this.data$.dot('propName')
  |
  NO
  |
Does the DOM STRUCTURE stay the same (only values change)?
  |
  +-- YES --> map(): slot.map(fn) for display transforms
  |
  NO — structure changes based on value
  |
  +--> dynamic(): this.dynamic(function(prop) { this.start()... })
```

### Composition

These patterns compose. Common combinations:

| Combination | Use Case |
|-------------|----------|
| `dot()` + `prop$:` | Track nested property, wire into child component |
| `dot()` + `map()` | Track nested property, transform for display |
| `dot()` + `sub()` | Track nested property, run imperative code on change |
| `map()` + `enableClass()` | Derive boolean from slot to toggle CSS |

Example of `dot()` + `map()` from `PropertyBorder.js:164`:

```javascript
var hasValue = this.data$.dot(prop.name).map(v => ! prop.isDefaultValue(v));
```

---

## How Element Renders Each Pattern

This section describes the internal dispatch in `Element2.js:addChild_()`
(line 1318). Understanding this clarifies why patterns behave differently.

### Slot → SlotNode

When you `.add()` a Slot (including results of `dot()` and `map()`),
Element wraps it in a `SlotNode` (`Element2.js:115`).

SlotNode places one placeholder node in the DOM. On change, it creates a
new node from the slot's value and calls `replaceChild` — one node in, one
node out. The old node is detached. No range scanning, no comment markers.

**Cost of update:** Create one node, one `replaceChild` call.

### DynamicFunction → FunctionNode

When you `.add()` a DynamicFunction (returned by `dynamic()`), Element
wraps it in a `FunctionNode` (`Element2.js:258`).

FunctionNode inserts two comment nodes as boundary markers. On change,
it walks the DOM between markers, removes every node, detaches every
child component, then re-runs the function. The function builds new DOM
via `this.start()` calls that insert before the end marker.

**Cost of update:** Detach N child components, remove N DOM nodes,
re-run function, create N new components, insert N new DOM nodes.

### Plain Function → dynamic()

When you `.add()` a plain function, Element calls `dynamic()` on it
(`Element2.js:1345-1348`), converting it to a DynamicFunction. This is
why `this.add(function(prop) { ... })` behaves like `dynamic()`.

---

## Gotchas

1. **`data:` vs `data$:` is a one-character difference with big consequences**
   - `data: someDAO` — copies the current value. Static.
   - `data$: someSlot` — links the slots. Reactive.
   - Forgetting the `$` means the child never sees updates.

2. **`dynamic()` destroys scroll position and component state**
   - Every re-fire tears down the DOM region.
   - Table scroll position, text input focus, expanded/collapsed state —
     all lost.
   - If you see flickering or lost state, you probably want `dot()` +
     slot binding instead.

3. **`map()` inside `dynamic()` is redundant**
   - `dynamic()` already re-runs everything. Using `map()` inside it
     creates a slot that gets thrown away on the next `dynamic()` cycle.
   - Use `map()` outside `dynamic()` — or replace `dynamic()` with
     `map()` entirely if the structure does not change.

4. **`dot()` detaches when the property disappears**
   - If the parent object is replaced with a different class that lacks
     the dotted property, the SubSlot detaches itself (`Slot.js:390`).
   - This is correct behavior, but can surprise you during debugging.

5. **Parameter names in `dynamic()` ARE the watched properties**
   - `this.dynamic(function(firstName, lastName) { ... })` watches
     `this.firstName` and `this.lastName`.
   - Rename a parameter and you change what FOAM watches.
   - Use `$` in parameter names for nested paths:
     `function(data$transactions)` watches `this.data.transactions`.

6. **`this` inside `dynamic()` is the Element, not your View**
   - Capture `var self = this;` before the `dynamic()` call.
   - Use `self.myClass()`, `self.someProperty`, `self.SomeRequire`.
   - Use `this.start()`, `this.end()`, `this.add()` for DOM building.

7. **Plain functions added via `.add()` become `dynamic()` calls**
   - `this.add(function(name) { ... })` is sugar for `dynamic()`.
   - The function is bound to `this.__subContext__.data`, not to `this`.
   - For explicit control, call `this.dynamic()` directly.
