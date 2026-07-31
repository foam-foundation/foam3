# Property Gotchas

How a property's value, view and label actually resolve: when `factory`, `expression` and `postSet` fire, what `transient` cascades into, which access form runs the permission check, and how axioms are reused and reflected over.

Every claim cites the code that proves it. Line numbers drift — anchor on the named method if a citation no longer lines up.

For the basics, start with [Axioms.md](Axioms.md), [Slots.md](Slots.md) and [Refinements.md](Refinements.md).

---

## Choosing where a computed value lives

| Need | Use | Why not the others |
|---|---|---|
| Recompute on every read, both runtimes | `getter` + `javaGetter` | A `factory` caches; an `expression` is JS-only |
| Compute once at first read, both runtimes | `factory` + `javaFactory` | Safe on frozen objects, see below |
| React to a live change | `postSet` | Dead on initial state, see below |
| Derived value that must push to a passive consumer | `dynamic()` writing a plain property | An `expression` goes cold, see below |
| Server-side compute | `javaGetter` / `javaFactory` | `expression` generates no Java (`src/foam/lang/Property.js:657`) |

### `postSet` is transition-only

A `postSet` runs only when the **setter** is invoked. Three initialization paths never invoke it, so behaviour that must hold for the *initial* state silently never happens:

1. **A `value:` default.** The getter returns the default without ever calling the setter, so a property declared `value: true` and never assigned fires `postSet` zero times.
2. **A `prop$` slot binding.** The slot setter runs `prop.toSlot(this).linkFrom(slot2)` (`src/foam/lang/Property.js:507`), and `linkFrom`'s initial sync is guarded by `if ( ! foam.util.is(s1.get(), s2.get()) )` (`src/foam/lang/Slot.js:134`, initial call at `:163`). **If the bound values are already equal, no set happens and `postSet` never fires.** The classic trap is `value: true` on the view property plus a source that is already `true` — the `postSet` meant to build a predicate or switch a class runs never.
3. **Deserialization and `copyFrom` ordering.** `postSet` fires per property in declaration order, so siblings it reads may not be set yet.

Derive initial state instead of hooking it: `expression:` for a reactive derived value, `factory:` for once-at-first-read, or an explicit idempotent call in `init()`/`render()` for setup that must run even when the transition never happens. Keep `postSet` for reacting to a live change.

### A property `expression` is lazy, one-shot, and can go cold

An `expression` is pull-based, not a push-on-change binding. In `src/foam/lang/Property.js`:

- The getter caches in a **private** slot: `eFactoryGetter` (`:546-550`) returns `getPrivate_(name)` if present, without recomputing.
- On any dependency change, `exprFactory`'s listener clears the private cache (`:672`), publishes `propertyChange` **only if something is already subscribed**, then **detaches every dependency subscription** (`:679`).

So the dependency subscription is one-shot: re-subscription happens only when the property is read again, which re-runs `exprFactory`. If nothing is actively subscribed at the instant a dependency fires, the cache clears, the deps detach, no event is published, and the slot stays cold until a manual read.

A manually created `foam.lang.ExpressionSlot` has the same laziness — "updates will not be generated from calling .sub() unless you also call .get()" (`src/foam/lang/Slot.js:525-529`).

This is why two expressions over the same dependency behave differently: one feeding a DAO table recomputes fine, because the table holds a permanent listener and re-reads on every change, while a sibling feeding a passive display keeps its empty-state value forever.

For a derived value that must update on every change of an async-populated array, do not use an `expression`. Compute it in a `this.dynamic(function(dep) { this.x = ... })` block (`src/foam/lang/Slot.js:638`) and store it in a **plain** property — a plain `PropertySlot` pushes on every set, with no private-cache laziness and no one-shot detach.

Corollary: because the cache lives in `private_`, `hasOwnProperty(name)` stays **false** even after the expression has fired, so code branching on `hasOwnProperty` treats an expression default as unset.

### `javaFactory` is frozen-safe

The intuitive worry is that a `factory` caching its value by writing the backing field throws when read off a frozen object. It does not.

