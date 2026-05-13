# Reactive UI Patterns

How FOAM keeps the screen in sync with changing data — and when to use which approach.

## The Core Idea

Every UI framework must answer: "when data changes, what updates on screen?" React re-renders a virtual DOM and diffs. Angular dirty-checks. FOAM uses **slots** — observable value holders that notify subscribers when they change.

FOAM gives you four ways to connect slots to the DOM. They differ in **how much of the screen gets rebuilt** when data changes.

TL;DR: ReactiveUI - the more you can contain/isolate the changing pieces, the faster the re-render of that part of DOM.

## The Four Patterns — Lightest to Heaviest

Think of these as a spectrum. Start at the top; only reach for the heavier options when the lighter ones can't express what you need.

### 1. Slot Binding (`prop$:`) — "Pass the wire, not the value"

**What it does:** Links a parent's slot directly to a child component's property. The child handles rendering internally. No DOM rebuild at all.

**When to use it:** Whenever a child component already knows how to display the value.

```javascript
// Display Value
this.add(this.searchTerm$);
```
```javascript
// Display with ability to edit
...
requires: [
  'foam.u2.TextField'     // using require, when you use `this.TextField`, the textField will inherit ControllerMode from parent's context
],
... 
// when controllerMode=EDIT, you will get a textField to update the value of searchTerm, and RO in controllerMode=View
this.start(this.TextField, { data$: this.searchTerm$ }).end();
```

The `$` suffix is the key. `data: value` copies once. `data$: slot` creates a live link — the child sees every future change.

**Example to study:** `foam3/src/foam/u2/view/ChoiceView.js:470` — eight slots wired into a single select widget.

---

### 2. `slot.dot()` — "Follow the dot, even when the parent changes"

**What it does:** Creates a slot that tracks a property *inside* another slot's value. If the outer object gets replaced, `dot()` automatically re-wires to the new object's property.

**When to use it:** When you need to watch a nested property on an object that might be swapped out.

**The problem it solves:**

```javascript
// CAREFUL — grabs a slot from caseA; if this.data becomes caseB, still watching caseA
var transactions$ = this.data.transactions$;
// the above line is correct if you KNOW, that `data` isn't going to change
// OR you're inside dynamic function which updates `data`

// RIGHT — tracks this.data.transactions, surviving data reassignment
var transactions$ = this.data$.dot('transactions');
```

`dot()` subscribes at two levels: one for the container (`this.data`), one for the property inside it (`.transactions`). Either level changing triggers an update.

You can chain deeper: `this.data$.dot('address$city')` follows `this.data → .address → .city`, re-wiring at every level.

**Typical usage — combine with slot binding:**
```javascript
var transactions$ = this.data$.dot('transactions');
this.tag({ class: 'foam.comics.v3.DAOView', data$: transactions$ });
```

One `DAOView` is created. When the DAO changes, the view updates its table internally. No DOM teardown.

**Example to study:** `foam3/src/foam/u2/PropertyBorder.js:75` — `data$.dot(prop.name)` to track whichever property is being edited, even when `data` itself changes.

---

### 3. `slot.map()` — "Transform a value for display"

**What it does:** Creates a new slot whose value is derived from another slot by applying a function. When added to the DOM, FOAM swaps a single DOM node when the value changes.

**When to use it:** Displaying formatted text, toggling CSS classes, or any one-to-one value transformation.

```javascript
// Display text
this.add(this.count$.map(function(n) { return n + ' items selected'; }));

// Toggle a CSS class
this.enableClass('selected',
  this.selection$.map(function(sel) { return sel === obj; })
);
```

`map()` swaps one node for another — no region teardown, no comment markers. It's the lightest DOM-touching pattern.

**Composing with `dot()`:**
```javascript
var hasValue = this.data$.dot(prop.name).map(function(v) {
  return ! prop.isDefaultValue(v);
});
```

**Example to study:** `foam3/src/foam/u2/Element2.js:984` — `hide()` is implemented as `slot.map(function(s) { return !s; })`.

---

### 4. `dynamic()` — "Tear it all down and rebuild"

**What it does:** Runs a function that builds DOM. When any watched property changes, FOAM **removes everything** the function previously built and **re-runs** it from scratch.

