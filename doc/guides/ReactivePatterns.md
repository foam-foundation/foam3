# FOAM Reactive Patterns — Complete Reference

All variations of slots, expressions, dynamic functions, and bindings in FOAM3.

---

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

---

## 2. `obj.slot('name')` — Axiom-Based Slot Lookup

**Source**: `FObject.js:763-805`

```javascript
// Equivalent to obj.name$ for simple properties
var slot = person.slot('fname');

// But also supports $ chaining (see #3)
var slot = person.slot('address$city');

// And function expressions (see #6)
var slot = person.slot(function(fname, lname) { return fname + ' ' + lname; });
```

**Returns**: `PropertySlot` for simple names, `SubSlot` chain for `$`-separated paths, `ExpressionSlot` for functions.

**Use case**: Programmatic access when the property name is a variable, or when you need the `$` chaining syntax.

---

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

---

## 4. `expression: function(a, b)` — Declarative Computed Property

**Source**: `Property.js:652-690` (`exprFactory`)

```javascript
properties: [
  { name: 'fname' },
  { name: 'lname' },
  {
    name: 'fullName',
    expression: function(fname, lname) { return fname + ' ' + lname; }
  }
]
```

**Internal mechanics**:

1. `exprFactory` extracts arg names via `foam.Function.argNames(e)` → `['fname', 'lname']`
2. For each arg, calls `this.slot(argName)` — which supports `$` chaining
3. Subscribes to each slot; on change: clears the cached value (`clearPrivate_`)
4. Next `get()` re-runs the expression

**Key behaviors**:

- **Lazy** — only recomputes when someone reads the value
- **Overridable** — setting `obj.fullName = 'Custom'` overrides the expression until `clearProperty('fullName')`
- **Receives resolved values**, not slots (arg `fname` = `'John'`, not a PropertySlot)

**Deep path in expression**:

```javascript
expression: function(block$flowParent$value$currency) {
  // Parameter name tells FOAM to call this.slot('block$flowParent$value$currency')
  // The arg receives the resolved leaf VALUE: 'USD'
  return block$flowParent$value$currency || 'USD';
}
```

**Use case**: Derived properties that depend on other properties. The primary reactive mechanism in model definitions.

---

## 5. `this.dynamic(function(a, b) {...})` — Eager Side-Effect Runner

**Source**: `FObject.js:748-761` → creates `DynamicFunction` (`Slot.js:636-733`)

```javascript
// In a view's render method:
var self = this;
this.data.dynamic(function(items, isLoading) {
  // 'this' is the Element being built
  this.start('div').addClass(self.myClass('list'));
  for ( var i = 0 ; i < items.length ; i++ ) {
    this.start('span').add(items[i]).end();
  }
  this.end();
});
```

**How it differs from `expression`**:

| Aspect | `expression` and slots | `dynamic()` |
|---|---|---|
| **Evaluation** | Lazy (pull) — only on `get()` | Eager (push) — runs immediately on change |
| **Invalidation** | `ExpressionSlot.invalidate` clears value | `DynamicFunction.invalidate` clears AND reads `this.value` |
| **Framing** | Not framed | `isFramed: true` — batches to animation frame |
| **Return value** | Used as property value | Ignored (side-effects only, returns seqNo) |
| **Async** | Stores promise, resolves later | Tracks `running`/`rerun` to prevent re-entrant calls |
| **`this` context** | The object owning the property | Configurable via `self` parameter |

**Use case**: UI rendering in views. The dynamic function rebuilds DOM whenever dependencies change. Not for computed values — for side effects.

---

## 6. `this.slot(function(a, b) {...})` — Lazy Computed Slot

**Source**: `FObject.js:767-775` → creates `ExpressionSlot`

```javascript
// Returns an ExpressionSlot
var fullNameSlot = person.slot(function(fname, lname) {
  return fname + ' ' + lname;
});
fullNameSlot.get();      // → 'John Smith'
fullNameSlot.sub(l);     // fires when fname or lname changes
```

**How it differs from `expression` property**:

- `expression:` is baked into a property definition (model time)
- `slot(fn)` creates an ad-hoc ExpressionSlot at runtime