**Java** — codegen builds a `beforeFreeze()` that calls the getter for every property with a `javaFactory` (`src/foam/java/refinements.js:648-658`), and `freeze()` runs `beforeFreeze(); __frozen__ = true;` in that order (`:707-710`). Each factory resolves and sets its field while the object is still mutable. After the freeze, the generated getter hits its `if ( ! xIsSet_ )` guard, sees the field set, and returns it without reaching the setter's `assertNotFrozen()` (`:401`, `:496`). Cross-factory dependencies are safe for the same reason.

**JS** — there is no freeze mechanism at all; `src/foam/lang/FObject.js` defines no `freeze`, `isFrozen` or `assertNotFrozen`.

So do not avoid `javaFactory` on a computed property out of frozen-safety fear. Choose `getter`/`javaGetter` over `factory` when you actually want recompute-on-every-access, not because a factory would throw.

### But do not use `javaFactory` for a value that needs request state

Generated `compareTo` is a straight walk of **every** property in declaration order, with no filter for transient or derived:

```javascript
// src/foam/java/refinements.js:829
return 'cmp = ' + foam.String.constantize(f.name) + '.compare(this, o2);\n'
     + 'if ( cmp != 0 ) return cmp;';
```

`equals` is `compareTo(o) == 0` (`refinements.js:745`), and `RulerDAO.put_` calls `equals()` to decide whether a put changed anything. So every property is read on every put, including ones you expected to stay cold. A `javaFactory` that needs request-scoped state — a context, a resolved DAO, another object's class info — therefore runs during the put, long before whatever was meant to provide that state, and throws from inside the DAO layer:

```
at SomeModel.SomeProp_Factory_(SomeModel.java)
at SomeModel$SomePropPropertyInfo.compare(SomeModel.java)
at SomeModel.equals(SomeModel.java)
at foam.core.ruler.RulerDAO.put_(RulerDAO.java)
```

Compute the value where its inputs are known and set it there. A factory also caches, so a lenient fallback pins a wrong value for the object's lifetime — failing loudly beats resolving against a half-built state.

**`javaCompare` looks like the fix and is not, on array properties.** `AbstractArrayPropertyInfo.createJavaPropertyInfo_` overwrites the generated compare body unconditionally:

```javascript
// src/foam/java/refinements.js:2020 (also :2091, :2172, :2225 for the other array types)
var compare = info.getMethod('compare');
compare.body = this.compareTemplate();
```

So `javaCompare: 'return 0;'` on an array property is discarded with no warning. Scalar property types honour it.

---

## The transient flags and what they cascade into

**`transient: true` sets both `networkTransient` and `storageTransient`** — each defaults to the value of `transient` (`src/foam/lang/EndBoot.js:229,243`). A transient property is therefore neither journaled nor sent over the wire, and each side recomputes it locally.

**`networkTransient` is encode-only.** It suppresses output — `foam.json.Network` will not encode the field (`EndBoot.js:205-206`) — but the JSON **parser** has no networkTransient filter — the flag appears nowhere under `src/foam/lib/json` — so an incoming value IS set on the object even when the receiver's own PropertyInfo marks it networkTransient.

That asymmetry is a useful lever: a staging field that must reach the server on a put but never be journaled is `storageTransient: true`, **not** `transient: true` (which also sets `networkTransient` and drops it on the wire). Because decode never filters, the client simply starting to send the field is enough — the server reads it with no recompile.

**`searchable` is derived from `transient`, not defaulted:**

```javascript
// src/foam/parse/QueryParser.js:25-26
{ name: 'searchable', expression: function(transient) { return ! transient; } }
```

and the query grammar drops any property that fails it before adding comparison rules:

```javascript
// src/foam/parse/SimpleQueryParser.js:325
function processProp(prop, propertyParser) {
  if ( ! prop.searchable ) return;
```

So `transient: true` silently removes the property from every `=`, `!=`, `>`, `>=`, `<`, `<=` rule, and from the search bar and its autocomplete. Note the operator set — there is no `==`, and writing it is itself a parse error.

The confusing part is that **a bare reference still resolves.** An expression language that looks a field up by name, rather than through the grammar's field list, will happily compile a plain mention of the column while a comparison over the same column fails to parse — the formula stores empty and the value renders blank with no error anywhere.

Two flags, two questions: `transient` means "not stored", `searchable` means "may appear in a predicate". A value resolved on read is legitimately both, so set `searchable: true` explicitly on a transient property that should stay queryable.