**When to use it:** When different values require **different DOM structures** — not just different data flowing through the same components.

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

FOAM infers which properties to watch from the function's **parameter names**. `function(mode)` watches `this.mode`. `function(data$transactions)` watches `this.data.transactions`.

**Important `this` rule:** Inside the function, `this` is the Element (for `this.start()`, `this.end()`). Your view is captured as `self` outside the function.

**When NOT to use it:**
- Same structure, different data → use `dot()` + slot binding instead
- Only changing text or a CSS class → use `map()` instead
- Creating the same components every time → you're paying teardown cost for nothing

**Example to study:** `foam3/src/foam/u2/tag/Button.js:534` — three completely different icon DOM structures depending on `themeIcon` vs. `icon` vs. `iconFontName`.

---

## Choosing a Pattern

Ask these questions in order:

| Question | If YES, use... |
|----------|---------------|
| Does the child component already handle updates internally? | Slot binding: `prop$: slot` |
| Do you need to track a property inside a changing object? | `dot()`: `this.data$.dot('prop')` |
| Does the DOM structure stay the same (only values change)? | `map()`: `slot.map(fn)` |
| Does the DOM structure itself need to change? | `dynamic()` |

### Common Combinations

| Combination | Example |
|-------------|---------|
| `dot()` + `prop$:` | Track nested property, wire into child |
| `dot()` + `map()` | Track nested property, transform for display |
| `dot()` + `sub()` | Track nested property, run your own code on change (see below) |
| `map()` + `enableClass()` | Derive boolean to toggle CSS |

**`dot()` + `sub()` — the escape hatch for side effects:**

The other combinations are declarative — FOAM handles the rendering. `sub()` is for when a value change should trigger something that isn't a DOM update: closing a popup, logging, resetting state, calling a service, etc.

```javascript
// When the top of the navigation stack changes, close any open popup
this.data$.dot('top').sub(function() {
  if ( self.openPopup ) self.openPopup.close();
});
```

See `foam3/src/foam/u2/stack/DesktopStackView.js:29` for a real example — it watches the stack's `top` property and manages popup lifecycle in response.

---

## What Happens Under the Hood

You don't need to know this to use the patterns, but it explains why they behave differently.

When you `.add()` something to an Element, FOAM inspects its type and picks a rendering strategy (`Element2.js:addChild_()`, line 1318):

### Slots (from `dot()` or `map()`) → SlotNode

FOAM wraps the slot in a `SlotNode`. It places one placeholder node in the DOM. On change, it creates a new node and calls `replaceChild` — one node in, one node out.

**Update cost:** One `replaceChild` call. Old node detached.

### DynamicFunction (from `dynamic()`) → FunctionNode

FOAM wraps it in a `FunctionNode`, which inserts two HTML comment markers: `<!-- dynamic -->` and `<!-- /dynamic -->`. On change, it removes every DOM node between those comments, detaches every child component, then re-runs the function to build new content.

**Update cost:** Remove N nodes, detach N components, re-run function, create N new components, insert N new nodes.

### Plain function → `dynamic()`

Normally, `this.add(function(name) { ... })` is syntactic sugar — FOAM calls `dynamic()` on it. So a bare function in `.add()` has the same teardown-and-rebuild behavior. When we say "Normally", we are assuming that the `.add(function()...)` call is made in a context where `data` hasn't been overridden by a parent `startContext()` or a child view that exports its own `data`. In simpler terms: the deeper you nest your `start()`/`end()` chains, the more likely the context's `data` has changed from what you expect — using `self.dynamic()` explicitly avoids this by binding to exactly the object you choose. 

i.e. if you do `this.add(function()...)` instead of `this.add(self.dynamic(function()...))` then it will look for a `data` object in the current context and if the view/element doesn't find `data` in current context then the view will use the `this` you called `.add()` on, which if you have a nested structure of U3 calls in your render() method may not be the object(`data`) you expect.

---

## Gotchas

1. **`data:` vs `data$:` — one character, big difference**
   - `data: someDAO` copies the current value. Static.
   - `data$: someSlot` links the slots. Reactive.
   - Forgetting the `$` means the child never sees updates.

