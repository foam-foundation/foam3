# DAO Gotchas

Behaviour of the DAO stack that is not obvious from reading a model: which context an operation runs in, what a decorator wraps, when a result is frozen or cached, and how predicates and sinks actually evaluate.

Every claim here cites the code that proves it. Line numbers drift — anchor on the named method if a citation no longer lines up.

For the basics, start with [Dao.md](Dao.md), [EasyDao.md](EasyDao.md) and [MLang.md](MLang.md). This guide covers the traps that survive knowing the basics.

---

## Which context a DAO operation runs in

This is the highest-consequence section on the page. Getting it wrong produces data leaks across tenants that throw no error.

### A decorator's predicate filters by the context the DAO was built in

Two mechanics combine:

- An `imports:` getter returns `this.__context__[key]` (`src/foam/lang/ImportsExports.js:110`). It resolves live, but always from the object's own `__context__`, fixed at construction.
- DAO operations run with their own context. `AbstractDAO.removeAll()` is `removeAll_(this.__context__, ...)` (`src/foam/dao/AbstractDAO.js:444`); `select` and `find` do the same.

So a context a caller passes at query time does not reach the decorator's predicate. The only way to push an override down is `dao.inX(ctx)`, which wraps a `ProxyDAO` whose `__context__` is `ctx` (`AbstractDAO.js:85`).

A scoping decorator's `predicateIn(x)` must therefore read from the passed `x`, not from an imported instance. The Java `FilteredDAO.select_` does pass the call `x` down to `predicateIn(x)` (`src/foam/dao/FilteredDAO.js:67-68`), so `inX` works server-side.

**The server-side trap is not just an ignored override.** Business logic that fetches a scoped service DAO out of the context and queries it bare:

```java
((DAO) x.get("someDAO")).where(pred).select(sink);
```

runs the filter against the DAO's **boot** context. If the scoping value is absent there, a well-written `predicateIn` returns `TRUE` and the select quietly scans everything the DAO holds, returning rows the caller was never entitled to. It fails open, silently, and only under a context the developer never tested. Scope it explicitly with `dao.inX(subContext)`, taking the scoping value from the entity in hand rather than from ambient state.

### Argless convenience methods re-enter with the DAO's own context

Java `find(id)` ends in `this.find_(this.getX(), id)` (`src/foam/dao/AbstractDAO.js:514`), and `select(sink)` in `select_(this.getX(), sink, ...)` (`:484`).

For a service DAO built at boot, `getX()` is the system context. So a decorator that calls `getDelegate().find(oid)` runs the entire delegate stack — authorization, lifecycle filtering, PM — as system: permission checks pass unconditionally, deleted-row filtering is skipped, and PM attribution is wrong. The bug is invisible while the caller happens to hold the same permissions, and becomes a live bypass the moment they diverge.

Inside a decorator, always call `find_(x, id)`, `select_(x, ...)`, `put_(x, obj)` with the request `x`. Reserve the bare forms for code where the DAO's own context is the right one.

### Arity-1 `select(sink)` silently drops every query argument

It resolves to `select_(x, sink, undefined, undefined, undefined, undefined)` (`AbstractDAO.js:478`). A `select_` override that ends with `getDelegate().select(proxySink)` therefore ignores the predicate, skip, limit and order the framework handed it. Symptom: every search returns all rows.

### An object loaded from a DAO carries a serviceless context

`MDAO` returns the stored object as-is (`src/foam/dao/MDAO.java:164`), so its `getX()` is whatever context it was deserialized with — not the caller's, and not changed by the `x` passed to `find` or `select`. `getX().get("someService")` returns null.

Two ways out:

- **The method takes, or can take, an `x`** — thread the caller's context. This is the dominant idiom; `Credential.getPasswordSecret(x)` (`src/foam/core/auth/Credential.js:98`) is typical. Fetch through `dao.inX(x)` and pass the same `x` in.
- **No `x` argument and `getX()` is unreliable** (getters, factories, `javaPostSet`, a predicate's `f()`) — `foam.lang.XLocator.get()`, documented as the "last-resort method of locating thread-local session context" (`src/foam/lang/XLocator.java:9`). The hybrid form `getX() != null ? getX() : XLocator.get()` appears in `src/foam/core/logger/StdoutLogger.js:27`.

Re-homing the object is not a shortcut. Generated `setX` is literally `x_ = x;` (`src/foam/java/refinements.js:689`) and does not cascade into nested `FObjectProperty` values, and `ContextualizingDAO` re-homes only the top object, only on `find_` and `put_` (not `select_`), and is opt-in through `EasyDAO`'s `contextualize` flag.

---

## Decorator stacking

### A later wrap is the outer decorator

`EasyDAO` builds its delegate chain inner to outer in code order. `getOuterDAO` runs first (`src/foam/dao/EasyDAO.js:248`), `.setDecorator()` applies next (`:250-260`), and a `RulerDAO` wraps it at `:294`. RulerDAO wraps later, so it is **outer** to whatever `.setDecorator()` installed.

Consequence: a `put()` reaches RulerDAO and evaluates rules **before** any `.setDecorator()` decorator's `put_`. If a decorator needs to set a field the rule engine reads, `.setDecorator()` cannot do it — the value has to be stamped upstream of the served DAO.

### `*Aware` decorators wire implicitly from the model's `implements:` list

`enableInterfaceDecorators` defaults to true (`EasyDAO.js:837`), and each decorator flag has a factory of the form:

```javascript
return getEnableInterfaceDecorators() && getOf().isAssignableTo(foam.core.auth.LifecycleAware.class);
```

(`lifecycleAware` at `EasyDAO.js:854`, with `createdAware`, `lastModifiedAware` and `serviceProviderAware` declared alongside it). When true, `build` wraps the decorator automatically — `LifecycleAwareDAO` at `EasyDAO.js:346-347`.

So when auditing a DAO's service definition, never conclude "no `setLifecycleAware(true)` means hard delete" from the builder script alone. Check the `of` model's `implements:` list: `foam.core.auth.User` implements `LifecycleAware` (`src/foam/core/auth/User.js:12-20`), so any plain `EasyDAO` over `User` soft-deletes — `LifecycleAwareDAO.remove_` marks the object `DELETED` and puts it instead of removing it (`src/foam/core/auth/LifecycleAwareDAO.js:142`).

The same reasoning applies to any application-level `*Aware` decorator wired through the same mechanism. Two corollaries:

- `setEnableInterfaceDecorators(false)` kills all implicit decorators at once; an explicit flag forces just one on a model that does not implement the interface.
- Disabling one decorator does not disable another. `setAuthorize(false)` turns off authorization and nothing else — a scoping decorator wired from the interface list still filters every select.
- Because the `instanceof` check in `remove_` runs on the **object**, an adapter that puts a `User` through still soft-deletes even when the outer DAO's `of` is a facade model that does not implement the interface.

### A `FilteredDAO` subclass built in code needs `of` passed

A filter predicate computed from the model's properties — `this.EQ(this.of.SOME_PROP, value)` — throws `Cannot read properties of null` when `of` is null. A JSON spec happens to work because the parsed graph carries `of` down to the delegate, which masks the requirement until the wrapper is constructed programmatically:

```javascript
this.MyFilteredDAO.create({ of: this.of, delegate: delegate }, this.__subContext__);
```

If the predicate short-circuits to `TRUE` while its scoping value is unset, the crash only appears once a real value is selected.

### A method with only `javaCode` has no JS implementation

`javaCode` generates Java only, `code` generates JS only. Calling a `javaCode`-only method from JS throws `this.<name> is not a function`.

That matters for base "hook" methods meant to be overridden. A hook needs a JS `code` body — even a no-op — or no JS caller can invoke it and no JS refinement can override it:

```javascript
{ name: 'getOuterDAO',
  args: [ { type: 'foam.dao.DAO', name: 'innerDAO' } ],
  code: function(innerDAO) { return innerDAO; },   // makes it JS-callable and overridable
  javaCode: `return innerDAO;` }
```

`EasyDAO.getOuterDAO` (`EasyDAO.js:1058`) carries exactly this pair for that reason.

---

## Results: frozen, cached, refreshed

### `put()` and `find()` return frozen objects

Any setter on the returned instance throws `RuntimeException: Object is frozen.` Clone before mutating:

```java
SomeModel persisted = (SomeModel) dao.put(obj);
SomeModel next = (SomeModel) persisted.fclone();
next.setStatus(NEXT_STATE);
dao.put(next);
```

This bites hardest when driving a multi-step lifecycle through a real DAO in a test. The freeze is deliberate: DAOs avoid sharing mutable references between writers and readers.

### Client caching is decided by ClientBuilder, and only for a top-level `EasyDAO`

When a client spec's top-level class is `foam.dao.EasyDAO` (or is absent, defaulting to it), the per-client property factory injects `cache: true`, `ttlSelectPurgeTime` and `ttlPurgeTime` from `CACHE_TIMEOUT`, and `daoType: CLIENT` (`src/foam/core/client/ClientBuilder.js:209-213`, constant at `:32`).

A **decorator-wrapped** spec — `{class: SomeDecorator, delegate: {class: foam.dao.EasyDAO, ...}}` — has a top-level class that is not `EasyDAO`, so the nested EasyDAO gets only what its own JSON declares.

That distinction decides whether you get a bounded cache or a full table load, because:

### `cache: true` with no TTL is a full eager warm

`EasyDAO`'s JS `delegateFactory` (`EasyDAO.js:1126-1160`) branches on the TTL values. With both at or below zero it builds a `CachingDAO`, whose first read runs an **unfiltered** `src.select()` and pulls the entire table into an MDAO (`src/foam/dao/CachingDAO.js:80-86`). With `ttlSelectPurgeTime > 0` it builds a `TTLSelectCachingDAO` instead — a per-query cache keyed on `[sink, skip, limit, order, predicate]`, no full warm.

On a large table the difference is hundreds of megabytes pulled to the client on the first read. Levers: keep the spec a plain top-level `EasyDAO` so the TTL injection applies, set an explicit `ttlSelectPurgeTime`, or drop `cache: true` so aggregation sinks (`SUM`, `COUNT`, `GROUP_BY`) reduce server-side instead.

### Refreshing a view: pick by how stale the data is

| Call | What it does | Use when |
|---|---|---|
| `dao.on.reset.pub()` | Fires reset at this level only; subscribers re-select from what the chain already holds | The in-memory data is already correct |
| `dao.cmd(DAO.RESET_CMD)` | Travels down to the client DAO, which re-publishes reset so it bubbles up to every listener (`src/foam/dao/RequestResponseClientDAO.js:121`) | Re-reading the client cache is enough |
| `dao.cmd(DAO.PURGE_CMD)` | `CachingDAO.cmd_:143` → `onSrcReset:177` — clears the cache and re-fetches from the server | Server data changed elsewhere |

The trap: an `EasyDAO` with `cache: true` reads from memory, so RESET re-reads the **stale cache** and the view shows nothing changed. A cached client DAO needs PURGE. Constants live at `src/foam/dao/DAO.js:28,39`. Use the public `cmd` (it supplies the context), not `cmd_`.

Publish on the exact instance the view holds. A `where()` or `inX()` wrapper relays events from its base, so acting on the base reaches it — a *different* instance does not, which is the classic "I published and nothing refreshed" bug.

Event mechanics worth knowing: leaf DAOs publish `put` and `remove` after the write (`src/foam/dao/MDAO.js:155,191`), and `removeAll` emits one `remove` **per row** (`MDAO.removeAll_:205`) rather than a single reset. Decorators forward through the ProxyDAO `topics:['on']` proxy (`src/foam/dao/ProxyDAO.js:25`). JS uses the topic bus while Java uses a `listeners_` list (`AbstractDAO.js:691-728`), so `this.on.sub(...)` is client-side only. `dao.listen(sink)` returns a detachable subscription (`AbstractDAO.js:241`), but the public `pipe` discards what `pipe_` returns (`AbstractDAO.js:200`) — so `this.onDetach(dao.pipe(sink))` detaches nothing.

Constants and both cache paths are worth reading directly: `src/foam/dao/DAO.js`, `src/foam/dao/CachingDAO.js`, `src/foam/dao/TTLSelectCachingDAO.js`.

---

## Predicates, sinks and indexing

### A transient getter property is queryable, as a full scan

An MLang predicate referencing the property calls `Property.f(o)`, which is `return o ? o[name] : null` (`src/foam/lang/Property.js:256`) and so invokes the getter. The MDAO scan evaluates the predicate per row (`src/foam/dao/index/ValueIndex.js:72`).

So `where(EQ(...))` and `orderBy` work on a computed property with no stored column — as an O(n) scan. You do not need to persist a field to filter or sort on it; storing and indexing buys index-accelerated speed on hot paths, not correctness.

### Adding an index, and leading it correctly

```java
new foam.dao.EasyDAO.Builder(x)
  ...
  .build()
  .addPropertyIndex(new foam.lang.PropertyInfo[] { Model.TENANT_ID, Model.CREATED });
```

A multi-element array is a **compound** index with `props[0]` outermost, built as a nested range-capable `TreeIndex` (`src/foam/dao/MDAO.java:145-148`), so it serves `Gt`/`Gte`/`Lt` as well as `Eq`. `EasyDAO.addPropertyIndex` sends an `AddIndexCommand` down the delegate chain (`EasyDAO.js:1325-1346`); the MDAO handles it and returns true (`MDAO.java:297`), otherwise it logs `Index not added, no access to MDAO`. Decorators are transparent to it.

**Lead a compound index with the most selective term.** A query shaped `Eq(scopeId) AND Gt(date)` wants `(scopeId, date)` so the scan seeks the scope bucket first and then ranges the date. A date-only index cannot prune by scope.

**"Unindexed search on MDAO" does not prove the index is missing.** That warning fires when `plan.cost() > 10 && plan.cost() >= index_.size(state)` (`MDAO.java:247-256`), and the cost equals the table size whenever a predicate matches essentially every row — a `> date` filter where every row is newer, for instance — even with a correct index attached. An index cannot prune a query that returns everything. Check predicate selectivity against the data before concluding anything about the index.

### `MDAO.bulkLoad(dao)` reads the sink you passed in

The JS implementation is `var sink = this.ArraySink.create(); dao.select(sink).then(() => this.index.bulkLoad(sink.array))` (`src/foam/dao/MDAO.js:137-142`), which assumes `select` mutates the sink it was handed. A decorated or proxy DAO resolves `select` with a **fresh** sink, so the passed one stays empty and the index loads zero rows — silently, with no exception. Loading from another plain MDAO works, which is what makes the bug look intermittent.

Use the resolved sink instead:

```javascript
var rows = (await dao.select()).array;
mdao.index.bulkLoad(rows);
```

### A `select_` that hydrates rows must filter on the sink

When `select_` transforms each row before returning it — a facade DAO filling `storageTransient` fields by copying from another DAO, say — the query arguments have to be applied **after** the transform. `storageTransient` fields are not journaled (`src/foam/lang/JSON.js:753`), so the stored row has them empty and pushing the predicate down to the delegate filters the un-hydrated row: transient columns match nothing.

`decorateSink_(sink, skip, limit, order, predicate)` builds the `LimitedSink → SkipSink → OrderedSink → PredicatedSink` chain, wrapping only the arguments that are set (`src/foam/dao/AbstractDAO.js:367-398`). Feed hydrated rows into that and the predicate evaluates the filled values.

Note this compounds with the arity-1 trap above: an override ending in `getDelegate().select(proxySink)` both drops the args and filters the wrong object.

### `LimitedSink` under `GROUP_BY` truncates the whole scan

`LimitedSink.put` calls `sub.detach()` the moment `count >= limit` (`src/foam/dao/LimitedSink.js:27-29`, same in `javaCode`) — it detaches the subscription it was handed, not just its own accumulation. `GroupBy.putInGroup_` passes the **outer select's** `sub` into every cloned per-group sink: `group.put(obj, sub)` (`src/foam/mlang/sink/GroupBy.js:126`).

So `GROUP_BY(keyProp, LimitedSink({limit: 1}), groupLimit)` is broken: the first group to fill kills the entire scan, and later records and groups never arrive. The result is silently **wrong**, not merely short.

For "one row per distinct key, capped list", use a single sink over the whole stream:

```javascript
UNIQUE(keyProp, LimitedSink({ limit: N, delegate: projection }))
```

`Expressions.UNIQUE(expr, sink)` is `Unique.create({expr, delegate: sink})` (`src/foam/mlang/Expressions.js:137`). One sink dedupes by `expr` and the single `LimitedSink`'s detach at N is the intended global cap. Unwrap rows through `result.delegate.delegate.projectionWithClass`.

Do not "fix" `LimitedSink` globally — detach-on-limit is exactly how top-level `.limit()` and `GroupBy`'s own `groupLimit` terminate early (`GroupBy.js:162`). The defect is only in nesting a limited sink under `GroupBy`, where the shared subscription is not the sink's to detach.

### JS `IN` matches by stringified value, and both sides must stay stringified

`In.f` has a fast path when `arg2` is a constant array: it builds a `Set` from the values and tests membership (`src/foam/mlang/predicate/In.js:58-72`).

A JS `Set` matches objects by **reference**, so a naive `new Set(rhs).has(lhs)` never matches an `IN` over `Date` or `FObject` values — two `Date` instances at the same instant are different references, and the correct `foam.util.equals` loop below the fast path (`:74-80`) never runs because the Set path returns first. The current implementation avoids that by stringifying **both** the set members and the lookup key (`v + ''`), which turns membership back into a value comparison.

Two things follow. Do not drop either `+ ''`: a raw set with a stringified key, or the reverse, silently returns false for everything. And be careful with `IN` over composite values — every `FObject` stringifies to `"[object Object]"`, so distinct objects collide. The Java path uses `HashSet` plus `Date.equals`, which is value-based, and needs none of this.

### MLang `LTE` treats an unset Date as less than anything

A record whose date property was never set satisfies `LTE(prop, now)`. Any deadline, expiry or retry sweep written as `dao.where(LTE(prop, now))` therefore also selects records that were never scheduled and runs the expiry handler on them — instant terminal transitions on records nobody ever started.

Guard the sweep:

```java
MLang.AND(MLang.HAS(prop), MLang.LTE(prop, new Date()))
```

`HAS` filters unset values (`src/foam/mlang/MLang.java:232`). This is reachable in production whenever the code that stamps the deadline is tolerant of missing configuration and skips stamping — the tolerant skip plus the unguarded sweep combine into immediate expiry.

### `foam.mlang.If` is an Expr, not a Predicate

`If` extends `AbstractExpr` (`src/foam/mlang/If.js:9`) and its `f()` returns `trueExpr.f(obj)` or `falseExpr.f(obj)` — a **value**. It does not gate a query, and there is no `foam.mlang.predicate.If`; writing that class string asserts at journal replay.

Express "if A then B else true" as its predicate equivalent:

```
OR( NOT(A), B )
```

Two companion mistakes appear in the same hand-written journal predicates:

- The boolean constants are `foam.mlang.predicate.True` and `False` (`src/foam/mlang/predicate/True.js:9`). There is no `foam.mlang.expression.*` package.
- `Has.arg1` must be a property expression — its factory is `PropertyExpr` (`src/foam/mlang/predicate/Has.js:20`). A dotted class-name **string** has no `.f()` and crashes at select. Write `{ "class": "__Property__", "forClass_": "pkg.Model", "name": "someProp" }`, or `Model.SOME_PROP` in JS.

### A predicate's `obj` decides what it can read

The same predicate class behaves differently depending on what it is applied to:

- A **menu option** predicate is evaluated as `predicate.f(X)`, so `obj` is the **context** and `ContextObject` resolves: `ContextObject.f` returns `((X) obj).get(key)` (`src/foam/mlang/ContextObject.js:69`).
- A **`DAOControllerConfig.predicate`** is applied through `dao.where(predicate)` (`src/foam/comics/v2/DAOControllerConfig.js:88-89`), so `f` runs **per record** and `obj` is a row. `ContextObject.f(record)` reads nothing useful.

So a static journal cannot express "filter these config records by a context value". To scope one, subclass `DAOControllerConfig` and make `predicate` a **reactive expression** over the context value, deep-watching the field that changes so it re-fires:

```javascript
{ name: 'predicate',
  expression: function(someContextObject$id) {
    var P = this.SomeModel.SCOPE_ID;
    if ( ! someContextObject$id ) return this.TRUE;
    return this.OR(this.NOT(this.HAS(P)), this.EQ(P, someContextObject$id));
  } }
```

The inherited `dao` expression depends on `predicate`, so it rebuilds the `where()` on every change. `HAS(P).f(record)` reads the property per row, so record types that do not define it fall through the pass-through arm — which a strict `EQ` scoping decorator cannot do, since it hides rows whose scope field is unset.

---

## Rules fire on put

**Any `dao.put` in server code, including from a script or a cron, runs that DAO's `RulerDAO` rules for the put's operation.** A record you clone and re-put can have its fields rewritten before it lands.

**Journal replay writes below the decorator chain.** `JDAO` replays into its own **delegate** (`src/foam/dao/JDAO.js:31`), and the journal calls `dao.put_(x, obj)` on that delegate (`src/foam/dao/AbstractF3FileJournal.js:300`). Anything wrapped above the JDAO — a `RulerDAO` included — never sees a replayed entry. So a seed record keeps the values written in the file even where the same value written through the served DAO would be rewritten by a CREATE rule. When you need values to stick exactly as authored, prefer a static seed journal over a runtime clone-and-put script.

**Operation semantics.** `foam.core.dao.Operation` is `CREATE`, `UPDATE`, or `CREATE_OR_UPDATE`. A `CREATE` rule fires only on a create — a new or non-existent id — and not on a re-put of an existing id.

Two levers when a rule keeps overwriting a value you need:

- **Two-put.** Put the record (the CREATE rule clobbers the field), then re-put the same id. The CREATE rule cannot fire on the update, so the second write sticks. Capture the returned object to get the sequence-assigned id.
- **Neutralize the rule.** Change `CREATE_OR_UPDATE` to `CREATE`, or set `enabled = false`, in the rule DAO for the duration and restore in a `finally`. `RulerDAO` live-refreshes its cached rule lists through a rule-DAO listener (`src/foam/core/ruler/RulerDAO.js:250`, `UpdateRulesListSink` → `updateRules`), so the change takes effect for subsequent puts.

And when auditing what a deployment actually does: **the runtime rule set can differ from the journals in the repository.** Read the live rule DAO, not the checked-in files.

### `where(pred).removeAll()` is a targeted delete

`FilteredDAO.removeAll_` forwards to the delegate with `predicate == null ? predicateIn(x) : AND(predicateIn(x), predicate)` (`src/foam/dao/FilteredDAO.js:92`). A bare `removeAll()` passes null, so the delete runs with the `where` predicate and clears only the matching subset.

When reviewing a destructive script, `where(...).removeAll()` is scoped; a bare `dao.removeAll()` is the full wipe to worry about.

---

## Enumeration, export, diagnostics

### Enumerating DAOs through `cSpecDAO`

All `foam.core.boot.CSpec` records live in `cSpecDAO`, and the built-in `DAOS` canned query filters them with `ENDS_WITH(CSpec.NAME, 'DAO')` (`src/foam/core/boot/CSpec.js:63`; `SERVED_DAOS` adds `EQ(SERVE, true)` at `:73`).

The trap: **a CSpec record carries no built service in the common case.** The `service` property (`CSpec.js:184`) is null whenever the DAO comes from a `serviceScript`, which is how most application DAOs are defined — `createService` (`:299`) runs the script at boot and registers the result in the context, and the live DAO is reached through `this.__context__[this.name]` (`:488`). There is no forward reference from the CSpec to the built DAO.

So no pure-MLang predicate can test a trait of the **built** DAO (its `of`, its decorators). Narrow with MLang, then resolve and test in JS:

```javascript
var E = foam.mlang.Expressions.create(), CS = foam.core.boot.CSpec;
(await x.cSpecDAO.where(E.ENDS_WITH(CS.NAME, 'DAO')).select()).array
  .map(cs => cs.name)
  .filter(n => { var d = x[n]; return d && d.of && SomeInterface.isSubClass(d.of); });
```

To make it look like pure MLang for a canned query or a `RichChoiceView`, either add a `storageTransient` computed getter on CSpec that resolves `this.__context__[this.name]` and test that with a full scan, or run the JS filter and feed the matches into an in-memory MDAO used as the dropdown's DAO.

### Exporting a DAO as a journal

Two paths, and `DownloadDAOAgent` picks between them by asking `dao.cmd('serviceName?')` (`src/foam/core/reflow/AbstractDAOAgent.js:1250`, probing at `:1110`):

1. **DIG, for server-registered DAOs** — `GET /service/dig?dao=<serviceName>&format=jsonj&sessionId=<id>` (parameters at `src/foam/core/dig/DigWebAgent.java:32-34`, JSONJ output at `DigUtil.java:130`). Serialization happens server-side, so the browser never materializes the objects; safe for very large tables. **Page size defaults to 1000 and a `limit` parameter can only lower it** (`src/foam/core/dig/drivers/DigFormatDriver.js:41,199-213`) — `limit=1000000` is silently ignored and you still get 1000 rows. `limit=0` means all but requires the `service.dig.read-all-records` permission; without it, paginate with `skip`.
2. **Client export drivers, for anything local** — `foam.core.export.JSONJDriver.exportDAO(x, dao)` selects everything into the browser and stringifies. This is the only option for an in-memory MDAO that DIG cannot see, and it is memory-bound.

`DownloadDAOAgent` also shows a useful trick: a fake `ArraySink` whose `setPredicate` throws captures the DAO's active filter, which is then appended to the DIG URL as `&q=` plus `p.toMQL()` (`:1154`), so an export honours the current view filter.

### A client `select()` aborts on an enum the loaded build does not define

`Attempt to set invalid Enum value` is thrown from the enum adapt when a stored row carries a value the browser's JS does not define — an older or newer deployment, or a value added server-side but not yet in the served bundle. The whole select fails, not just the offending row.

Read such a DAO with a **server-side projection**, which returns scalar arrays and never constructs the object on the client:

```javascript
var E = foam.mlang.Expressions.create();
var res = await dao.where(E.INSTANCE_OF(SomeClass))
                   .select(E.PROJECTION(Model.ID, Model.SOME_STRING));
var rows = res.projection || res.array || [];
```

`INSTANCE_OF` also splits a polymorphic DAO — one `setOf(AbstractThing)` journal holding several concrete subclasses — by type without materializing each. `PROJECTION` is at `src/foam/mlang/Expressions.js:155`.

### A `FileArray` strips content from the embedded copy

`FileArrayDAODecorator` stores each file in the file DAO and then blanks the content on the copy embedded in the owning record: `f2.dataString = undefined; f2.data = undefined` (`src/foam/core/fs/FileArrayDAODecorator.js:73-76`). The embedded copy keeps only metadata.

Where the bytes actually live depends on size. `maxStringDataSize` defaults to 3 KB (`:27`):

- **Larger than 3 KB** — content goes to the blob store and the `digest` on the embedded copy still resolves it, so a careless write-back survives.
- **3 KB or smaller** — content lives only in the file DAO row's `dataString`, and nothing on the embedded copy can reconstruct it.

So taking a file out of the record, cloning it, setting a field, and putting it back overwrites the stored row with a content-less copy. `FileDataDAO.put_` with neither `dataString` nor a blob falls straight through to the delegate (`src/foam/core/fs/FileDataDAO.js:82-88`) — no error, no warning. Small files are destroyed while large ones look fine, so the bug hides until someone attaches a short text file.

When you must write back, re-read the stored row and restore its content onto the clone first:

```java
if ( SafetyUtil.isEmpty(clone.getDataString()) && clone.getData() == null ) {
  Object existing = fileDAO.find(doc.getId());
  if ( existing instanceof foam.core.fs.File stored ) {
    if ( ! SafetyUtil.isEmpty(stored.getDataString()) ) clone.setDataString(stored.getDataString());
    else if ( stored.getData() != null )                clone.setData(stored.getData());
  }
}
```

The same applies to any sender that needs the bytes: resolve the content through the file DAO rather than trusting the embedded copy.