**To expose a computed property to search while keeping it out of journals, use `storageTransient: true` alone.** The literal `transient` flag stays false, so `searchable` stays true and `networkTransient` stays false.

**The `searchable` gate is JS-only.** `SimpleQueryParser.js` skips a non-searchable property, while the Java parser iterates `getAxiomsByClass(PropertyInfo.class)` and builds its name map with no `searchable` check at all (`src/foam/parse/SimpleQueryParser.java:424-431`) — a real client/server difference in accepted query syntax.

**A subclass override must reset the literal flag.** An override clones the parent axiom, so a parent's literal `transient: true` rides along and keeps forcing `networkTransient` on the child. To narrow a fully-transient parent property to storage-only in one subclass, set BOTH `transient: false` and `storageTransient: true` — `storageTransient: true` alone changes nothing.

---

## isSet: the gate that makes derived values disappear

**Java serialization gates on isSet and never consults getters.** `Outputter.maybeOutputProperty` returns early unless the property is set: `if ( ! outputDefaultValues_ && ! prop.isSet(fo) ) return false;` (`src/foam/lib/json/Outputter.java:355-357`). Only past that line does it call `prop.get(fo)` (`:359`).

So a value that exists only in a `javaGetter` derivation — never set — is invisible to full-object network serialization no matter what `networkTransient` says. The flag predicate filters the property list, the isSet check gates each row, and the getter is consulted only after both pass. Symptom: the server derives the value correctly (search, scripts and projections all see it) while every DAO select ships rows without it and the client renders blank.

Two asymmetries hide the bug:

- **Projection sinks evaluate the property server-side.** `Projection.put` calls `exprs[i].f(o)`, which runs the `javaGetter` (`src/foam/mlang/sink/Projection.js:142-152`). A projection select carries the derived value; a full-object select drops it. So an export or a dashboard works while a table forced into full-object mode shows blank.
- **The client-to-server direction has no such gate.** `foam.json.Network` uses `outputDefaultValues: true` (`src/foam/lang/JSON.js:719-730`), so a client put sends set values including defaults. A value set in a wizard round-trips fine until a server restart, when journal replay leaves a `storageTransient` property unset.

Levers, in order of preference:

1. **Set-on-write isSet flip.** A sibling property's `javaPostSet` sets the backing flag — `javaPostSet: 'derivedPropIsSet_ = true;'` on the driving property. Journal replay and puts both run setters, so every record with the driver set becomes serializable, while the value itself still comes fresh from the getter at output time. Do **not** do DAO lookups in that postSet: deserialization contexts have no DAOs.
2. **Persist the value.** Costs storage and adds staleness risk.
3. **Resolve client-side.** No server change, but per-row async and no server-side search benefit.

**There is no isSet override hook.** The generated `PropertyInfo.isSet` body is hardcoded to `return o.<name>IsSet_;` (`src/foam/java/PropertyInfo.js:212-217`); there is no `javaIsSet` counterpart to `javaGetter`/`javaSetter` (`src/foam/java/refinements.js:239-243`). Adding one would be the framework-level fix for "derived and serializable".

### Client-side, `hasOwnProperty` is the isSet check

`FObject` overrides `hasOwnProperty` to return true only when `instance_` holds a non-undefined value for the name (`src/foam/lang/FObject.js:449-455`), which is what the property getters test internally (`Property.js:547,601-603`). It is the JS analogue of Java's `p.isSet(obj)`.

**This is the only way to handle the Enum trap.** An Enum property has no null value: an unset Enum reads back as its ordinal-0 value, the first `values:` entry. So `obj.enumProp` is never null, and `obj.enumProp ? label : blank` always takes the truthy branch — the field displays the first enum as though it had been chosen. `obj.hasOwnProperty('enumProp')` is the only client-side way to tell "never set" from "showing the ordinal-0 default".

Gate the display on it in a read view, a `tableCellFormatter`, or a `visibility` function. Note that inside a property `view` the value slot is the enum itself and cannot tell set from unset — reach the parent object through `X.data$` to run the check.

Two caveats that flip the check:

- A transient property is never serialized, so a DAO-loaded client object starts unset and stays `hasOwnProperty`-false until something derives it. Do not rely on an async `init()` derivation to fill a table cell: it resolves late or not at all for row objects, and a non-reactive `tableCellFormatter` never repaints. The durable fix is to make the server ship the value, per the isSet levers above.
- An `expression` value caches in `private_`, so `hasOwnProperty` stays false even after it fires.

### `copyFrom` copies only isSet source properties

Java `FObject.copyFrom(obj)` (`src/foam/lang/FObject.java:299-317`) has two semantics that bite adapter and facade models:

1. **Only `isSet` source properties copy** — same-class `if ( p.isSet(obj) ) p.set(this, p.get(obj))` (`:305`), and the same guard on the name-matched property cross-class (`:309`). A `value:` default is not set, so it never propagates; only an explicit setter call reaches the target.
2. **A cross-class copy matches by property name and silently drops the rest.** It iterates the TARGET's properties and pulls same-named ones from the source (`:307-309`), with a per-property `ClassCastException` swallowed at `:312`. Facade-only properties vanish on the way into the delegate model and can never be reconstructed on the reverse copy — reads show type defaults rather than stored values.

For an adapter DAO built on `copyFrom` in both directions, assume a round trip preserves only properties that exist on both models and were explicitly set. Defaults need explicit setters on the create path; facade-only display fields need derivation on the read path or they render blank. JS `copyFrom` behaves equivalently.

---

## Reusing, naming and writing properties

### `__copyFrom__` clones another model's Property axiom

```javascript
properties: [
  { __copyFrom__: 'foam.core.auth.User.USER_NAME', order: 3, storageTransient: true }
]
```

At model build, the `properties` AxiomArray adapter walks `globalThis` down the dotted path to that Property, `clone()`s it, then `copyFrom(o)` layers your overrides on top (`src/foam/lang/EndBoot.js:66-77`). A bad path logs `UNKNOWN __copyFrom__:` and silently falls through — no error.

It is a JS-only key that still produces a real Java axiom, because genjava runs the JS model: getters and PropertyInfo generate normally.

**Gotcha:** the clone carries `javaPostSet`/`javaPreSet` into a class that may not be able to compile them. A hook that references a sibling backing field (`otherPropIsSet_ = true;`) fails javac with "cannot find symbol" in a target class that has no such sibling. Override the hook locally to void it: `javaPostSet: '// not applicable here'`.

Use it when a facade or simplified model needs a field from an unrelated model it cannot `extends`. This is distinct from the runtime `copyFrom(o)` method (`src/foam/lang/FObject.js:982`), which merges another object's **values** into `this`.

### Property names take no trailing underscore

A trailing underscore is FOAM's convention for transient internal scratch fields, so using it on a real property mislabels intent. Java accessors derive from the name by capitalizing — `resolvedValue` becomes `getResolvedValue()`/`setResolvedValue()` — so renaming the property later renames every accessor.

### An assignment with no matching Property axiom is a silent dead write

Property behaviour — setter routing, `adapt`/`preSet`/`postSet`, slots, serialization — exists only where a Property axiom installed an accessor on the prototype. `obj.foo = x` with no Property named `foo` creates a plain disconnected own-property: no setter runs, nothing serializes, nothing reacts, and no error or warning fires.

**Interface methods give you nothing here.** `foam.INTERFACE` methods are `InterfaceMethod` axioms whose `installInProto` is an empty function (`src/foam/lang/Interface.js:37-38`). Declaring a `setFoo`/`getFoo` pair on an interface does NOT create a `foo` property or accessor — the method pair and the property are unrelated namespaces in JS FOAM.

Verify before trusting an assignment: `obj.cls_.getAxiomByName('foo')` should return a Property. If only methods exist, call the method or assign the real underlying property.

### `shortName` halves the wire payload and is journal-safe to add

The HTTP and WebSocket boxes serialize with short names — `setOutputShortNames(true)` in `src/foam/box/HTTPBox.js:140`, `HTTPReplyBox.js:40`, `RawWebSocketBox.js:53` — and the outputter emits the shortName when set (`src/foam/lib/json/Outputter.java:491`). A model with no short names ships full property keys, roughly doubling the payload on wide records.

Adding one to an existing model is safe: the Java parser registers BOTH the full name and the shortName as parse keys (`src/foam/lib/json/ModelParserFactory.java:93-97`), so journals written with long keys still replay. Aliases are not registered as Java parse keys, so a shortName may reuse an alias code without conflict on the server path.