**Use case**: When you need a reactive computed value outside of a model definition — in a method, view, or controller.

---

## 7. `slot.map(f)` — Transform a Slot's Value

**Source**: `Slot.js:222-224`

```javascript
function map(f) {
  return foam.lang.ExpressionSlot.create({code: f, args: [this]});
}
```

```javascript
var upperSlot = person.fname$.map(function(name) {
  return name.toUpperCase();
});
upperSlot.get(); // → 'JOHN'
```

**Use case**: Deriving a new reactive value from a single slot. Common in views for formatting.

---

## 8. `slot.follow(other)` — One-Way Binding

**Source**: `Slot.js:183-193`

```javascript
// slotA always copies slotB's value (one-directional)
slotA.follow(slotB);
```

**Use case**: When one slot should mirror another but not push changes back.

---

## 9. `slot.linkFrom(other)` — Two-Way Binding

**Source**: `Slot.js:124-173`

```javascript
// Bidirectional sync with feedback protection
slotA.linkFrom(slotB);
```

Also triggered when you **set** a `$` slot:

```javascript
// Property.js:501 — setting name$ links the two slots
person.fname$ = someOtherSlot;  // calls toSlot(this).linkFrom(slot2)
```

**Use case**: Keeping two properties in sync across different objects (e.g., view ↔ model).

---

## 10. `sub('propertyChange', 'name', listener)` — Raw Subscription

**Source**: `FObject.js:700-730` (pub/sub system)

```javascript
person.sub('propertyChange', 'fname', function(sub, topic, propName, slot) {
  console.log('fname changed to', slot.get());
});
```

**Use case**: When you just need a callback, not a slot. Lowest-level mechanism.

---

## Decision Tree

```
Need to react to property changes?
│
├── In a MODEL DEFINITION (property depends on others)?
│   └── Use `expression: function(a, b$c) {...}`              (#4)
│
├── In a VIEW (need to rebuild DOM)?
│   └── Use `this.data.dynamic(function(prop1, prop2) {...})`  (#5)
│
├── Need a SLOT REFERENCE to pass around?
│   ├── Single property?
│   │   └── Use `obj.name$`                                   (#1)
│   ├── Deep nested path?
│   │   └── Use `obj.slot('a$b$c')` or `obj.a$.dot('b')`     (#3)
│   └── Computed from multiple props?
│       └── Use `obj.slot(function(a, b) {...})`               (#6)
│
├── Need to TRANSFORM a slot?
│   └── Use `slot.map(fn)`                                     (#7)
│
├── Need to SYNC two slots?
│   ├── One-way → `slot.follow(other)`                         (#8)
│   └── Two-way → `slot.linkFrom(other)` or `a$ = b$`         (#9)
│
└── Just need a CALLBACK?
    └── Use `obj.sub('propertyChange', 'name', fn)`            (#10)
```

---

## The Trailing `$` — `test$testf$testf2$` vs `test$testf$testf2`

The trailing `$` is a critical distinction. These are NOT the same thing.

### As JavaScript Property Access

In JavaScript, `$` is a valid identifier character. So these are completely different:

```javascript
obj.test$         // FOAM getter → returns PropertySlot for 'test'
obj.test$testf$   // ONE JS identifier 'test$testf$' → likely undefined (no such getter)
```

FOAM only installs `name$` getters for each property (`Property.js:497`). It does NOT install multi-segment getters. So `obj.test$testf$testf2$` is a single JavaScript identifier — it returns `undefined` unless you happen to have a property literally named `test$testf$testf2`.

### As a String in `slot()` or Expression Arg Name

When the `$` chain appears as a string (in `slot()`) or as a function parameter name (in `expression:`), FOAM parses the `$` as a separator:

```
'test$testf$testf2'   →  3 segments: test → testf → testf2   (CORRECT)
'test$testf$testf2$'  →  4 segments: test → testf → testf2 → ''  (BROKEN)
```

**Trace of `'test$testf$testf2$'` through the code:**

