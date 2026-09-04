# Context and DAO

Context is never implicit. The one "major security hole" in the review corpus was a DAO run in the
system context; every other rule here is the same instinct at smaller scale.

| Principle | One-line test |
|---|---|
| Take `x` from the argument and pass it down | does any method reach for `getX()` when an `x` was handed in? |
| Inside a decorator, call the `_` methods with `x` | any bare `find(`/`put(`/`select(` on `getDelegate()`? |
| Inside a rule, `x` reads, `ruler.getX()` writes | which context does the `put` use? |
| Existence is `find`, count is `COUNT()` | any `ArraySink` followed by `isEmpty()` or `size()`? |
| Configure EasyDAO before writing a new layer | is there a `cache`, `decorator`, or `pm` switch for this? |

### Take `x` from the argument and pass it down
The caller's `x` carries the user, session, and decorators; `getX()` is the object's boot context and runs as system.
Don't: `dao = (DAO) getX().get("userDAO")` in a web agent or service method that received `x`
Do:    `dao = ((DAO) x.get("userDAO")).inX(x)` when handed a system DAO; `PM.create(x, ...)`, `(Logger) x.get("logger")`
Review asked: "This is a major security hole since you let a user perform arbitrary queries in the system context... do: dao = dao.inX(x)"

### Inside a decorator, call `find_`, `put_`, `select_` with `x`
The bare form re-enters the stack with the DAO's own context, so the rest of the chain runs as system and drops every query argument.
Don't: `getDelegate().find(id)`; `getDelegate().select(sink)` inside a `select_` override
Do:    `getDelegate().find_(x, id)`; `getDelegate().select_(x, sink, skip, limit, order, predicate)`

### Inside a rule, `x` reads and `ruler.getX()` writes
The ruler decorates `x` read-only; a write through it fails, and a write through `getX()` bypasses the ruler.
Don't: `getX().get("fooDAO").put(obj)` in a `RuleAction`
Do:    `((DAO) x.get("fooDAO")).find_(x, id)` to read; `((DAO) ruler.getX().get("fooDAO")).put_(ruler.getX(), obj)` to write; re-put the object's own DAO through `agency.submit(...)` then `ruler.stop()`
Review asked: "use the argument x." / "replace getX() with ruler.getX() to get a non Readonly DAO."

### `XLocator.get()` only in property hooks, with the reason beside it
`getX()` is `EmptyX` during journal replay, so hooks need the thread-local context; anywhere else it hides a missing `x`.
Don't: `XLocator.get()` in a service method
Do:    `X x = XLocator.get();` inside `javaPostSet`/`javaFactory`, null-checking the context and the DAO

### Import the DAO you own; `inX` the DAO you were handed
A named `imports:` entry arrives already scoped to the object's context; `inX` exists for a DAO that came from elsewhere.
Don't: `((DAO) getX().get("localUserDAO")).inX(getX())`
Do:    `imports: [ { name: 'userDAO', javaType: 'DAO', key: 'localUserDAO' } ]` then `getUserDAO()`

### Existence is `find`, count is `COUNT()`
A sink materializes rows to answer a yes/no question.
Don't: `ArraySink s = new ArraySink(); dao.where(p).limit(1).select(s); return ! s.getArray().isEmpty();`
Do:    `return dao.find(p) != null;` or `dao.select(COUNT())`
Review asked: "Can be done with find() or if you don't care about the result then a COUNT()."

### Express the query; let the DAO answer it
A loop that compares rows in Java bypasses indices and the decorators that would have scoped it.
Don't: `OR(EQ(p, a), EQ(p, b), ...)` built in a loop; string join keys per comparison; `List.remove` inside a merge
Do:    `IN(p, values)`; `addPropertyIndex` on the columns the query uses; sort once and merge

### Configure EasyDAO before writing a new layer
EasyDAO already has the cache, the TTL, the decorator slot, and the PM switch.
Don't: a hand-written caching DAO; a `ModuleSupport` wrapper with `clearCache()`
Do:    `"cache": true, "ttlSelectPurgeTime": ...` in `services.jrl`; `.setDecorator(...)`; `.setPm(true)`
Review asked: "Is not just adding a TTL cache (supported by the EasyDAO config) to that DAO not sufficient?"

### A decorator answers `cmd_` with `null`, never throws
`cmd_` is a "does anyone handle this?" probe; a throw makes a retrying stack loop.
Don't: `throw new UnsupportedOperationException()` in `cmd_`
Do:    `return null;` for commands the decorator does not own; `return getDelegate().cmd_(x, obj);` otherwise

### Never use `ctrl`; import the exported function or `requires:` the class
`ctrl` exists for debugging and only in apps with the standard controller.
Don't: `imports: ['ctrl']` then `this.ctrl.routeTo(...)`
Do:    `imports: ['routeTo', 'pushMenu', 'notify']` then `this.routeTo(...)`
Review asked: "ctrl is meant for debugging purposes only" (PR #4166)