`shortName` must be **unique within the class including inherited properties** — FOAM asserts on a duplicate at class load — so check the parents and interfaces before adding one to a subclass.

### Imports are writable

An import axiom installs both a getter and a setter, and the setter writes back to the exporter's slot:

```javascript
// src/foam/lang/ImportsExports.js:126
set: function importsSetter(v) {
  var slot = this[slotName];
  if ( slot ) slot.set(v);
  else console.warn('Attempt to set missing import:', name);
}
```

So a child view can drive parent state with `this.selection = this.data`, and the parent reacts through `this.selection$` or uses it directly in `enableClass`/`attrs`. If nothing upstream exports the name the set falls through with a console warning and no error; an optional import (`'name?'`) silently no-ops.

---

## The four property access forms, and the permission trap

| Form | What it is |
|---|---|
| `OBJ.PROP` | The Property **axiom**. `.add(OBJ.PROP)` calls `Property.toE` and renders the **bare view** |
| `OBJ.PROP.__` | The same property wrapped in a `PropertyBorder` — label, inline validation, units, permission check. A **getter**, never called with `()` |
| `obj.propName` | The current value, non-reactive |
| `obj.propName$` | The reactive slot |

**`writePermissionRequired` and `readPermissionRequired` are enforced only in `createVisibilityFor`** (`src/foam/u2/Element2.js:1850`), where the check runs `auth.check` against `<ClassName>.rw.<propName>` (`:1877`).

Therefore `.add(prop)` never runs the permission gate: the field is read-write for everyone regardless of what the model declares, and no group configuration will change it. `.add(prop.__)` runs it.

**This is a silent bug pattern.** A model can declare `writePermissionRequired: true` and still be globally editable because one caller renders it with the bare axiom. Diagnosing it means knowing that `Property.toE` (`Element2.js:1781`) and `Property.toPropertyView` (`:1790`, reached through the `__` getter at `:1763`) are two different code paths, and only the second builds the border that checks permissions.

To render with permissions but without the `PropertyBorder` chrome — inside a tight table cell, say — strip it through the `config` argument rather than dropping back to the bare form:

```javascript
.tag(obj.SOME_PROP.__, { config: { label: '', reserveLabelSpace: false } })
```

`PropertyBorder.render` clones the property and `copyFrom`s `this.config` (`src/foam/u2/PropertyBorder.js:93`). With an empty label and `reserveLabelSpace: false`, the label slot renders `display: contents` (`:165-175`), so nothing is shown and no space is reserved — while the view still receives `mode$`, so the auth check fires. The same trick passes `view`, `units`, `helpText` and any other PropertyBorder property.

| Goal | Use |
|---|---|
| Editor with full label, validation and permission UI | `.add(prop.__)` |
| Compact editor WITH the permission gate | `.tag(prop.__, { config: { label: '', reserveLabelSpace: false } })` |
| Compact editor, forced read-only locally | `.startContext({ controllerMode: foam.u2.ControllerMode.VIEW })` … `.endContext()` |
| Compact editor, mode driven by your own slot | `.tag(prop, { mode$: someSlot })` |
| Compact editor with no mode awareness | `.add(prop)` — not when permissions matter |

---

## Labels, references, messages

### Every axiom without an explicit label gets a derived one

- **Enum values** — the `label` factory at `src/foam/lang/Enum.js:329`: an ALL_CAPS name splits on `_`, each word lowercased then capitalized, joined with spaces, so `AWAITING_SUBMISSION` renders "Awaiting Submission". A non-ALL_CAPS name is used as-is.
- **Properties and actions** — `foam.String.labelize(name)` (`src/foam/lang/Property.js:59`, `Action.js:58`): underscores become spaces, camelCase splits on case boundaries, first letter capitalized.

An explicit `label:` always wins. The raw name never appears in the UI, so quoting an enum constant in user-facing documentation is always wrong — grep for an explicit `label:` first, and write the derived form when there is none.

### A reference column's cell value is a `{id, summary}` projection

In a DAO table, a reference column's value is the RefSummary projection shape, not the raw id: the server resolves `toSummary()` during the projection, one pass over the DAO, instead of an N+1 find per row (`src/foam/mlang/expr/Ref.js`, `src/foam/core/column/TableColumnOutputter.js`).