**Step 1** — `FObject.slot('test$testf$testf2$')` (`FObject.js:792`):
```javascript
var split = 'test$testf$testf2$'.indexOf('$');  // → 4
var axiom = this.cls_.getAxiomByName('test');    // gets 'test' axiom
var slot = axiom.toSlot(this);                   // PropertySlot(test)
slot = slot.dot('testf$testf2$');                // chains the remainder
```

**Step 2** — `dot('testf$testf2$')` (`Slot.js:73`):
```javascript
var i = 'testf$testf2$'.indexOf('$');  // → 5
var left  = 'testf';                   // SubSlot(testf)
var right = 'testf2$';                 // recurse
→ SubSlot(testf).dot('testf2$')
```

**Step 3** — `dot('testf2$')` (`Slot.js:73`):
```javascript
var i = 'testf2$'.indexOf('$');  // → 6
var left  = 'testf2';           // SubSlot(testf2)
var right = '';                  // EMPTY STRING
→ SubSlot(testf2).dot('')
```

**Step 4** — `dot('')` (`Slot.js:73`):
```javascript
var i = ''.indexOf('$');  // → -1, no more $
// Falls to else branch:
return SubSlot.create({ parent: this, name: '' });  // SubSlot with EMPTY name
```

**Result**: Creates this chain:
```
PropertySlot(test)
  └─ SubSlot(testf)
       └─ SubSlot(testf2)
            └─ SubSlot('')  ← BROKEN: name is empty string
```

The empty-name SubSlot does `parent.get()['']` (`Slot.js:343`) which returns `undefined`. Its `parentChange` listener (`Slot.js:390`) calls `o.cls_.getAxiomByName('')` which returns `null`, causing the SubSlot to **detach itself** — killing the entire reactive chain.

### As an Expression Parameter

```javascript
// BROKEN — trailing $ creates empty SubSlot, detaches, stops reacting
expression: function(test$testf$testf2$) {
  return test$testf$testf2$;  // gets undefined, then stops updating
}

// CORRECT — no trailing $
expression: function(test$testf$testf2) {
  return test$testf$testf2;   // gets leaf value, stays reactive
}
```

### Summary Table

| Syntax | Context | Result |
|---|---|---|
| `obj.test$` | JS property access | PropertySlot for `test` |
| `obj.test$testf$` | JS property access | `undefined` — single identifier, no such getter |
| `obj.slot('test$testf')` | String in `slot()` | PropertySlot(test) → SubSlot(testf) |
| `obj.slot('test$testf$')` | String in `slot()` | ...→ SubSlot('') — BROKEN, detaches |
| `function(test$testf)` | Expression arg | Watches test.testf, receives value |
| `function(test$testf$)` | Expression arg | Broken empty SubSlot, stops reacting |

### Rule

**Never end a `$` chain with `$`.** The trailing `$` creates an empty-name SubSlot that detaches immediately. Use `test$testf$testf2` (no trailing `$`) for deep path watching.

The `$` suffix only has meaning as a **JavaScript property accessor** on the object itself (`obj.name$`), and even then only for single property names that FOAM installed getters for.

---

## Quick Equivalence Table

| Syntax | Creates | Evaluation | Depth |
|---|---|---|---|
| `obj.name$` | PropertySlot | — | Flat |
| `obj.slot('name')` | PropertySlot | — | Flat |
| `obj.slot('a$b$c')` | PropertySlot → SubSlot chain | — | Deep |
| `obj.a$.dot('b').dot('c')` | PropertySlot → SubSlot chain | — | Deep |
| `expression: function(a) {}` | exprFactory (inline) | Lazy | Flat or Deep via `$` args |
| `obj.slot(function(a) {})` | ExpressionSlot | Lazy | Flat or Deep via `$` args |
| `obj.dynamic(function(a) {})` | DynamicFunction | Eager + Framed | Flat or Deep via `$` args |
| `slot.map(fn)` | ExpressionSlot | Lazy | Single input |
| `slot.follow(other)` | Subscription | Push | — |
| `slot.linkFrom(other)` | Bidirectional sub | Push | — |
| `obj.sub(...)` | Raw listener | Push | — |
