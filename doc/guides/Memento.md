<flow name="Memento" category="DOC/GUIDE" spid="foam"/>

# Memento & Routing

How FOAM syncs UI state (current menu, route, filters, tab selection, ...) into the browser URL hash, so it survives refresh and is bookmarkable/back-forward navigable. Two pieces: `foam.u2.memento.Memento` (the encode/decode engine) and `foam.u2.Router` (a controller mixin built on top of it for route-driven view switching).

---

## Mental model

A `Memento` is a node in a chain, one per level of UI that wants to contribute state to the URL. Each node:

- owns a set of `memorable: true` properties on some `obj`
- encodes those properties into a segment of the hash string
- hands the leftover (unconsumed) portion of the string to a child `Memento` — its `tail`

The doc comment on the class (`src/foam/u2/memento/Memento.js`) states the whole contract:

> A hierarchical implementation of the Memento pattern. Used to encode UI states/routes in a string form that can be stored and later reverted to. [...] Memorable properties are automatically encoded-into / extracted-from the string form of the memento and a sub-Memento, with the used bindings removed, is exported for children to consume.

So a page with a top-level menu selector, and a sub-view with its own tab state, produces one hash string that both levels contribute to and both levels parse independently — neither needs to know about the other's keys.

---

## String format

```
#path1/path2/...pathn?key1=value1&key2=value2...&keyn=valuen
```

which the doc comment calls shorthand for:

```
#route=path1&route=path2&route=path3&key1=value1&key2=value2...&keyn=valuen
```

Two things follow directly from that:

- **Duplicate keys are legal.** More than one `key=value` pair can share a key; bindings are assigned top-down (parent Memento's binding wins over a tail's, since the parent processes its own keys first — see [Decoding](#decoding-the-str-setter)).
- **`route` is not an ordinary key.** It's the mechanism for the path segments.

### The `route` special case

If a property is named (or `shortName`'d) `route`, it is encoded as part of the memento's **path**, not as a `key=value` parameter:

> If a Property is named 'route', it will be encoded as part of the memento path, rather than as a keyed parameter.

Concretely: a memorable `route` property produces `#myroute` instead of `#?route=myroute`, and a chain of nested routers produces `#admin.users/42` instead of `#?route=admin.users&route=42`. Every other memorable property is otherwise handled identically to a `route` property — two-way bound, chained via parent/tail, decoded from the hash — the only difference is where it lands in the string.

---

## Encoding — `encode()` / `toString()`

`encode(opt_untilObj)` walks this Memento's `tail` first (recursively), then layers this level's own `memorable` properties on top:

```javascript
this.props.forEach(p => {
  var val = this.obj[p.name] === undefined ? '' : this.obj[p.name];

  if ( p.name === 'route' || p.shortName === 'route' ) {
    if ( ret.route ) ret.route = '/' + ret.route;
    ret.route = encodeURIComponent(val) + ret.route;
  } else {
    // ...ordinary key=value param, only emitted if non-default
    // or if a descendant already bound the same name (ret.bound[name])
  }
});
```

A non-`route` property is only written into `params` if it's non-default, **or** if a descendant Memento already bound the same name — the `bound` map exists specifically to avoid ambiguity about which level a binding belongs to when defaults would otherwise hide it.

`toString(encoded)` then just concatenates: `route` + (`?` + `params` if any).

`encode()` is also where `usedStr` (and the child's `tailStr`) get (re)computed as a side effect, when called with no `opt_untilObj`.

---

## Decoding — the `str` setter

Setting `str` is how a Memento is fed a hash string (from the browser, or from a parent's leftover `tailStr`). The `postSet`:

1. **`addRouteKeys(s)`** first splits the path portion (before `?`) on `/` and rewrites each segment back into a synthetic `route=segment` binding, so the rest of the pipeline only ever deals with ordinary `key=value` pairs.
2. **`createBindings(s)`** splits the remaining string on `&` (careful not to split inside `{...}`, reserved for nested mementos) into `[key, value]` pairs.
3. For each of `this.props` (this level's `memorable` properties), the matching binding is consumed out of the array and assigned onto `this.obj[p.name]`, decoded via the property's own `fromString` if it has one. Even an absent binding is "set" — to revert the property to its default.
4. Whatever bindings are left over (not owned by this level) are re-encoded and stored in `tailStr`, which a `tail` Memento (if attached) consumes via its own `str` setter.

Because path segments become `route=` bindings before the generic parser runs, `route` really is handled identically to any other memorable property from that point on — matched by key, decoded, assigned — the special-casing is entirely in `addRouteKeys()` on the way in and the `ret.route` branch of `encode()` on the way out.

---

## Making an object memorable

Two pieces:

- **`MemorablePropertyRefinement`** adds a `memorable: Boolean` axiom to every `foam.lang.Property`, defaulting to `false`. Set `memorable: true` on any property you want synced to/from the URL.
- **The `Memorable` mixin** gives a class a `memento_` property (`hidden`, `transient`, lazily created via `factory`):

```javascript
factory: function() {
  return this.parentMemento_ ?
    this.Memento.create({obj: this, parent: this.parentMemento_}, this) :
    this.WindowHashMemento.create({obj: this}, this);
}
```

It imports an optional `memento_` from its own parent context (aliased `parentMemento_`) and exports its own `memento_` back down, which is how the parent/tail chain wires itself up automatically through ordinary FOAM context nesting — no manual `parent:` assignment needed by application code. If there's no parent Memento in context, it becomes the root and creates a `WindowHashMemento` instead of a plain `Memento`.

```javascript
mixins: [ 'foam.u2.memento.Memorable' ],
properties: [
  { name: 'myState', memorable: true }
]
```

is the complete recipe (also stated directly in the class doc comment).

---

## `WindowHashMemento` — binding to the browser

`foam.u2.memento.WindowHashMemento extends Memento` and is the concrete class that should sit at the root of the chain — `Memorable`'s factory picks it automatically when there's no parent.

- `onHashChange` reads `window.location.hash` into `this.str` whenever the browser hash changes (back/forward, manual edit, `window.onpopstate`).
- `onMementoChange` writes `this.usedStr` back out to `window.location.hash` whenever the memento's used bindings change — via `pushState` if the *route* portion changed (a real navigation), or `replaceState` if only params changed (avoids polluting browser history for e.g. a tab switch).
- A `hashFeedback_` guard on both listeners prevents the obvious infinite loop.

Application code essentially never talks to `WindowHashMemento` directly — it's created implicitly by the top-level `Memorable` (typically `ApplicationController`, see below) and everything downstream chains off it through context.

---

## `foam.u2.Router` — routing on top of Memento

`foam.u2.Router` (`src/foam/u2/Router.js`) is a `Controller` mixin that bundles `Memorable` with breadcrumb and stack coordination, for the common case of "one memorable `route` property switches between sub-views":

```javascript
foam.CLASS({
  package: 'foam.u2',
  name: 'Router',
  extends: 'foam.u2.Controller',
  implements: [ 'foam.u2.Routable' ],
  mixins: [ 'foam.u2.memento.Memorable' ],
  exports: [ 'route' ],
  properties: [
    { name: 'route', memorable: true, transient: true },
    { name: 'routingFeedback_', value: false, transient: true }
  ],
  ...
});
```

- `addCrumb()` — pushes `this` onto an imported `breadcrumbs` stack and reactively calls `routeChange()` whenever `route` changes; call it (usually from `init()`) to opt a controller into the breadcrumb system.
- `routeChange()` — when `route` becomes falsy, tells the breadcrumb system to navigate ("go") to whatever crumb is currently registered for this controller.
- `routeToMe()` — clears `route` (self-navigates back to this controller's own default state).
- `routingFeedback_` guards both against re-entrant loops the same way `WindowHashMemento.hashFeedback_` does.

`route` is exported (`exports: [ 'route' ]`), so a controller mixing in `Router` publishes its own current route to children via context — that's how a child view can read (or memorable-bind) the route its containing router set.

### A second, simpler `Router` definition exists

`src/foam/u2/Element2.js` defines a *second* `foam.CLASS` for `foam.u2.Router` — same package, same name, but a bare `mixins: [ 'foam.u2.memento.Memorable' ]` plus a plain memorable `route` property, without `addCrumb`/`routeChange`/`routingFeedback_`:

```javascript
foam.CLASS({
  package: 'foam.u2',
  name: 'Router',
  extends: 'foam.u2.Controller',
  mixins: [ 'foam.u2.memento.Memorable' ],
  exports: [ 'route' ],
  properties: [ { name: 'route', memorable: true } ]
});
```

`src/pom.js` loads `foam/u2/Element2` before `foam/u2/Router`, so the fuller `Router.js` definition is the one registered last for the `foam.u2.Router` name **(unverified: FOAM's exact last-registration-wins semantics for a repeated `foam.CLASS` call were not traced further here — treat this as the likely-effective definition, not a proven one)**. If breadcrumb/stack behaviour you expect from `Router.js` seems to be missing, this duplicate definition is the first place to look.

---

## Real-world usage

- **`ApplicationController`** sits at the root: mixes in `foam.u2.memento.Memorable`, exports its own `memento_` down the context as `topMemento_`, and has its own memorable `route` property that drives `pushMenu`/`currentMenu`. Navigation helpers like `routeTo(link)` write straight to `window.location.hash`, which flows back in through `WindowHashMemento.onHashChange` rather than through the `Memento` API directly.

- **`foam.comics.v3.DAOController`** mixes in `foam.u2.Router` and declares its own memorable `route`, using it as a three-state switch (browse / create / detail) — documented in full in [Comics.md](Comics.md#the-state-machine):

  | `route` value | Micro-controller rendered |
  |---|---|
  | `''` (empty) | `DAOView` — browse/list |
  | `'create'` | `CreateView` — new object form |
  | Any record ID | `DetailView` — view/edit of that record |

- **`foam.comics.v3.CreateView`** and **`foam.core.doc.DocumentationView`** both mix in `foam.u2.Router` for their own sub-navigation.

- **`foam.comics.v2.DAOUpdateView`** mixes in `foam.u2.memento.Memorable` directly (no `Router`) — a class that wants URL-synced state but not the breadcrumb/stack machinery should follow this pattern rather than pulling in `Router`.

---

## Gotchas

- **`route` collapses to a path segment, not a param.** If you're debugging a hash that looks wrong, remember `#a/b?x=1` decodes as if it were `#?route=a&route=b&x=1` — a stray `route=` binding you see in a decoded-bindings log is expected, not a bug.
- **Setting `route` doesn't immediately detach the previous tail.** The line that would drop a stale tail on route change is commented out (`this.detachTail()` is dead code inside a still-live `if` in the `str` setter) — stale child bindings can persist in `tailStr` across a route change until something else (`removeMementoTail`) clears `tail`. Don't assume changing `route` alone guarantees old child-view params vanish from the hash.
- **`this.detachTail()` and `removeMementoTail` exist but aren't obviously wired to route changes** — if a child view's state is leaking into a hash after navigating away from it, this is the mechanism to trace.
- **Duplicate `foam.u2.Router` class definition** — see [above](#a-second-simpler-router-definition-exists). Behaviour differences between the two are a real trap if you're not aware both exist.
- **`update_` is merged with a 32ms delay**, so `usedStr`/hash writes are batched — don't expect the hash to update synchronously in the same tick as a memorable property change.

---

## See Also

- [ApplicationController.md](ApplicationController.md) — the top-level controller that owns the root `Memento`.
- [Comics.md](Comics.md) — `DAOController`'s `route`-driven state machine, the most fully-worked real example of `Router` in the codebase.