`Reference.adapt` unwraps that shape on assignment — it stores `n.id` and caches `n.summary` into the generated `prop$summary_` slot (`src/foam/lang/types.js:1196-1204`) — and `ReferenceToSummaryCellFormatter` then renders the cached summary.

**Any `Reference` subclass that overrides `adapt` bypasses that unwrap.** If the override just returns `n`, it stores the raw `{id, summary}` object, the summary is never cached, and every column of that reference type renders blank. A custom `adapt` must mirror the branch:

```javascript
if ( n && ! foam.lang.FObject.isInstance(n) && typeof n === 'object' && n.id !== undefined ) {
  if ( n.summary != undefined ) this[`${(prop || this).name}$summary_`] = n.summary;
  return n.id;
}
```

### `CurrencyCode` normalizes numeric codes; `CountryCode` does not

`foam.lang.CurrencyCode` (`src/foam/lang/types.js:1450`) adds an async `normalize` that looks a numeric string up in the currency DAO by `NUMERIC_CODE` and returns the alpha id, so `"840"` becomes `"USD"` on load. Journals may use either form, and a mapping needs no numeric-to-alpha transform because the property does the conversion itself.

`foam.lang.CountryCode` (same file, `:1591`) is a plain Reference with no `normalize`, and the country DAO is keyed by alpha code. A numeric `"840"` stays `"840"` and the lookup fails, so country values in journals must be alpha.

### Localize a message with `messageMap`

Replace the plain `message: '...'` form with `messageMap: { en: '...', fr: '...' }`. The getter resolves `messageMap[foam.locale] || messageMap[foam.language]`, falling back to `messageMap.en` (`src/foam/i18n/Messages.js:90-105`). `foam.language` is always the first two characters of `foam.locale`, set by the `foam.locale` setter (`src/foam/lang/Boot.js:208-214`), so a hand-written `foam.language === 'fr'` branch in a render closure stays in sync with the map.

Two install paths decide how the message is called:

- **`template: true` with `${var}` placeholders** makes it a **callable**: `this.MY_MSG({ count: n })` returns the interpolated string, built from a `MessageTemplateParser` (`Messages.js:140`).
- **A plain message** installs as a constant on the **prototype** (`:137`), so it resolves off any instance of the defining class — which is what makes `obj.MY_MSG` work inside `tableCellFormatter: function(_, obj)` where `obj` is a row instance. It also installs on the class (`:122`) for `Cls.MY_MSG`.

---

## Reflection, interfaces and cloning

### Iterating property axioms returns framework internals

`cls_.getAxiomsByClass(foam.lang.Property)` in JS, or `getClassInfo().getAxiomsByClass(PropertyInfo.class)` in Java, includes `reactions_`, `reactionError_`, `reactionErrors_` and other trailing-underscore properties — not only the ones you declared. Code that digests "all properties", such as a generic `toSummary`, must exclude names ending in `_` or it stringifies them into `[object Object]`.

Related: an `FObjectProperty` rendered as a **table cell** shows blank or `[object Object]` unless its `of` model defines `toSummary()`, because the default citation path calls `data.toSummary?.()` (`src/foam/u2/CitationView.js`). A recursive `toSummary` must itself recurse through each value's `toSummary` rather than `String(v)`, or nested objects leak the same string.

### "Does this class implement interface X" is `X.isSubClass(model)`

`isSubClass(c)` returns true when `c` is this class, a subclass, or implements it — it tests `c.getAxiomByName('implements_' + this.id)` (`src/foam/lang/FObject.js:208`), and the result is memoized per class id. A class that does `implements: ['pkg.X']` directly, through `mixins:`, or by inheritance carries that axiom.

`isInstance(o)` is `!!( o && o.cls_ && this.isSubClass(o.cls_) )` (`FObject.js:199`) — the same check with an **object** operand. So use `isSubClass` when you hold a class (a DAO's or property's `of`, for instance) and `isInstance` when you hold an instance. A falsy argument returns false rather than throwing, so it is safe on a possibly-unset `of`.