2. **`dynamic()` destroys scroll position and component state**
   - Every re-fire tears down the DOM region. Table scroll, input focus, expanded/collapsed state — all lost.
   - If you see flickering, minimize the amount of DOM inside the reactive boundary. All reactive patterns touch the DOM (`SlotNode` does `replaceChild`, `map()` swaps nodes), but smaller reactive regions mean faster redraws. Move what you can outside the `dynamic()` using `dot()`, `map()`, or slot binding — keep `dynamic()` only around the elements whose structure actually changes.

3. **`map()` inside `dynamic()` is wasted work**
   - `dynamic()` throws everything away on each cycle, including any `map()` slots created inside it.
   - Use `map()` outside `dynamic()`, or replace `dynamic()` with `map()` if the structure doesn't change.

4. **Parameter names in `dynamic()` ARE the watched properties**
   - Rename a parameter → change what FOAM watches.
   - Use `$` for nested paths: `function(data$transactions)` watches `this.data.transactions`.

5. **`this` inside `dynamic()` is not your View**
   - `this` = the Element (for DOM building). `self` = your view (captured before the call).
   - `this.start()`, `this.end()`, `this.add()` for DOM. `self.myClass()`, `self.someProperty` for your view.

6. **`dot()` detaches when the property disappears**
   - If the parent is replaced with a different class that lacks the dotted property, the sub-slot detaches itself. Correct behavior, but can surprise you during debugging.

## See Also

- [Expressions vs dynamic()](dynamic.md) — how model-level `expression` (lazy, pull-based) differs from `this.dynamic()` (eager, push-based)

## Further Reading — Real Examples by Pattern

Each entry is a real view in the FOAM3 codebase that uses the pattern well. Read the surrounding code for context.

### Slot Binding (`prop$:`)

| File | What it shows |
|------|---------------|
| `foam3/src/foam/u2/FormattedTextField.js:99` | Two TextFields share `mode$` but have different `data$` |
| `foam3/src/foam/u2/DAOList.js:167` | Multiple slots passed to LazyScrollManager |
| `foam3/src/foam/u2/PropertyBorder.js:338` | `expanded$` slot controls child collapse state |

### `slot.dot()`

| File | What it shows |
|------|---------------|
| `foam3/src/foam/u2/PropertyBorder.js:164` | `data$.dot(prop.name).map(...)` — dot then map for derived boolean |
| `foam3/src/foam/u2/DAOList.js:182` | `scrollEl_$.dot('topRow')` — display nested counter |
| `foam3/src/foam/u2/TextInputCSS.js:78` | `theme$.dot('allowVariants')` — context property drives CSS class |
| `foam3/src/foam/u2/stack/DesktopStackView.js:29` | `data$.dot('top').sub(...)` — subscribe to nested changes |

### `slot.map()`

| File | What it shows |
|------|---------------|
| `foam3/src/foam/u2/table/UnstyledTableView.js:238` | Sort arrow indicator derived from sort order slot |
| `foam3/src/foam/u2/detail/FlexSectionedDetailView.js:59` | Section visibility from availability slot |
| `foam3/src/foam/u2/PropertyBorder.js:164` | `dot().map()` chain — nested property to boolean |

### `dynamic()`

| File | What it shows |
|------|---------------|
| `foam3/src/foam/u2/view/RichChoiceView.js:819` | Citation view vs. placeholder based on selection |
| `foam3/src/foam/u2/view/ChoiceView.js:466` | Select control rendered only in non-RO mode |
| `foam3/src/foam/u2/view/MarkdownView.js:505` | Parses markdown and renders token-based DOM |

## Key Source Files

| File | What to look for |
|------|-----------------|
| `foam3/src/foam/lang/Slot.js` | `dot()` (line 72), `map()` (line 222), SubSlot (line 319), ExpressionSlot (line 522), DynamicFunction (line 638) |
| `foam3/src/foam/lang/FObject.js` | `dynamic()` (line 748) |
| `foam3/src/foam/u2/Element2.js` | `addChild_()` dispatch (line 1318), SlotNode (line 115), FunctionNode (line 258) |