**There is no MLang predicate for it.** `IsInstanceOf.f` does `of.isInstance(value)` (`src/foam/mlang/predicate/IsInstanceOf.js:46`) and `IsClassOf.f` does an exact class-id match (`IsClassOf.js:41`) — both test a *value's* runtime class, not a class-to-interface relationship. "Does model X implement interface Y" can only run in JS, never inside a DAO `where()`.

### `clone()` re-runs `init()`

JS `clone()` is `this.cls_.create(this, opt_X)` (`src/foam/lang/FObject.js:948`), so the clone goes through `create()` → `initArgs` → `init()`. Every `init()` side effect runs again: subscriptions, context lookups, UI writes, async default assignment.

For a service singleton whose `init()` touches shared state, a clone is destructive. If `init()` builds a UI element bound to `self` and asynchronously assigns a default from storage, each clone hijacks that shared element while other subscribers stay bound to the original, and the clone's async default races any override away.

Levers:

- **A context override needs data, not a live object.** `x.createSubContext({ someService: { id: 0 } })` and bind the callback to `{ __subContext__: subX }`. Plain objects are valid context exports, so readers doing `x.someService.id` work unchanged.
- If cloning an init-heavy class is unavoidable, audit its `init()` first for writes to imported or shared state.

Diagnostic: when two UI elements bound to "the same" service disagree, suspect an instance split. Log `this.$UID` at the writer and at every reader — differing UIDs prove a second live instance, and then you can find who created it.

### A modelled PropertyInfo serializes as its whole self, not as a reference

Both JSON outputters dispatch in this order: `OutputJSON` → `String` → `FObject` → `PropertyInfo` → `ClassInfo` (`src/foam/lib/json/Outputter.java:273-284`, mirrored in `JSONFObjectFormatter.java:336-347`).

A PropertyInfo that is a plain Java class falls through to the `PropertyInfo` branch and is emitted as a compact reference:

```json
{"class":"__Property__","forClass_":"<owning class id>","name":"<prop name>"}
```

A PropertyInfo declared as a `foam.CLASS` model is also an `FObject`, so it matches the **earlier** branch and goes out whole — class id plus every modelled property. If that class is `flags: 'java'`, the receiving client has no such class and cannot reconstruct the expression at all.

Where it bites: anything that echoes resolved property references back to the client, most importantly a `Projection` select, whose client-side row rebuild then fails silently. Symptom: a column renders blank while its value is present in the network response.

The fix is to implement `foam.lib.json.OutputJSON` on the modelled PropertyInfo — it is checked before both other branches — and emit the reference form yourself:

```java
public void outputJSON(foam.lib.json.Outputter outputter) {
  outputter.outputMap("class", "__Property__",
                      "forClass_", owner().getId(),
                      "name", getName());
}
```

`outputMap` and `outputRawString` are public on `Outputter`, and `append` is public on `AbstractFObjectFormatter`, so the `formatJSON` half can be written by hand.

Getting the owning class is the hard part. The reference needs `forClass_`; `AbstractPropertyInfo.setClassInfo` stores it (`src/foam/lang/AbstractPropertyInfo.java:31`) but `ProxyPropertyInfo.setClassInfo` discards it, and a modelled PropertyInfo's generated `getClassInfo()` returns its own class, not the owner. Store the owner in a **modelled property**, not a plain Java field: `fclone()` copies properties only, and sinks are cloned on the way back from a select, so a plain field arrives null and the outputter throws mid-response.

### Column auto-mapping is last-write-wins

`foam.core.reflow.ColumnParser.parseString` resolves a file header to a model property (`src/foam/core/reflow/ColumnParser.js:69-114`). For every property it writes into a case-insensitive `exactMap` keyed on the property's `name` (`:73`), `shortName` (`:82`) and each `alias` (`:91`), plus a camelCase-normalized `normalizedMap` guarded by a first-write-wins check (`:84-85`, `:93-94`). `parseString` then resolves a header by exact match first, falling back to normalized.

The trap: `exactMap` is **last-write-wins** — plain assignment with no guard — across the axiom iteration order. So an alias equal to an inherited framework property's name collides, and which property wins depends on iteration order. The framework property often does, and a string value then coerces into a numeric field and throws `Invalid number (NaN/Infinity) in field '<name>'`.

Present a header that exact-matches the intended property's own name, and never alias an upload field onto a name that collides with an inherited property such as `id`.
